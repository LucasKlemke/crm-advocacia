# infra/bootstrap

Aplicado **uma vez** pelo usuário, com credencial local de administrador da conta AWS (`aws configure` ou
`aws sso login`). Cria o que o ambiente `pac` (`infra/terraform`) e o GitHub Actions precisam antes de
existir qualquer estado remoto:

| Recurso | Para quê |
|---|---|
| Bucket S3 `crm-pac-tfstate-<account_id>` | Estado remoto do `infra/terraform` (versionado, SSE-S3, block public access, `prevent_destroy`). O lock usa o próprio S3 (`use_lockfile = true`), sem DynamoDB. |
| OIDC provider `token.actions.githubusercontent.com` | Permite ao GitHub Actions trocar o token do workflow por credencial temporária da AWS, sem chave de acesso guardada no GitHub. |
| Role `crm-pac-github-deploy` | Assumida só pelo `deploy-aws.yml` na `main` (`terraform apply`, push no ECR); `AdministratorAccess`; sessão de no máximo 2 h (o primeiro deploy pode passar de 1 h). |
| Role `crm-pac-github-plan` | Assumida só pelo `infra-plan.yml` em PRs (`terraform plan`); `ReadOnlyAccess` + política inline com leitura do bucket de estado e `secretsmanager:GetSecretValue` em `crm-pac/*`; sessão de 1 h. |

## Como aplicar

```sh
cd infra/bootstrap
terraform init
terraform apply                       # confira o plano antes de confirmar
terraform output bucket_estado        # -> backend.hcl do infra/terraform e variável TF_STATE_BUCKET
terraform output role_deploy_arn      # -> variável de repositório AWS_DEPLOY_ROLE_ARN
terraform output role_plan_arn        # -> variável de repositório AWS_PLAN_ROLE_ARN
```

Variáveis: `regiao` (padrão `us-east-1`), `repositorio_github` (padrão `LucasKlemke/crm-advocacia`, o
`origin` deste repositório — ajuste com `-var repositorio_github=<owner>/<repo>` num fork) e `prefixo`
(padrão `crm-pac`).

## Estado local (importante)

Este diretório **não** usa backend remoto: é ele que cria o bucket do estado. O `terraform.tfstate` gerado
aqui fica só na sua máquina e **não é versionado** (`*.tfstate*` está no `.gitignore`). Guarde uma cópia
(gerenciador de senhas, drive pessoal). Se perder, os recursos continuam existindo; dá para recuperar com
`terraform import` ou recriar o estado do zero.

O bucket tem `prevent_destroy`: um `terraform destroy` aqui falha de propósito, para não apagar o estado do
ambiente por engano. Para desmontar tudo após a avaliação: `terraform destroy` em `infra/terraform`
primeiro, depois remova o `prevent_destroy`, esvazie o bucket (todas as versões) e rode `terraform destroy`
aqui.

## Confiança (trust policy)

Cada role só pode ser assumida por tokens com `aud = sts.amazonaws.com` e um único `sub` (`StringEquals`):

- `crm-pac-github-deploy`: `repo:<owner>/<repo>:ref:refs/heads/main` — push na `main` ou "Run workflow"
  na `main` (deploy, `terraform apply`);
- `crm-pac-github-plan`: `repo:<owner>/<repo>:pull_request` — PRs (só `terraform plan`).

Um PR (que pode alterar o próprio workflow) só consegue a role de leitura; credencial de escrita exige
código já mergeado na `main`. Nenhuma outra branch, tag, environment ou repositório assume as roles.

### Por que a role de plan precisa de mais que `ReadOnlyAccess`

- **Estado remoto:** `s3:ListBucket` no bucket e `s3:GetObject` nos objetos. O `infra-plan.yml` roda
  `terraform plan -lock=false`, então não grava o `.tflock` (sem `PutObject`/`DeleteObject`). Rodar
  plan com lock usando esta role falha por falta de permissão.
- **Secrets Manager:** o refresh do `aws_secretsmanager_secret_version` lê o valor do secret, e
  `GetSecretValue` não faz parte do `ReadOnlyAccess`; a permissão vale só para `crm-pac/*`. Os demais
  recursos do `infra/terraform` (VPC, ECS, ECR, ELB, CloudFront, RDS, S3, IAM, Logs, Budgets) são lidos
  com as ações `Describe*`/`Get*`/`List*` que o `ReadOnlyAccess` já cobre.

## Permissões: simplificação documentada

A role de deploy recebe `AdministratorAccess`. É uma **simplificação consciente** para uma conta AWS
pessoal usada só nesta disciplina: o controle está em quem pode assumir a role (só a `main`, trust policy
acima), não no que ela pode fazer.

Próximos passos de menor privilégio (recomendados em conta compartilhada ou de produção):

1. A role de deploy com política própria limitada aos serviços usados pelo `infra/terraform` (EC2/VPC, ECS,
   ECR, ELB, CloudFront, RDS, S3, Secrets Manager, CloudWatch Logs, Budgets, IAM restrito a
   `arn:aws:iam::<conta>:role/crm-pac-*` com `iam:PassRole` condicionado a `ecs-tasks.amazonaws.com`).
2. Opcional: GitHub Environments com aprovação manual e `sub` = `repo:<owner>/<repo>:environment:<nome>`.


## Conta que já tem o provider OIDC do GitHub

Cada conta AWS aceita um único provider `token.actions.githubusercontent.com`. Se ele já existir, o
`apply` falha com `EntityAlreadyExists`; importe-o antes:

```bash
terraform import aws_iam_openid_connect_provider.github arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com
```

Os workflows não podem usar `environment:` do GitHub: isso muda o `sub` do token para
`repo:<owner>/<repo>:environment:<nome>`, e a trust policy das roles deixa de aceitá-lo.

## O que a role de plan consegue ler

A `crm-pac-github-plan` lê o estado do Terraform, e o estado guarda em texto os valores do secret
`crm-pac/api` (inclusive `DATABASE_URL`). Na prática, quem consegue abrir PR **a partir de uma branch do
próprio repositório** consegue ler esses valores. PRs de fork não recebem token OIDC nem rodam o plan.
Só dê permissão de push a quem já poderia ver os segredos de produção.
