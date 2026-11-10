# Deploy

Instruções de deploy exigidas pela documentação mínima da linha Web Apps ([directions-webapp.md](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-webapp.md)). Complementa [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md) (decisão de stack) e [../database/docker-setup.md](../database/docker-setup.md) (banco local).

## Por que dois deploys de produção

O curso (PAC Extensionista VII, Católica SC) exige um ambiente público e estável, mas **não permite Supabase** como parte da stack avaliada. Ao mesmo tempo, o produto nasceu de uma necessidade real (escritório do Dr. Lucas Quintino) e a versão que vai pro cliente final prioriza velocidade/DX, o que torna Supabase a escolha certa para produção de verdade. O projeto mantém **os dois em paralelo**, a partir do mesmo código-fonte:

| Deploy | Onde roda | Backend | Público |
|---|---|---|---|
| `crm-advocacia-pac` | SPA na Vercel + API na AWS (ECS Fargate atrás de ALB + CloudFront), infraestrutura em Terraform | Amazon RDS (PostgreSQL) + Amazon S3 | Avaliação acadêmica (professor/banca) |
| `crm-advocacia-supabase` | Vercel com Services (`web` + `api` na mesma origem) | Supabase (PostgreSQL) + Supabase Storage | Cliente final / produção real |

Nenhum dos dois é "o ambiente de teste do outro" — ambos rodam a mesma `main`, migrada e com dados próprios; o que muda é a hospedagem e o par de banco/bucket configurado por variável de ambiente, nunca o código. A única diferença de comportamento é o **tempo real das campanhas** (WebSocket + polling, [../arquitetura/tempo-real.md](../arquitetura/tempo-real.md)): ligado na AWS, onde há um processo vivo, e desligado no deploy Supabase (`TEMPO_REAL_HABILITADO=false`), onde a API roda como Vercel Function.

O passo a passo completo do deploy acadêmico (bootstrap, GitHub, primeiro deploy, Vercel, custos, `terraform destroy`) está em **[aws-terraform.md](aws-terraform.md)**. O resto deste documento descreve o deploy Supabase (Vercel Services) e o que é comum aos dois.

## Ambientes

| Ambiente | App | Banco | Storage | Uso |
|---|---|---|---|---|
| Local (desenvolvimento) | `npm run dev:full` (API :3001 + web :5173) | PostgreSQL via Docker Compose ou RDS direto ([docker-setup.md](../database/docker-setup.md)) | Conforme `apps/api/.env` | Dia a dia de desenvolvimento e TDD |
| Produção — acadêmico | Vercel, Project `crm-advocacia-pac` (só a SPA, `apps/web/vercel.json`) + AWS ECS Fargate (API, via `deploy-aws.yml`) | Amazon RDS (PostgreSQL 16, Terraform) | Amazon S3 (task role, sem chave) | Ambiente apresentado à disciplina — sem dependência de Supabase |
| Produção — real | Vercel, Project `crm-advocacia-supabase` (web + api) | Supabase (PostgreSQL, via Supavisor pooler) | Supabase Storage (API S3-compatível) | Uso pelo escritório/cliente final |

Não há ambiente de staging separado — os dois deploys de produção fazem esse papel entre si (mudança arriscada pode ser validada primeiro no deploy acadêmico, de menor risco, antes de refletir no de produção real), complementado pelos gates de CI (testes, cobertura, SonarCloud, `terraform plan`) antes do merge em `main`.

## Topologia do deploy acadêmico (Vercel só SPA + AWS)

```
navegador ──► Vercel (crm-advocacia-pac, Root Directory apps/web) ──/api/* rewrite──► CloudFront ──► ALB ──► ECS Fargate (API)
    └──WSS /api/ws?ticket=... (VITE_WS_URL) ───────────────────────────────────────► CloudFront          ├─► RDS / S3
UAZAPI ──webhook assinado /api/webhooks/uazapi/:instanciaId/:assinatura ──────────► CloudFront          └─► Secrets Manager
```

- **Config da Vercel**: `apps/web/vercel.json` (framework Vite, install na raiz do monorepo, rewrite externo `/api/(.*)` → `https://<distribuição>.cloudfront.net/api/$1` e fallback de SPA). O domínio do CloudFront entra no lugar do placeholder depois do primeiro `terraform apply`. O navegador só fala HTTP com o domínio da Vercel, então o cookie `crm_sessao` segue first-party e sem CORS.
- **WebSocket**: o rewrite da Vercel não carrega WebSocket; a SPA abre `/api/ws` direto no CloudFront (`VITE_WS_URL`, embutida no build) com um ticket de uso único pedido por `GET /api/tempo-real/ticket` (que passa pelo proxy, com o cookie). `WEB_ORIGINS` da API precisa conter a origem da SPA.
- **API**: imagem `apps/api/Dockerfile` (`linux/arm64`) no ECR, 1 task Fargate. Variáveis não secretas na task definition; segredos (`AUTH_SECRET`, `DATABASE_URL`/`DIRECT_URL`, `UAZAPI_WEBHOOK_SECRET`, `UAZAPI_ADMIN_TOKEN`, `NEW_RELIC_LICENSE_KEY`) no Secrets Manager. Detalhes em [../../infra/terraform/README.md](../../infra/terraform/README.md).
- **Por que `vercel.json` e não `vercel.ts`**: a referência atual do `vercel.ts` (`@vercel/config`) não documenta a chave `services` entre as propriedades tipadas, e só pode existir um arquivo de config por Project (`vercel.ts` **ou** `vercel.json`). Manter o `vercel.json` da raiz intacto para o Supabase e dar ao `pac` um Root Directory próprio (`apps/web`) com o seu `vercel.json` evita mudar o Project de produção real e não exige dependência nova.

## Topologia do deploy real: um Project, dois services por deployment

O Project `crm-advocacia-supabase` usa **Vercel Services** (`vercel.json` na raiz; recurso em Beta — ver o spike de go/no-go e o plano B na seção de configuração manual). Todo deployment publica juntos:

| Service | Raiz | Framework | Build | Executa como |
|---|---|---|---|---|
| `web` | `apps/web` | Vite | `npm run build` → `dist/` | Estático na CDN, com fallback de SPA para `index.html` |
| `api` | `apps/api` | NestJS | `npm run vercel-build` → `dist/main.mjs` (tsup) | Uma Vercel Function em Fluid Compute (`entrypoint: vercel-entry.mjs`, shim versionado que importa `dist/main.mjs`: a CLI exige o entrypoint antes do build) |

Rotas públicas (ordem importa): `/api/*` vai para `api`, que recebe o path original e usa o prefixo global `api` do Nest, e todo o resto vai para `web`. Consequências:

- **Mesma origem**: o cookie de sessão `crm_sessao` (httpOnly, Secure, SameSite=Lax) é first-party, sem CORS e sem cookie cross-site.
- **Deploy e rollback atômicos**: web e api de um deployment sempre são da mesma versão. Nunca há front novo falando com API velha.
- **Preview coerente**: cada PR ganha um preview com o próprio web e a própria api.

Os dois deploys **não são branches diferentes** (o código divergiria com o tempo): apontam pro mesmo repositório (`LucasKlemke/crm-advocacia`), com `main` como Production Branch (Root Directory `.` no Supabase, `apps/web` no `pac`). Um push em `main` dispara os dois builds da Vercel e o `deploy-aws.yml`. No código, o comportamento diverge só por **variáveis de ambiente** (ex.: `TEMPO_REAL_HABILITADO`); nenhuma lógica de aplicação faz `if (ambiente === 'aws')`.

## S3Client compatível com múltiplos provedores

`apps/api/src/dominio/lib/external/s3-client.ts` é o único ponto de contato com armazenamento de arquivos (RN17/RN18, ver [../produto/regras-negocio.md](../produto/regras-negocio.md)). Em vez de manter duas implementações (uma AWS, uma Supabase), o mesmo client usa o `@aws-sdk/client-s3` apontado para um endpoint customizável:

- **Sem `AWS_S3_ENDPOINT`** → o SDK usa o endpoint padrão da AWS (comportamento do deploy acadêmico). Sem `AWS_ACCESS_KEY_ID`, o SDK usa a cadeia padrão de credenciais — no ECS, a task role.
- **Com `AWS_S3_ENDPOINT`** → o client usa esse endpoint com `forcePathStyle: true`, funcionando contra qualquer storage S3-compatível — é assim que o deploy de produção real aponta pro Supabase Storage (`https://<project-ref>.storage.supabase.co/storage/v1/s3`), usando as credenciais Access Key/Secret geradas em Supabase → Storage → S3 Connection.

Upload (URL assinada de PUT), download (URL assinada de GET, com `Content-Disposition`), leitura de stream (usada no zip de múltiplos documentos) e exclusão funcionam de forma idêntica nos dois backends — validado manualmente contra o bucket `arquivos` do Supabase antes de ir pra produção.

## Prisma: `DATABASE_URL` vs `DIRECT_URL`

`apps/api/prisma/schema.prisma` declara as duas (e `binaryTargets = ["native", "rhel-openssl-3.0.x", "linux-arm64-openssl-3.0.x", "debian-openssl-3.0.x"]`: o runtime das Functions, o container ARM64 do ECS e o Debian x64). Com quatro engines, o pacote da função `api` na Vercel ficou maior: confira no build do Project Supabase que a função continua abaixo do limite de tamanho da Vercel.

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- **RDS (deploy acadêmico)**: não há pooler — `DATABASE_URL` e `DIRECT_URL` são a mesma URL (porta 5432, `?sslmode=require`), geradas pelo Terraform no Secrets Manager.
- **Supabase (deploy real)**: `DATABASE_URL` usa o pooler **transaction** do Supavisor (porta `6543`, IPv4, `?pgbouncer=true`) para queries de runtime; `DIRECT_URL` usa o pooler **session** (porta `5432`) para `prisma migrate deploy`. O endpoint de conexão direta do Supabase (`db.<ref>.supabase.co:5432`) só resolve em IPv6 e **não é alcançável a partir do build da Vercel** — usar sempre os hosts `*.pooler.supabase.com`.

## Configuração manual dos Projects (passo a passo)

Ações que só o dono da conta Vercel pode fazer. Pré-requisito: `vercel login`, escopo `lucas-klemkes-projects`, branch com o `vercel.json` (hoje `feature/migracao-nestjs`). Esta seção vale para o Project `crm-advocacia-supabase`; o `crm-advocacia-pac` agora publica só a SPA e é configurado conforme [aws-terraform.md](aws-terraform.md#4-vercel-project-crm-advocacia-pac) (Root Directory `apps/web`, `VITE_WS_URL`, sem variáveis da API).

### 1. Vincular e ajustar o Project

Para `crm-advocacia-supabase`, em Settings → Build and Deployment:

- Root Directory `.`; Framework Preset **Other**; overrides de Build/Install/Output **desligados** (remover o antigo `next build`, herdado do preset Next.js); Node.js **24.x**.

Vincular o diretório local ao Project (na raiz do repositório); o vínculo fica em `.vercel/` (fora do git):

```bash
vercel link --project crm-advocacia-supabase --scope lucas-klemkes-projects --yes
```

### 2. Cadastrar as variáveis de ambiente

Em Settings → Environment Variables (ou `vercel env add <NOME> production`). As variáveis valem para os dois services. (No deploy acadêmico essas variáveis não ficam na Vercel: vão na task definition e no Secrets Manager, geradas pelo Terraform.)

| Variável | `crm-advocacia-supabase` | Ambientes |
|---|---|---|
| `DATABASE_URL` | Supavisor transaction, 6543, `?pgbouncer=true` | Production (+ Preview só com banco de preview) |
| `DIRECT_URL` | Supavisor session, 5432 | idem |
| `AUTH_SECRET` | `openssl rand -base64 32` (valor próprio) | Production, Preview |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 Connection do Supabase Storage | Production, Preview |
| `AWS_REGION` / `AWS_S3_BUCKET` | região do projeto Supabase / `arquivos` | Production, Preview |
| `AWS_S3_ENDPOINT` | endpoint S3 do Supabase Storage | Production, Preview |
| `AWS_S3_PREFIX` | `production` (Preview: `preview`) | Production, Preview |
| `UAZAPI_SERVER_URL` / `UAZAPI_ADMIN_TOKEN` | conta UAZAPI | Production, Preview |
| `TEMPO_REAL_HABILITADO` | **`false`** — Vercel Functions não mantêm processo vivo: sem polling, sem `/api/ws`, `GET /api/tempo-real/ticket` → 404 e a tela de campanha fica em "Atualização manual". Sem a variável a API já desliga sozinha quando `VERCEL` está definido (padrão da Vercel); o valor explícito fica como garantia e sempre prevalece | Production, Preview |
| `NEW_RELIC_LICENSE_KEY` | license key | Production |
| `NEW_RELIC_APP_NAME` | `crm-advocacia-api (supabase)` | Production |
| `NEW_RELIC_NO_CONFIG_FILE` | `true` | Production |
| `NEW_RELIC_LOG` | `stdout` | Production |
| `NEW_RELIC_DISTRIBUTED_TRACING_ENABLED` | `true` | Production |
| `NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED` | `true` | Production |
| `NODE_OPTIONS` | `--import=./dist/instrumentacao.mjs` | Production |

`API_PUBLIC_URL`, `UAZAPI_WEBHOOK_SECRET`, `WEB_ORIGINS` e `TEMPO_REAL_POLLING_MS` ficam **sem valor** no Supabase: sem `API_PUBLIC_URL` a API não registra webhook nas instâncias (e não sobrescreve o webhook de uma instância do deploy acadêmico). `VITE_WS_URL` também fica sem valor.

Notas:

- **`NODE_OPTIONS` e o New Relic.** Localmente a API sobe por `npm run start -w @crm/api`, cujo script carrega `--import ./dist/instrumentacao.mjs`. Na Vercel a função executa `dist/main.mjs` direto, sem o script `start`, então o agente só é carregado antes do Nest/Express/Prisma se a flag vier por `NODE_OPTIONS`. O caminho é relativo ao diretório de execução da função e precisa ser validado no spike (item 5 do critério de GO): sem dados no New Relic, ajustar caminho/valor. A app é ESM (`@nestjs/core` é `type: module`): se no spike não aparecerem transações no New Relic (só métricas de processo), a alternativa recomendada pelo agente é `--import newrelic/esm-loader.mjs` no lugar de `--import=./dist/instrumentacao.mjs`. No checklist do spike, conferir que aparecem transações nomeadas como `GET /api/clientes/:id`, e não só o processo. Só em Production (sem `NEW_RELIC_LICENSE_KEY` o agente nem é carregado). Nunca rodar `node dist/main.mjs` sozinho em nenhum ambiente: o New Relic não instrumenta.
- **Instâncias de WhatsApp por deploy.** A UAZAPI guarda uma URL de webhook por instância e a última que registrar vence. Cada deploy usa as próprias instâncias (os bancos já são separados; não reaproveite o token de uma instância nos dois). Webhooks antigos apontando para `POST /api/webhooks/uazapi` (sem assinatura) continuam recebendo 200 e não disparam nada.
- **`AUTH_SECRET`** é a chave HS256 do cookie `crm_sessao`; cada deploy tem a sua, e trocá-la invalida todas as sessões. O código ainda lê `NEXTAUTH_SECRET` como fallback, então `AUTH_SECRET` precisa estar definido antes de remover a variável antiga.
- O web não tem segredos: o Vite só embute variáveis `VITE_*`, e a única usada é `VITE_WS_URL` (origem do WebSocket; vazia = mesma origem). Referência em `apps/web/.env.example`.
- **Preview**: variáveis de banco só devem existir em Preview se apontarem para um banco de preview próprio. Sem `DATABASE_URL` de Preview o preview sobe, mas as rotas que tocam o banco falham.
- Nenhuma credencial é commitada. Local: `apps/api/.env` (fora do git, com `apps/api/.env.example` como referência e comentários por variável — ver [../database/docker-setup.md](../database/docker-setup.md)).

Exemplo (depois de `vercel link`):

```bash
vercel env add AUTH_SECRET production
vercel env add NEW_RELIC_LICENSE_KEY production
# ... demais variáveis da tabela
vercel env ls
```

Depois que o primeiro deploy novo estiver no ar, remover as variáveis herdadas do NextAuth (no `pac`, remover todas as variáveis da API, ver [aws-terraform.md](aws-terraform.md#4-vercel-project-crm-advocacia-pac)):

```bash
vercel env rm NEXTAUTH_SECRET production --yes
vercel env rm NEXTAUTH_URL production --yes
```

### 3. Spike de go/no-go (preview)

Vercel Services está em Beta. Antes de apontar produção, validar em preview a partir do Project `crm-advocacia-supabase`:

```bash
vercel link --project crm-advocacia-supabase --scope lucas-klemkes-projects --yes
vercel build && ls .vercel/output && cat .vercel/output/config.json | head -40
vercel deploy --prebuilt                                     # imprime $URL
curl -s "$URL/api/saude"                                     # esperado {"ok":true}
curl -s -o /dev/null -w "%{http_code}\n" "$URL/clientes"     # esperado 200 (deep link da SPA)
```

Com Deployment Protection ativa, acessar logado no navegador ou usar `vercel curl`.

**GO** se todos valerem:

1. `vercel build` termina sem erro nos dois services e a CLI aceita `services` e `entrypoint: dist/main.mjs`;
2. `.vercel/output` tem o estático do web e uma função para a api, e `config.json` tem a rota `/api/(.*)` e o catch-all;
3. `/api/saude` retorna `{"ok":true}` e o deep link retorna 200;
4. teste manual no preview: cadastro, login, criar cliente e upload de documento (URL assinada S3); cookie `crm_sessao` com `HttpOnly; Secure; SameSite=Lax` e nenhuma requisição cross-origin;
5. New Relic recebe dados da API (senão ajustar `NODE_OPTIONS`; isto, sozinho, não reprova o spike);
6. o build do service `web` ignora `apps/web/vercel.json` (config do Project `pac`) ou, se o ler, nada muda nas rotas públicas: conferir em `.vercel/output/config.json` que não aparece rewrite para `cloudfront.net` e que `/api/*` continua indo para o service `api`;
7. `GET /api/tempo-real/ticket` logado responde 404 (`TEMPO_REAL_HABILITADO=false`).

**NO-GO** se a CLI recusar `services` (plano/beta), recusar o `entrypoint`, ou o runtime não subir o bundle. Nesse caso, seguir o plano B.

### 4. Migrations e rollback

Supabase: migrations rodam no `vercel-build` do service `api`, só com `VERCEL_ENV=production`, contra `DIRECT_URL`; falha de migration falha o build e nada é publicado. Rollback: `vercel rollback` (ou Instant Rollback no painel) volta web e api juntos; **o schema não volta**. AWS: migrations rodam numa task avulsa antes do rollout (ver "Pipeline de deploy"). Toda mudança de schema segue expand/contract (só acrescentar; remover colunas/tabelas em PR posterior). Detalhes na seção "Rollback" e em [../database/migrations-prisma.md](../database/migrations-prisma.md).

### 5. Plano B (só se o spike reprovar): dois Projects

1. Criar `crm-advocacia-supabase-api` (Root Directory `apps/api`) e repontar o Project atual para o web (Root Directory `apps/web`). Variáveis de banco, S3, UAZAPI, AUTH e New Relic migram para o Project `-api`; o Project web recebe só `API_ORIGEM` (ex.: `https://crm-advocacia-supabase-api.vercel.app`), definida por ambiente (Production/Preview).
2. Apagar o `vercel.json` da raiz e criar a config do web. Atenção: `apps/web/vercel.json` já existe (é do Project `pac`, com o rewrite para o CloudFront) e só pode haver um arquivo de config por diretório; seria preciso trocá-lo por um `apps/web/vercel.ts` que escolhe o destino por `API_ORIGEM` nos dois Projects (no `pac`, `API_ORIGEM` = URL do CloudFront). Esboço:

```ts
import { routes, type VercelConfig } from "@vercel/config/v1";

// Plano B (sem Vercel Services): o web faz proxy de /api/* para o Project da API,
// mantendo mesma origem no browser (cookie first-party, sem CORS).
const apiOrigem = process.env.API_ORIGEM;
if (!apiOrigem) {
  throw new Error("API_ORIGEM não definida neste Project (ex.: https://crm-advocacia-supabase-api.vercel.app)");
}

export const config: VercelConfig = {
  framework: "vite",
  installCommand: "cd ../.. && npm ci",
  buildCommand: "npm run build",
  outputDirectory: "dist",
  rewrites: [
    routes.rewrite("/api/(.*)", `${apiOrigem}/api/$1`),
    routes.rewrite("/(.*)", "/index.html"),
  ],
};
```

3. Criar `apps/api/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nestjs",
  "installCommand": "cd ../.. && npm ci",
  "buildCommand": "npm run vercel-build"
}
```

4. A detecção zero-config procura `src/main.ts` primeiro e o compilaria sem resolver `@dominio/*`. Renomear `apps/api/src/main.ts` para `apps/api/src/servidor.ts`; no `tsup.config.ts` trocar `entry: { main: "src/main.ts" }` por `entry: { server: "src/servidor.ts" }` (mantendo a entrada `instrumentacao`) e `outDir: "dist"` por `outDir: "."` com `clean: false`. O resultado é `apps/api/server.js` (na lista de detecção `server.{js,mjs}`). Ajustar o `start` para `node --enable-source-maps --import ./instrumentacao.js server.js`, acrescentar `/apps/api/server.js*` ao `.gitignore` e atualizar as referências a `dist/main.mjs` e `dist/instrumentacao.mjs` (Playwright, scripts, `NODE_OPTIONS`).
5. `npm i -D @vercel/config -w @crm/web` (versão publicada há pelo menos 2 semanas).
6. Custo: previews do web apontam para a `API_ORIGEM` de Preview (definir uma api de preview fixa); o rollback passa a ser nos dois Projects, api primeiro.

## Pipeline de deploy

1. **Push/PR** (base `dev` ou `main`): GitHub Actions (`.github/workflows/ci.yml`) roda os jobs `lint e typecheck`, `testes com cobertura` (thresholds por camada e piso institucional, ver [../testes/estrategia-tdd.md](../testes/estrategia-tdd.md)), `e2e (build de produção)`, `SonarCloud` e `terraform (fmt e validate)`. PRs que tocam `infra/**` ou `apps/api/**` também rodam `infra-plan.yml` (`terraform plan` por OIDC, nunca `apply`, resumo no job). Setup e proteção de branch em [../qualidade/analise-estatica.md](../qualidade/analise-estatica.md).
2. **Merge em `main`** (via PR, squash — ver [../git/commits-e-branches.md](../git/commits-e-branches.md)): a Vercel builda os dois Projects em paralelo e o GitHub Actions roda o `deploy-aws.yml`.
3. **Supabase (Vercel Services)**: o service `web` roda `npm run build` (`tsc` + `vite build`). O service `api` roda `npm run vercel-build` = `prisma generate` → `scripts/migrar-no-deploy.mjs` → `tsup`. O script aplica `prisma migrate deploy` **somente quando `VERCEL_ENV=production`** (`DIRECT_URL`). Previews nunca migram. Migration que falha derruba o build e nada é publicado. Nunca `migrate dev` em produção, ver [../database/migrations-prisma.md](../database/migrations-prisma.md).
4. **Acadêmico**: a Vercel builda só a SPA (`apps/web/vercel.json`). O `deploy-aws.yml` (OIDC, sem chave AWS) builda a imagem ARM64 → push no ECR com tag = SHA → `terraform apply` só da task definition → `aws ecs run-task` com `prisma migrate deploy` (exige exit 0) → `terraform apply` completo → `aws ecs wait services-stable` → `scripts/deploy/verificar-rollout.sh` (falha se o circuit breaker voltou à revisão anterior) → smoke em `/api/saude`. Detalhes em [aws-terraform.md](aws-terraform.md#3-primeiro-deploy).
5. A Vercel publica os deployments; deployments anteriores ficam disponíveis para rollback instantâneo.

## Rollback

- **Aplicação (Supabase)**: `vercel rollback` ou "Instant Rollback" no painel. Volta **web e api juntos**; não afeta o deploy acadêmico.
- **Aplicação (acadêmico)**: a SPA volta pelo Instant Rollback do Project `pac`; a API volta com **"Re-run all jobs"** no run antigo do `deploy-aws.yml` daquele commit (o `workflow_dispatch` só roda na `main`, no commit mais recente; o re-run reaplica também o Terraform daquele SHA, então a infra pode voltar junto) ou com um `git revert` na `main`, e o circuit breaker do ECS já volta sozinho se a task nova não ficar saudável. Os dois lados são independentes: confira se a SPA antiga é compatível com a API do momento.
- **Banco**: migrations não têm rollback automático (Prisma não gera "down"). Toda mudança de schema segue **expand/contract**: a migration do PR só acrescenta (coluna nullable, tabela nova), e a remoção do que ficou obsoleto entra num PR posterior. Nos dois deploys a migration roda **antes** de a versão nova entrar no ar, enquanto a anterior ainda atende, e voltar o app nunca volta o schema: a migration precisa servir às duas versões. Reverter um schema de fato exige uma migration corretiva nova, aplicada da mesma forma — ver a política completa em [../database/migrations-prisma.md](../database/migrations-prisma.md).

## Observabilidade pós-deploy

Todo deploy em produção é acompanhado pelo New Relic (latência e taxa de erro por rota da API), pelos Runtime Logs/Observability da Vercel (Supabase) e pelo CloudWatch Logs `/ecs/crm-pac-api` (acadêmico) — ver [../qualidade/observabilidade.md](../qualidade/observabilidade.md). Um pico de erro logo após deploy é o primeiro sinal para rollback. O `NotificacaoScheduler` (Lambda + EventBridge, ver [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md)) ainda não está implementado em nenhum dos dois ambientes.
