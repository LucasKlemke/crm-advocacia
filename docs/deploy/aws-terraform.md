# Deploy acadêmico na AWS (Terraform + GitHub Actions)

Passo a passo para colocar no ar o deploy **acadêmico** (`crm-advocacia-pac`): a API na AWS, com a
infraestrutura em Terraform (`infra/`) publicada pelo GitHub Actions, e só a SPA na Vercel. O deploy de
produção real (Supabase) não muda e continua descrito em [deploy.md](deploy.md). Desenho e motivos:
[../superpowers/specs/2026-11-05-deploy-aws-e-tempo-real-design.md](../superpowers/specs/2026-11-05-deploy-aws-e-tempo-real-design.md);
detalhes de cada recurso em [../../infra/terraform/README.md](../../infra/terraform/README.md) e
[../../infra/bootstrap/README.md](../../infra/bootstrap/README.md); tempo real em
[../arquitetura/tempo-real.md](../arquitetura/tempo-real.md).

```
navegador ──HTTPS──► Vercel (SPA, Project crm-advocacia-pac) ──/api/* (rewrite)──┐
    │                                                                            ▼
    └──WSS /api/ws?ticket=... (VITE_WS_URL) ─────────────────► CloudFront (*.cloudfront.net)
                                                                  │ header secreto X-Origem-CloudFront
UAZAPI ──webhook assinado──► CloudFront ─────────────────────────►│
                                                                  ▼
                                      ALB :80 (só a prefix list do CloudFront; sem o header → 403)
                                                                  ▼
                                      ECS Fargate ARM64, 1 task ── RDS Postgres 16 (privado)
                                                                ├─ S3 documentos (task role)
                                                                └─ Secrets Manager, CloudWatch Logs
```

O cookie `crm_sessao` continua first-party: o navegador só fala HTTP com o domínio da Vercel, que faz
proxy de `/api/*` para o CloudFront. Só o WebSocket vai direto ao CloudFront, autenticado por ticket
(`GET /api/tempo-real/ticket`, que passa pelo proxy com o cookie).

## Checklist do que só o dono da conta faz

Nada disto é automatizado nem foi executado pelo Claude (não há credencial AWS/Vercel/GitHub no
desenvolvimento). Siga na ordem; cada item aponta a seção com o detalhe.

- [ ] 1. Credencial local de administrador da conta AWS (`aws configure` ou `aws sso login`) e
      Terraform >= 1.11 instalados ([Pré-requisitos](#pré-requisitos)).
- [ ] 2. `terraform apply` em `infra/bootstrap` com a credencial local; guardar uma cópia do
      `terraform.tfstate` dele ([Bootstrap](#1-bootstrap-estado-remoto-e-oidc)).
- [ ] 3. Criar `infra/terraform/backend.hcl` a partir do `.example` (só para rodar o Terraform
      localmente; o CI passa o bucket por `TF_STATE_BUCKET`).
- [ ] 4. Cadastrar no GitHub as variáveis `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `TF_STATE_BUCKET`,
      `WEB_ORIGINS_JSON`, `UAZAPI_SERVER_URL` e os secrets `TF_VAR_UAZAPI_ADMIN_TOKEN`,
      `TF_VAR_NEW_RELIC_LICENSE_KEY`, `TF_VAR_BUDGET_EMAIL` ([GitHub](#2-variáveis-e-secrets-do-github)).
- [ ] 5. Primeiro deploy: merge na `main` ou "Run workflow" do `Deploy AWS (API)` na `main`; anotar o
      `api_url` do resumo do job ([Primeiro deploy](#3-primeiro-deploy)).
- [ ] 6. Conferir no console (Billing → Budgets) o orçamento `crm-pac-mensal` e que o e-mail de
      alerta chega (remetente AWS Budgets; olhe o spam) ([Orçamento](#orçamento-e-custos)).
- [ ] 7. Vercel, Project `crm-advocacia-pac`: trocar o Root Directory para `apps/web` **antes** do
      merge desta mudança na `main` (senão o `pac` builda o `vercel.json` de Services da raiz e quebra);
      depois do primeiro deploy AWS, commitar o domínio do CloudFront no lugar do placeholder de
      `apps/web/vercel.json`, definir `VITE_WS_URL` e remover as variáveis antigas da API
      ([Vercel](#4-vercel-project-crm-advocacia-pac)).
- [ ] 8. Criar as instâncias de WhatsApp do deploy acadêmico (não compartilhar instâncias com o deploy
      Supabase) ou reconfigurar as existentes com "Sincronizar instâncias"
      ([Webhooks](#5-webhooks-das-instâncias-uazapi)).
- [ ] 9. Conferir na UAZAPI real que `POST /webhook` **substitui** o webhook da instância em vez de
      acrescentar um segundo (a doc da UAZAPI não deixa explícito) ([Webhooks](#5-webhooks-das-instâncias-uazapi)).
- [ ] 10. (Opcional) Migrar dados do RDS/S3 acadêmicos antigos ([Migração de dados](#6-opcional-migrar-dados-do-deploy-antigo)).
- [ ] 11. Deploy Supabase: definir `TEMPO_REAL_HABILITADO=false` no Project `crm-advocacia-supabase` e
      conferir o tamanho da função `api` (o Prisma agora gera 4 engines) ([deploy.md](deploy.md)).
- [ ] 12. Validar ponta a ponta ([Verificação](#7-verificação-ponta-a-ponta)).
- [ ] 13. Depois da avaliação: `terraform destroy` em `infra/terraform` e, por último, o bootstrap
      ([Desmontar](#desmontar-depois-da-avaliação)).

## Pré-requisitos

- Conta AWS própria (não Learner Lab) com usuário/SSO administrador para o bootstrap. Região padrão
  `us-east-1` (o CloudFront e o orçamento são globais; o resto fica na região escolhida).
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.11 (o lock do estado usa o próprio
  S3, `use_lockfile = true`), AWS CLI v2 e `jq`.
- Acesso de administrador ao repositório no GitHub (Settings → Secrets and variables → Actions) e ao
  Project `crm-advocacia-pac` na Vercel.
- Opcional, para testar a imagem localmente: Docker com buildx
  (`docker build -f apps/api/Dockerfile -t crm-api .` na raiz).

## 1. Bootstrap (estado remoto e OIDC)

Aplicado **uma vez**, com a credencial local; o estado dele fica **local** (é ele que cria o bucket do
estado remoto). Cria o bucket `crm-pac-tfstate-<conta>`, o provider OIDC do GitHub e a role
`crm-pac-github-deploy` (trust restrita a `refs/heads/main` e `pull_request` deste repositório).

```sh
cd infra/bootstrap
terraform init
terraform apply      # num fork: -var repositorio_github=<owner>/<repo>
terraform output bucket_estado     # -> TF_STATE_BUCKET e backend.hcl
terraform output role_deploy_arn   # -> AWS_DEPLOY_ROLE_ARN
```

Guarde uma cópia de `infra/bootstrap/terraform.tfstate` fora do repositório (está no `.gitignore`). Se a
conta já tem o provider OIDC do GitHub, importe-o antes (comando no
[README do bootstrap](../../infra/bootstrap/README.md)).

Para rodar o ambiente localmente (opcional; o CI não precisa disto):

```sh
cd infra/terraform
cp backend.hcl.example backend.hcl            # bucket = output bucket_estado
cp terraform.tfvars.example terraform.tfvars  # nunca versionar
terraform init -backend-config=backend.hcl
terraform plan
```

## 2. Variáveis e secrets do GitHub

Settings → Secrets and variables → Actions. Nomes exatos usados por `deploy-aws.yml` e `infra-plan.yml`:

| Tipo | Nome | Valor |
|---|---|---|
| Variável | `AWS_DEPLOY_ROLE_ARN` | output `role_deploy_arn` do bootstrap. Sem ela, os dois workflows são pulados (ficam verdes). |
| Variável | `AWS_REGION` | `us-east-1` (opcional; é o padrão) |
| Variável | `TF_STATE_BUCKET` | output `bucket_estado` do bootstrap |
| Variável | `WEB_ORIGINS_JSON` | lista JSON das origens da SPA, ex.: `["https://crm-advocacia-pac.vercel.app"]` (vira `web_origins`: CORS do S3 e `WEB_ORIGINS` da API) |
| Variável | `UAZAPI_SERVER_URL` | `https://<subdominio>.uazapi.com` |
| Secret | `TF_VAR_UAZAPI_ADMIN_TOKEN` | admintoken da conta UAZAPI |
| Secret | `TF_VAR_NEW_RELIC_LICENSE_KEY` | license key do New Relic (vazio desliga o agente) |
| Secret | `TF_VAR_BUDGET_EMAIL` | e-mail que recebe os alertas do orçamento |

Não existe chave de acesso AWS no GitHub: os workflows assumem a role por OIDC. Os jobs não podem usar
`environment:` (mudaria o `sub` do token e a trust policy recusaria). `AUTH_SECRET`, a senha do banco, o
`UAZAPI_WEBHOOK_SECRET` e o header do CloudFront são gerados pelo Terraform e ficam só no estado e no
Secrets Manager (`crm-pac/api`).

## 3. Primeiro deploy

Dispare o workflow **Deploy AWS (API)** (`.github/workflows/deploy-aws.yml`) na `main`: merge de um PR
ou Actions → Deploy AWS (API) → Run workflow (branch `main`; fora da `main` ele é pulado). O que ele faz:

1. `terraform apply -target=aws_ecr_repository.api` se o repositório ECR ainda não existe;
2. build da imagem `linux/arm64` (QEMU no runner x64) e push com a tag = SHA do commit (tags imutáveis;
   num re-run do mesmo SHA o build é pulado);
3. `terraform apply` só da task definition e do mínimo para a task de migration rodar (cluster, roles,
   SG, RDS por dependência). **No primeiro deploy é aqui que o RDS nasce** (5-15 min);
4. `aws ecs run-task` com `npm run migrar -w @crm/api` (= `prisma migrate deploy`) e exige exit 0 (o
   container da API nunca migra ao subir; ver a regra expand/contract em
   [../database/migrations-prisma.md](../database/migrations-prisma.md));
5. `terraform apply` completo (ALB, CloudFront, serviço ECS...). O CloudFront leva de 5 a 15 min;
6. `aws ecs wait services-stable` + `scripts/deploy/verificar-rollout.sh` (falha se o circuit breaker
   voltou para a revisão anterior) + smoke `curl <api_url>/api/saude`.

O primeiro deploy pode passar de 1 h (o job tem 90 min e a sessão da role, 2 h). O resumo do job mostra
a `api_url` (`https://dxxxxxxxx.cloudfront.net`); ela também sai de `terraform output api_url`.

Rollback: o `workflow_dispatch` só roda na `main` (sempre no commit mais recente), então não serve para
voltar versão. Há dois caminhos: (a) em Actions, abrir o run **antigo** do commit desejado e usar
**"Re-run all jobs"**, que reimplanta a imagem daquele SHA mas também reaplica o Terraform e o workflow
daquele commit (a infra pode voltar junto); ou (b) fazer `git revert` na `main` (via PR), que gera um
deploy novo com o código anterior e a infra atual. Em ambos o schema não volta (por isso expand/contract). Falha de migration no passo 4 interrompe o deploy com o serviço intacto na revisão
anterior; o link do log no CloudWatch aparece no erro do job.

Em PRs que tocam `infra/**` ou `apps/api/**`, o **Infra (terraform plan)** mostra no resumo o que seria
aplicado, usando a imagem em execução. Ele nunca roda `apply`.

## 4. Vercel, Project `crm-advocacia-pac`

O Project passa a publicar **só a SPA**. A config vem de `apps/web/vercel.json` (o `vercel.json` da raiz,
com Vercel Services, continua sendo o do Project Supabase).

Ordem obrigatória:

- O Root Directory muda **antes** do merge na `main` desta mudança. Com Root Directory `.`, o `pac`
  builda o `vercel.json` de Services da raiz sem as variáveis da API e o deploy quebra.
- Até o commit que troca `TROQUE_PELO_DOMINIO_DO_CLOUDFRONT` pelo domínio real chegar à `main`, todo
  `/api/*` do `pac` responde erro (DNS inválido): a SPA abre, mas login e dados não funcionam.
- Sequência: Root Directory `apps/web` → primeiro deploy AWS (seção 3) → anotar a `api_url` → commit do
  domínio em `apps/web/vercel.json` + `VITE_WS_URL` → redeploy da Vercel.

1. Settings → Build and Deployment: **Root Directory `apps/web`** (com "Include files outside the root
   directory" ligado, padrão, porque o install roda `npm ci` na raiz do monorepo), Framework Preset
   **Vite**, sem overrides de Build/Install/Output, Node.js 24.x.
2. Em `apps/web/vercel.json`, trocar `TROQUE_PELO_DOMINIO_DO_CLOUDFRONT.cloudfront.net` pelo domínio da
   `api_url` (sem `https://` duplicado, mantendo `/api/$1` no fim) e commitar. O `vercel.json` é estático:
   não lê variável de ambiente, então o domínio fica versionado (não é segredo; o ALB só aceita o
   CloudFront, que só aceita o que tem o header secreto ao repassar).
3. Settings → Environment Variables (Production): `VITE_WS_URL = wss://dxxxxxxxx.cloudfront.net` (a
   `api_url` com `wss://`; sem `/api/ws`). Ela é embutida no build: mudou, faça redeploy.
4. Remover do Project as variáveis da API que eram usadas quando ele publicava `web` + `api`
   (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AWS_*`, `UAZAPI_*`, `NEW_RELIC_*`, `NODE_OPTIONS`): a API
   agora lê tudo do Secrets Manager e da task definition.
5. Redeploy de produção e conferir `https://crm-advocacia-pac.vercel.app/api/saude` → `{"ok":true}`.

Previews do `pac` também fazem proxy para a mesma API de produção da AWS, mas a origem deles não está em
`WEB_ORIGINS_JSON`: o WebSocket fecha com 4403 (a tela cai em "Atualização manual") e o upload direto ao
S3 falha por CORS. Para testar um preview, acrescente a URL dele em `WEB_ORIGINS_JSON` e rode o deploy.

O domínio `crm-advocacia-pac.vercel.app` precisa ser exatamente uma das origens de `WEB_ORIGINS_JSON`
(sem barra no fim). Se o Project tiver domínio próprio, inclua-o também.

## 5. Webhooks das instâncias (UAZAPI)

Com `API_PUBLIC_URL` (= `api_url`, definida pelo Terraform) e `UAZAPI_WEBHOOK_SECRET`, a API registra em
cada instância o webhook assinado `.../api/webhooks/uazapi/<instanciaId>/<assinatura>` ao criar,
reconectar e em **Sincronizar instâncias** (tela de instâncias de WhatsApp). Sem webhook, o progresso
ainda chega pelo polling de 15 s.

- **Uma instância por deploy.** A UAZAPI guarda uma URL de webhook por instância; se o deploy acadêmico e
  o Supabase usarem a mesma, a última que registrar vence. Crie instâncias próprias para o `pac`.
- **Instâncias que já existiam no banco restaurado** (seção 6): clique em "Sincronizar instâncias" uma vez
  depois do primeiro deploy para regravar o webhook com a URL nova.
- **Conferir no servidor UAZAPI real** que `POST /webhook` substitui o webhook existente (e não cria um
  segundo): depois de sincronizar, `GET /webhook` com o token da instância deve listar só a URL assinada.
  Se acumular, remova os antigos pelo painel da UAZAPI (e registre isso como ajuste no
  `uazapi-client.ts`).
- Webhooks antigos que apontam para `POST /api/webhooks/uazapi` (sem assinatura) continuam recebendo 200
  e não disparam nada.

## 6. (Opcional) Migrar dados do deploy antigo

O Terraform cria RDS e bucket **novos**; nada do RDS/S3 acadêmico antigo é importado. Se quiser os dados
antigos, faça logo depois do primeiro deploy, antes de usar o sistema novo. Roteiro (não automatizado,
confira cada passo):

1. **Pausar a API**: `aws ecs update-service --cluster crm-pac --service crm-pac-api --desired-count 0`
   (outputs `ecs_cluster`/`ecs_service`; o próximo `terraform apply` volta para 1).
2. **Banco**: o RDS novo fica em subnet privada (inacessível do seu computador). Rode o restore de dentro
   da VPC, numa task Fargate avulsa com a imagem `postgres:16`, nas `subnets_publicas` com o `sg_task`
   (outputs do Terraform) e a role `crm-pac-ecs-execucao`, com o comando
   `pg_dump --no-owner --no-privileges --clean --if-exists "$ORIGEM" | psql "$DESTINO"`. `ORIGEM` é a URL
   do RDS antigo (precisa aceitar conexão da internet durante a cópia); `DESTINO` é o `DATABASE_URL` do
   secret `crm-pac/api`
   (`aws secretsmanager get-secret-value --secret-id crm-pac/api --query SecretString --output text | jq -r .DATABASE_URL`).
   Passe as duas como `environment` do *override* do `run-task`, nunca na task definition, e desregistre
   a task definition temporária ao fim. O dump leva a tabela `_prisma_migrations` junto; o próximo deploy
   aplica as migrations que faltarem.
3. **Arquivos**: as keys gravadas no banco começam com o `AWS_S3_PREFIX` antigo (ex.: `production/`), e a
   task role só acessa `documentos/`. Copie e reescreva o prefixo:

   ```sh
   aws s3 sync s3://<bucket-antigo>/production/ s3://crm-pac-documentos-<conta>/documentos/
   ```

   ```sql
   UPDATE documento SET storage_key = 'documentos/' || substr(storage_key, length('production/') + 1)
     WHERE storage_key LIKE 'production/%';
   UPDATE usuario SET avatar_url = 'documentos/' || substr(avatar_url, length('production/') + 1)
     WHERE avatar_url LIKE 'production/%';
   ```

   (o SQL vai no mesmo `psql` da task do passo 2).
4. **Voltar a API**: rode o workflow Deploy AWS (API) de novo (aplica migrations pendentes e volta o
   serviço para 1 task) e depois "Sincronizar instâncias" (seção 5).

## 7. Verificação ponta a ponta

1. `curl https://dxxxxxxxx.cloudfront.net/api/saude` → `{"ok":true}`; o mesmo pelo domínio da Vercel.
2. `curl -s -o /dev/null -w "%{http_code}\n" http://<dns-do-alb>/api/saude` → `403` (sem o header do
   CloudFront) ou timeout (SG só aceita o CloudFront): o ALB não fica exposto.
3. No navegador (`https://crm-advocacia-pac.vercel.app`): cadastro, login, criar cliente, upload de
   documento (PUT assinado direto no S3). Cookie `crm_sessao` no domínio da Vercel, `HttpOnly; Secure`.
4. Abrir o detalhe de uma campanha: indicador **"Ao vivo"**; DevTools → Network → WS mostra
   `wss://dxxxxxxxx.cloudfront.net/api/ws?ticket=...` com a mensagem `{"tipo":"pronto"}`.
5. Disparar uma campanha pequena: o contador avança sem clicar em "Sincronizar" (webhook + polling).
6. CloudWatch Logs `/ecs/crm-pac-api`: `[webhook uazapi]` com `instanciaId` e só metadados.
7. New Relic (se a license key foi informada): app `crm-advocacia-pac` com transações por rota.

## Orçamento e custos

`orcamento.tf` cria um budget mensal (`budget_limit_usd`, padrão US$ 30) com alertas por e-mail em 80% e
100% do gasto real, enviados direto para `TF_VAR_BUDGET_EMAIL` (sem tópico SNS, então não há inscrição
a confirmar). Confira o orçamento `crm-pac-mensal` em Billing → Budgets e se os e-mails da AWS Budgets
não caem no spam. Os dados de custo da AWS atualizam algumas vezes por dia: o alerta não é instantâneo.

Estimativa ligado 24 h por dia em `us-east-1` (preços sob demanda públicos; confira no
[AWS Pricing Calculator](https://calculator.aws/), valores mudam):

| Recurso | Configuração | US$/mês (aprox.) |
|---|---|---|
| ECS Fargate | 1 task ARM64, 0,5 vCPU + 1 GB | 14 |
| Application Load Balancer | 1 ALB + LCU mínimo | 18 |
| RDS PostgreSQL | `db.t4g.micro` single-AZ + 20 GB gp3 + backup de 1 dia | 14 |
| IPv4 público | ~3 endereços (2 do ALB + 1 da task) a US$ 0,005/h | 11 |
| Secrets Manager | 1 secret | 0,40 |
| CloudWatch Logs | retenção 14 dias, volume baixo | < 1 |
| ECR | até 10 imagens (~200 MB cada) | < 1 |
| S3 documentos | poucos GB | < 1 |
| CloudFront | tráfego de disciplina (dentro do nível gratuito) | 0 |
| **Total** | | **~ 60** (≈ US$ 2 por dia) |

O total (~US$ 60/mês) passa do alvo de US$ 50 do desenho e do limite de US$ 30 do orçamento: com tudo
ligado o mês inteiro, os alertas disparam por volta da metade do mês. Créditos de conta nova/nível gratuito podem cobrir o RDS e parte do
resto. Para economizar entre apresentações: `aws ecs update-service ... --desired-count 0` e
`aws rds stop-db-instance --db-instance-identifier crm-pac-db` (o RDS religa sozinho após 7 dias); ALB e IPs do
ALB continuam cobrando. O mais barato é destruir e recriar perto da avaliação (o deploy refaz tudo em
~1 h, mas os dados se perdem).

## Desmontar depois da avaliação

Tudo no ambiente `pac` é destrutível de propósito (RDS sem proteção e sem snapshot final, bucket e ECR
com `force_destroy`/`force_delete`, secret sem janela de recuperação). **`destroy` apaga dados e
arquivos**: faça `pg_dump`/`aws s3 sync` antes, se precisar deles.

```sh
cd infra/terraform
terraform init -backend-config=backend.hcl
terraform destroy      # pede as mesmas variáveis do apply (terraform.tfvars local)
```

Depois, por último, o bootstrap: remova o `prevent_destroy` do bucket de estado em
`infra/bootstrap/main.tf`, esvazie o bucket (todas as versões) e rode `terraform destroy` em
`infra/bootstrap` (o estado local guardado no passo 2 do checklist). Apague também as variáveis/secrets do
GitHub (sem `AWS_DEPLOY_ROLE_ARN`, os workflows voltam a ser pulados) e devolva o Project `pac` da Vercel
para o modelo desejado.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Workflow "deploy (pulado)" | `AWS_DEPLOY_ROLE_ARN` não cadastrada ou execução fora da `main` |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | `repositorio_github` do bootstrap diferente do repo, ou job com `environment:` |
| `EntityAlreadyExists` no bootstrap | provider OIDC já existe na conta: importe (README do bootstrap) |
| Migration falhou (exitCode≠0) | ver o link do CloudWatch no erro; o serviço segue na revisão anterior |
| "confere o rollout" falhou | circuit breaker voltou à revisão anterior: a task nova não passou no healthcheck `/api/saude` (logs no CloudWatch) |
| `/api/*` da Vercel responde erro de DNS/502 | placeholder ainda em `apps/web/vercel.json` ou domínio errado |
| Detalhe da campanha fica em "Atualização manual" | `VITE_WS_URL` ausente/errada (redeploy após mudar), origem fora de `WEB_ORIGINS_JSON` (4403) ou API com `TEMPO_REAL_HABILITADO=false` |
| Upload de documento falha no navegador | origem da SPA fora de `WEB_ORIGINS_JSON` (CORS do bucket) |
