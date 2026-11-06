# infra/terraform — ambiente `pac` (deploy acadêmico na AWS)

API do CRM em ECS Fargate atrás de ALB + CloudFront, com RDS Postgres 16, S3 de documentos, Secrets
Manager, CloudWatch Logs e orçamento mensal. A SPA continua na Vercel, que faz proxy de `/api/*` para a
URL do CloudFront. Desenho e motivos de cada peça: `docs/superpowers/specs/2026-11-05-deploy-aws-e-tempo-real-design.md`
(o passo a passo do usuário fica em `docs/deploy/aws-terraform.md`).

```
navegador -> Vercel (SPA) --/api/*--> CloudFront (HTTPS, *.cloudfront.net, header X-Origem-CloudFront)
          \--WSS (ticket)----------->     |
                                          v
                        ALB :80 (SG = prefix list do CloudFront; sem o header -> 403)
                                          v
                        ECS Fargate ARM64, 1 task, subnet pública com IP público (SG só do ALB)
                           |-> RDS Postgres 16 (subnets privadas, SG só da task)
                           |-> S3 documentos (task role, prefixo documentos/)
                           |-> Secrets Manager crm-pac/api, CloudWatch /ecs/crm-pac-api
```

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `versions.tf` | Terraform >= 1.11, providers, backend S3 (`key = pac/terraform.tfstate`, `use_lockfile`) |
| `providers.tf` | Provider AWS com `default_tags`, locals compartilhados |
| `rede.tf` | VPC `10.20.0.0/16`, 2 subnets públicas + 2 privadas, IGW (sem NAT), security groups |
| `ecr.tf` | Repositório `crm-pac-api` (tags imutáveis, scan on push, mantém 10 imagens) |
| `iam.tf` | Execution role (ECR, logs, leitura do secret) e task role (S3 no prefixo `documentos/`) |
| `segredos.tf` | Senhas geradas e o secret JSON `crm-pac/api` |
| `rds.tf` | Postgres 16, `db.t4g.micro`, 20 GB gp3, single-AZ |
| `s3.tf` | Bucket de documentos privado com CORS para `web_origins` |
| `logs.tf` | Log group `/ecs/crm-pac-api` (14 dias) |
| `alb.tf` | ALB, target group (`/api/saude`), listener 80 com 403 padrão + regra do header |
| `ecs.tf` | Cluster, task definition (ARM64, env + secrets) e service (circuit breaker com rollback) |
| `cloudfront.tf` | Distribuição sem cache na frente do ALB |
| `orcamento.tf` | Budget mensal com alertas em 80% e 100% |

## Pré-requisitos

1. `infra/bootstrap` aplicado (bucket do estado + role do GitHub).
2. `cp backend.hcl.example backend.hcl` e preencha `bucket` com o output `bucket_estado`.
3. `cp terraform.tfvars.example terraform.tfvars` e preencha (nunca versione: está no `.gitignore`).

```sh
cd infra/terraform
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
terraform output api_url
```

No GitHub Actions, os valores sensíveis chegam como `TF_VAR_uazapi_admin_token`,
`TF_VAR_new_relic_license_key` e `TF_VAR_budget_email` (secrets do repositório), e `image_tag` vem de
`-var image_tag=<sha>`. Nenhuma variável sensível tem valor padrão no código, exceto
`new_relic_license_key` (padrão vazio).

## Variáveis

| Variável | Padrão | Observação |
|---|---|---|
| `regiao` | `us-east-1` | |
| `prefixo` | `crm-pac` | prefixo dos nomes |
| `image_tag` | — | obrigatória; tag da imagem no ECR (SHA do commit) |
| `web_origins` | — | obrigatória; origens da SPA (CORS do S3 e `WEB_ORIGINS`) |
| `uazapi_server_url` | — | obrigatória |
| `uazapi_admin_token` | — | obrigatória, sensível |
| `new_relic_license_key` | `""` | sensível; vazio = sem New Relic |
| `new_relic_app_name` | `crm-advocacia-pac` | |
| `budget_email` | — | obrigatória; confirme a inscrição no e-mail da AWS |
| `budget_limit_usd` | `30` | |
| `db_instance_class` | `db.t4g.micro` | |
| `task_cpu` / `task_memory` | `512` / `1024` | |

## Outputs

`api_url` (`https://<distribuição>.cloudfront.net`), `ecr_repository_url`, `ecs_cluster`, `ecs_service`,
`task_definition_family`, `task_definition_arn`, `subnets_publicas`, `sg_task`, `log_group` — usados pelo `deploy-aws.yml`
(push da imagem, `run-task` da migration, espera do serviço e smoke test).

## Variáveis de ambiente da API

- `environment`: `NODE_ENV=production`, `PORT=3001`, `AWS_REGION`, `AWS_S3_BUCKET`,
  `AWS_S3_PREFIX=documentos`, `UAZAPI_SERVER_URL`, `NEW_RELIC_APP_NAME`, `NEW_RELIC_NO_CONFIG_FILE=true`,
  `NEW_RELIC_LOG=stdout`, `NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true`,
  `NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED=true`, `API_PUBLIC_URL` (URL do
  CloudFront), `WEB_ORIGINS` (`web_origins` unidas por vírgula), `TEMPO_REAL_HABILITADO=true`.
- `secrets` (chaves do JSON `crm-pac/api`, via `valueFrom = "<arn>:<CHAVE>::"`): `AUTH_SECRET`,
  `DATABASE_URL`, `DIRECT_URL`, `UAZAPI_WEBHOOK_SECRET`, `UAZAPI_ADMIN_TOKEN`, `NEW_RELIC_LICENSE_KEY`.
- Não há `AWS_ACCESS_KEY_ID`: o SDK usa a credencial da task role.
- `DATABASE_URL` e `DIRECT_URL` são a mesma URL (`?sslmode=require`; sem pooler na frente do RDS).
- `NEW_RELIC_LICENSE_KEY` sempre existe no secret; com a variável vazia ela é injetada como string vazia e
  a API trata isso como "New Relic desligado".

## Decisões e limitações (ambiente de disciplina)

- **Sem dependência circular**: o CloudFront depende só do ALB e do header secreto; a task definition
  depende do domínio do CloudFront (`API_PUBLIC_URL`). O `terraform validate` confirma o grafo.
- **Migrations fora do container**: o comando do container é o `CMD` da imagem. O workflow aplica primeiro
  só a task definition (`-target=aws_ecs_task_definition.api`), roda `aws ecs run-task` com
  `command` = `prisma migrate deploy` nas `subnets_publicas`/`sg_task`, exige exit 0 e só então faz o
  apply completo. Migrations devem ser expand/contract.
- **Primeiro push no ECR**: o repositório precisa existir antes do build; rode
  `terraform apply -target=aws_ecr_repository.api -var image_tag=bootstrap` (ou o workflow faz isso).
  Mesmo com `-target`, todas as variáveis obrigatórias precisam estar definidas (`terraform.tfvars`
  local ou `TF_VAR_*`).
- **SSL do banco**: a `DATABASE_URL` usa `sslmode=require`, que o engine Rust do Prisma 6 aceita sem
  validar o certificado. Se a API passar a usar `@prisma/adapter-pg`, será preciso o bundle de CA do RDS
  (`sslrootcert`), porque o `pg` trata `require` como `verify-full`.
- **Sem NAT Gateway**: a task fica em subnet pública com IP público; o SG só aceita entrada do ALB.
- **ALB protegido em duas camadas**: SG aceita só a prefix list `com.amazonaws.global.cloudfront.origin-facing`
  e o listener responde 403 a qualquer request sem `X-Origem-CloudFront` correto.
- **Destrutível de propósito**: RDS sem `deletion_protection` e com `skip_final_snapshot`, bucket de
  documentos com `force_destroy`, ECR com `force_delete`, secret com `recovery_window_in_days = 0`.
  `terraform destroy` apaga dados e arquivos — faça `pg_dump`/`aws s3 sync` antes se precisar deles.
- **Uma task só**: com N tasks, migração em `run-task` dedicado continua valendo, mas os assinantes de
  WebSocket ficam em memória por task (precisaria de pub/sub compartilhado).
- **HTTPS sem domínio próprio**: certificado padrão `*.cloudfront.net`, `PriceClass_100`.
