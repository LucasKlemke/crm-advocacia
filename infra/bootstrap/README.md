# infra/bootstrap

Aplicado **uma vez** pelo usuário, com credencial local de administrador da conta AWS (`aws configure` ou
`aws sso login`). Cria o que o ambiente `pac` (`infra/terraform`) e o GitHub Actions precisam antes de
existir qualquer estado remoto:

| Recurso | Para quê |
|---|---|
| Bucket S3 `crm-pac-tfstate-<account_id>` | Estado remoto do `infra/terraform` (versionado, SSE-S3, block public access, `prevent_destroy`). O lock usa o próprio S3 (`use_lockfile = true`), sem DynamoDB. |
| OIDC provider `token.actions.githubusercontent.com` | Permite ao GitHub Actions trocar o token do workflow por credencial temporária da AWS, sem chave de acesso guardada no GitHub. |
| Role `crm-pac-github-deploy` | Assumida pelos workflows (`infra-plan.yml`, `deploy-aws.yml`); sessão de no máximo 1 h. |

## Como aplicar

```sh
cd infra/bootstrap
terraform init
terraform apply                       # confira o plano antes de confirmar
terraform output bucket_estado        # -> backend.hcl do infra/terraform e variável TF_STATE_BUCKET
terraform output role_deploy_arn      # -> variável de repositório AWS_DEPLOY_ROLE_ARN
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

A role só pode ser assumida por tokens com `aud = sts.amazonaws.com` e `sub` igual a:

- `repo:<owner>/<repo>:ref:refs/heads/main` — push na `main` (deploy, `terraform apply`);
- `repo:<owner>/<repo>:pull_request` — PRs (só `terraform plan`; o workflow de PR nunca roda `apply`).

Nenhuma outra branch, tag, environment ou repositório consegue assumir a role.

## Permissões: simplificação documentada

A role recebe `AdministratorAccess`. É uma **simplificação consciente** para uma conta AWS pessoal usada só
nesta disciplina: o controle está em quem pode assumir a role (trust policy acima), não no que ela pode
fazer. Um mesmo papel serve para `plan` e `apply`.

Alternativa de menor privilégio (recomendada em conta compartilhada ou de produção):

1. Duas roles: `...-github-plan` (trust só `pull_request`, política `ReadOnlyAccess` + leitura/escrita no
   bucket de estado para o lock) e `...-github-apply` (trust só `refs/heads/main`).
2. A role de apply com política própria limitada aos serviços usados pelo `infra/terraform` (EC2/VPC, ECS,
   ECR, ELB, CloudFront, RDS, S3, Secrets Manager, CloudWatch Logs, Budgets, IAM restrito a
   `arn:aws:iam::<conta>:role/crm-pac-*` com `iam:PassRole` condicionado a `ecs-tasks.amazonaws.com`).
3. Opcional: GitHub Environments com aprovação manual e `sub` = `repo:<owner>/<repo>:environment:<nome>`.


## Conta que já tem o provider OIDC do GitHub

Cada conta AWS aceita um único provider `token.actions.githubusercontent.com`. Se ele já existir, o
`apply` falha com `EntityAlreadyExists`; importe-o antes:

```bash
terraform import aws_iam_openid_connect_provider.github arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com
```

Os workflows não podem usar `environment:` do GitHub: isso muda o `sub` do token para
`repo:<owner>/<repo>:environment:<nome>`, e a trust policy desta role deixa de aceitá-lo.
