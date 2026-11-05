# Deploy

Instruções de deploy exigidas pela documentação mínima da linha Web Apps ([directions-webapp.md](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-webapp.md)). Complementa [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md) (decisão de stack) e [../database/docker-setup.md](../database/docker-setup.md) (banco local).

## Por que dois deploys de produção

O curso (PAC Extensionista VII, Católica SC) exige um ambiente público e estável, mas **não permite Supabase** como parte da stack avaliada. Ao mesmo tempo, o produto nasceu de uma necessidade real (escritório do Dr. Lucas Quintino) e a versão que vai pro cliente final prioriza velocidade/DX, o que torna Supabase a escolha certa para produção de verdade. O projeto mantém **os dois em paralelo**, a partir do mesmo código-fonte:

| Deploy | Backend | Público |
|---|---|---|
| `crm-advocacia-pac` | Amazon RDS (PostgreSQL) + Amazon S3 | Avaliação acadêmica (professor/banca) |
| `crm-advocacia-supabase` | Supabase (PostgreSQL) + Supabase Storage | Cliente final / produção real |

Nenhum dos dois é "o ambiente de teste do outro" — ambos rodam a mesma `main`, migrada e com dados próprios; é o par de bancos/buckets configurado por variável de ambiente que muda, nunca o código.

## Ambientes

| Ambiente | App | Banco | Storage | Uso |
|---|---|---|---|---|
| Local (desenvolvimento) | `npm run dev` (API :3001 + web :5173) | PostgreSQL via Docker Compose ou RDS direto ([docker-setup.md](../database/docker-setup.md)) | Conforme `apps/api/.env.local` | Dia a dia de desenvolvimento e TDD |
| Produção — acadêmico | Vercel, Project `crm-advocacia-pac` (web + api) | Amazon RDS (PostgreSQL) | Amazon S3 | Ambiente apresentado à disciplina — sem dependência de Supabase |
| Produção — real | Vercel, Project `crm-advocacia-supabase` (web + api) | Supabase (PostgreSQL, via Supavisor pooler) | Supabase Storage (API S3-compatível) | Uso pelo escritório/cliente final |

Não há ambiente de staging separado — os dois Projects de produção fazem esse papel entre si (mudança arriscada pode ser validada primeiro no deploy acadêmico, de menor risco, antes de refletir no de produção real), complementado pelos gates de CI (testes, cobertura, SonarCloud) antes do merge em `main`.

## Topologia: um Project por ambiente, dois services por deployment

Cada Project usa **Vercel Services** (`vercel.json` na raiz; recurso em Beta — ver o spike de go/no-go e o plano B na seção de configuração manual). Todo deployment publica juntos:

| Service | Raiz | Framework | Build | Executa como |
|---|---|---|---|---|
| `web` | `apps/web` | Vite | `npm run build` → `dist/` | Estático na CDN, com fallback de SPA para `index.html` |
| `api` | `apps/api` | NestJS | `npm run vercel-build` → `dist/main.js` (tsup) | Uma Vercel Function em Fluid Compute (`entrypoint: dist/main.js`) |

Rotas públicas (ordem importa): `/api/*` vai para `api`, que recebe o path original e usa o prefixo global `api` do Nest, e todo o resto vai para `web`. Consequências:

- **Mesma origem**: o cookie de sessão `crm_sessao` (httpOnly, Secure, SameSite=Lax) é first-party, sem CORS e sem cookie cross-site.
- **Deploy e rollback atômicos**: web e api de um deployment sempre são da mesma versão. Nunca há front novo falando com API velha.
- **Preview coerente**: cada PR ganha um preview com o próprio web e a própria api.

Os dois Projects **não são branches diferentes** (o código divergiria com o tempo): apontam pro mesmo repositório (`LucasKlemke/crm-advocacia`), com `main` como Production Branch e Root Directory `.`. Um push em `main` dispara os dois builds. O comportamento diverge só por **variáveis de ambiente**; nenhuma lógica de aplicação faz `if (ambiente === 'aws')`.

## S3Client compatível com múltiplos provedores

`apps/api/src/dominio/lib/external/s3-client.ts` é o único ponto de contato com armazenamento de arquivos (RN17/RN18, ver [../produto/regras-negocio.md](../produto/regras-negocio.md)). Em vez de manter duas implementações (uma AWS, uma Supabase), o mesmo client usa o `@aws-sdk/client-s3` apontado para um endpoint customizável:

- **Sem `AWS_S3_ENDPOINT`** → o SDK usa o endpoint padrão da AWS (comportamento do deploy acadêmico).
- **Com `AWS_S3_ENDPOINT`** → o client usa esse endpoint com `forcePathStyle: true`, funcionando contra qualquer storage S3-compatível — é assim que o deploy de produção real aponta pro Supabase Storage (`https://<project-ref>.storage.supabase.co/storage/v1/s3`), usando as credenciais Access Key/Secret geradas em Supabase → Storage → S3 Connection.

Upload (URL assinada de PUT), download (URL assinada de GET, com `Content-Disposition`), leitura de stream (usada no zip de múltiplos documentos) e exclusão funcionam de forma idêntica nos dois backends — validado manualmente contra o bucket `arquivos` do Supabase antes de ir pra produção.

## Prisma: `DATABASE_URL` vs `DIRECT_URL`

`apps/api/prisma/schema.prisma` declara as duas (e `binaryTargets = ["native", "rhel-openssl-3.0.x"]` para o runtime das Functions):

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- **RDS (deploy acadêmico)**: não há pooler — `DATABASE_URL` e `DIRECT_URL` apontam pro mesmo host/porta 5432.
- **Supabase (deploy real)**: `DATABASE_URL` usa o pooler **transaction** do Supavisor (porta `6543`, IPv4, `?pgbouncer=true`) para queries de runtime; `DIRECT_URL` usa o pooler **session** (porta `5432`) para `prisma migrate deploy`. O endpoint de conexão direta do Supabase (`db.<ref>.supabase.co:5432`) só resolve em IPv6 e **não é alcançável a partir do build da Vercel** — usar sempre os hosts `*.pooler.supabase.com`.

## Configuração manual dos Projects (passo a passo)

Ações que só o dono da conta Vercel pode fazer. Pré-requisito: `vercel login`, escopo `lucas-klemkes-projects`, branch com o `vercel.json` (hoje `feature/migracao-nestjs`).

### 1. Vincular e ajustar os dois Projects

Para `crm-advocacia-pac` e `crm-advocacia-supabase`, em Settings → Build and Deployment:

- Root Directory `.`; Framework Preset **Other**; overrides de Build/Install/Output **desligados** (remover o antigo `next build`, herdado do preset Next.js); Node.js **24.x**.

Vincular o diretório local a um Project por vez (na raiz do repositório); o vínculo fica em `.vercel/` (fora do git):

```bash
vercel link --project crm-advocacia-pac --scope lucas-klemkes-projects --yes
```

Para o outro Project, repetir com `--project crm-advocacia-supabase`.

### 2. Cadastrar as variáveis de ambiente

Em Settings → Environment Variables (ou `vercel env add <NOME> production`), uma vez por Project. As variáveis valem para os dois services.

| Variável | `crm-advocacia-pac` (AWS) | `crm-advocacia-supabase` | Ambientes |
|---|---|---|---|
| `DATABASE_URL` | RDS, porta 5432 | Supavisor transaction, 6543, `?pgbouncer=true` | Production (+ Preview só com banco de preview) |
| `DIRECT_URL` | igual a `DATABASE_URL` | Supavisor session, 5432 | idem |
| `AUTH_SECRET` | `openssl rand -base64 32` (valor próprio) | valor próprio | Production, Preview |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM user com acesso ao bucket S3 | S3 Connection do Supabase Storage | Production, Preview |
| `AWS_REGION` / `AWS_S3_BUCKET` | região/bucket S3 | região do projeto Supabase / `arquivos` | Production, Preview |
| `AWS_S3_ENDPOINT` | não definida | endpoint S3 do Supabase Storage | Production, Preview |
| `AWS_S3_PREFIX` | `production` (Preview: `preview`) | idem | Production, Preview |
| `UAZAPI_SERVER_URL` / `UAZAPI_ADMIN_TOKEN` | conta UAZAPI | mesma conta | Production, Preview |
| `NEW_RELIC_LICENSE_KEY` | license key | license key | Production |
| `NEW_RELIC_APP_NAME` | `crm-advocacia-api (pac)` | `crm-advocacia-api (supabase)` | Production |
| `NEW_RELIC_NO_CONFIG_FILE` | `true` | `true` | Production |
| `NEW_RELIC_LOG` | `stdout` | `stdout` | Production |
| `NEW_RELIC_DISTRIBUTED_TRACING_ENABLED` | `true` | `true` | Production |
| `NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED` | `true` | `true` | Production |
| `NODE_OPTIONS` | `--import=./dist/instrumentacao.js` | idem | Production |

Notas:

- **`NODE_OPTIONS` e o New Relic.** Localmente a API sobe por `npm run start -w @crm/api`, cujo script carrega `--import ./dist/instrumentacao.js`. Na Vercel a função executa `dist/main.js` direto, sem o script `start`, então o agente só é carregado antes do Nest/Express/Prisma se a flag vier por `NODE_OPTIONS`. O caminho é relativo ao diretório de execução da função e precisa ser validado no spike (item 5 do critério de GO): sem dados no New Relic, ajustar caminho/valor. A app é ESM (`@nestjs/core` é `type: module`): se no spike não aparecerem transações no New Relic (só métricas de processo), a alternativa recomendada pelo agente é `--import newrelic/esm-loader.mjs` no lugar de `--import=./dist/instrumentacao.js`. No checklist do spike, conferir que aparecem transações nomeadas como `GET /api/clientes/:id`, e não só o processo. Só em Production (sem `NEW_RELIC_LICENSE_KEY` o agente nem é carregado). Nunca rodar `node dist/main.js` sozinho em nenhum ambiente: o New Relic não instrumenta.
- **`AUTH_SECRET`** é a chave HS256 do cookie `crm_sessao`; cada Project tem a sua, e trocá-la invalida todas as sessões. O código ainda lê `NEXTAUTH_SECRET` como fallback, então `AUTH_SECRET` precisa estar definido antes de remover a variável antiga.
- O web não tem segredos: o Vite só embute variáveis `VITE_*`, e nenhuma é usada.
- **Preview**: variáveis de banco só devem existir em Preview se apontarem para um banco de preview próprio. Sem `DATABASE_URL` de Preview o preview sobe, mas as rotas que tocam o banco falham.
- Nenhuma credencial é commitada. Local: `apps/api/.env` / `apps/api/.env.local` (fora do git, com `apps/api/.env.example` como referência e comentários por variável — ver [../database/docker-setup.md](../database/docker-setup.md)).

Exemplo (um Project por vez, depois de `vercel link`):

```bash
vercel env add AUTH_SECRET production
vercel env add NEW_RELIC_LICENSE_KEY production
# ... demais variáveis da tabela
vercel env ls
```

Depois que o primeiro deploy novo estiver no ar, remover as variáveis herdadas do NextAuth, em cada Project:

```bash
vercel env rm NEXTAUTH_SECRET production --yes
vercel env rm NEXTAUTH_URL production --yes
```

### 3. Spike de go/no-go (preview)

Vercel Services está em Beta. Antes de apontar produção, validar em preview a partir do Project `crm-advocacia-pac`:

```bash
vercel link --project crm-advocacia-pac --scope lucas-klemkes-projects --yes
vercel build && ls .vercel/output && cat .vercel/output/config.json | head -40
vercel deploy --prebuilt                                     # imprime $URL
curl -s "$URL/api/saude"                                     # esperado {"ok":true}
curl -s -o /dev/null -w "%{http_code}\n" "$URL/clientes"     # esperado 200 (deep link da SPA)
```

Com Deployment Protection ativa, acessar logado no navegador ou usar `vercel curl`.

**GO** se todos valerem:

1. `vercel build` termina sem erro nos dois services e a CLI aceita `services` e `entrypoint: dist/main.js`;
2. `.vercel/output` tem o estático do web e uma função para a api, e `config.json` tem a rota `/api/(.*)` e o catch-all;
3. `/api/saude` retorna `{"ok":true}` e o deep link retorna 200;
4. teste manual no preview do `pac`: cadastro, login, criar cliente e upload de documento (URL assinada S3); cookie `crm_sessao` com `HttpOnly; Secure; SameSite=Lax` e nenhuma requisição cross-origin;
5. New Relic recebe dados da API (senão ajustar `NODE_OPTIONS`; isto, sozinho, não reprova o spike).

**NO-GO** se a CLI recusar `services` (plano/beta), recusar o `entrypoint`, ou o runtime não subir o bundle. Nesse caso, seguir o plano B.

### 4. Migrations e rollback

Migrations rodam no `vercel-build` do service `api`, só com `VERCEL_ENV=production`, contra `DIRECT_URL`; falha de migration falha o build e nada é publicado. Rollback: `vercel rollback` (ou Instant Rollback no painel), por Project, volta web e api juntos; **o schema não volta**. Toda mudança de schema segue expand/contract (só acrescentar; remover colunas/tabelas em PR posterior). Detalhes na seção "Rollback" e em [../database/migrations-prisma.md](../database/migrations-prisma.md).

### 5. Plano B (só se o spike reprovar): dois Projects por ambiente

1. Criar `crm-advocacia-pac-api` e `crm-advocacia-supabase-api` (Root Directory `apps/api`) e repontar os Projects atuais para o web (Root Directory `apps/web`). Variáveis de banco, S3, UAZAPI, AUTH e New Relic migram para os Projects `-api`; os Projects web recebem só `API_ORIGEM` (ex.: `https://crm-advocacia-pac-api.vercel.app`), definida por ambiente (Production/Preview).
2. Apagar o `vercel.json` da raiz e criar `apps/web/vercel.ts`:

```ts
import { routes, type VercelConfig } from "@vercel/config/v1";

// Plano B (sem Vercel Services): o web faz proxy de /api/* para o Project da API,
// mantendo mesma origem no browser (cookie first-party, sem CORS).
const apiOrigem = process.env.API_ORIGEM;
if (!apiOrigem) {
  throw new Error("API_ORIGEM não definida neste Project (ex.: https://crm-advocacia-pac-api.vercel.app)");
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

4. A detecção zero-config procura `src/main.ts` primeiro e o compilaria sem resolver `@dominio/*`. Renomear `apps/api/src/main.ts` para `apps/api/src/servidor.ts`; no `tsup.config.ts` trocar `entry: { main: "src/main.ts" }` por `entry: { server: "src/servidor.ts" }` (mantendo a entrada `instrumentacao`) e `outDir: "dist"` por `outDir: "."` com `clean: false`. O resultado é `apps/api/server.js` (na lista de detecção `server.{js,mjs}`). Ajustar o `start` para `node --enable-source-maps --import ./instrumentacao.js server.js`, acrescentar `/apps/api/server.js*` ao `.gitignore` e atualizar as referências a `dist/main.js` e `dist/instrumentacao.js` (Playwright, scripts, `NODE_OPTIONS`).
5. `npm i -D @vercel/config -w @crm/web` (versão publicada há pelo menos 2 semanas).
6. Custo: previews do web apontam para a `API_ORIGEM` de Preview (definir uma api de preview fixa); o rollback passa a ser nos dois Projects, api primeiro.

## Pipeline de deploy

1. **Push/PR** (base `dev` ou `main`): GitHub Actions (`.github/workflows/ci.yml`) roda os jobs `lint e typecheck`, `testes com cobertura` (thresholds por camada e piso institucional, ver [../testes/estrategia-tdd.md](../testes/estrategia-tdd.md)), `e2e (build de produção)` e `SonarCloud`. Setup e proteção de branch em [../qualidade/analise-estatica.md](../qualidade/analise-estatica.md).
2. **Merge em `main`** (via PR, squash — ver [../git/commits-e-branches.md](../git/commits-e-branches.md)): a Vercel builda os dois Projects em paralelo.
3. **Build de cada Project**: o service `web` roda `npm run build` (`tsc` + `vite build`). O service `api` roda `npm run vercel-build` = `prisma generate` → `scripts/migrar-no-deploy.mjs` → `tsup`. O script aplica `prisma migrate deploy` **somente quando `VERCEL_ENV=production`**, no banco daquele Project (`DIRECT_URL`). Previews nunca migram. Migration que falha derruba o build e nada é publicado. Nunca `migrate dev` em produção, ver [../database/migrations-prisma.md](../database/migrations-prisma.md).
4. A Vercel publica o deployment (web na CDN, api como Function). Deployments anteriores ficam disponíveis para rollback instantâneo.

## Rollback

- **Aplicação**: `vercel rollback` ou "Instant Rollback" no painel, por Project. Volta **web e api juntos**; um Project não afeta o outro.
- **Banco**: migrations não têm rollback automático (Prisma não gera "down"). Toda mudança de schema segue **expand/contract**: a migration do PR só acrescenta (coluna nullable, tabela nova), e a remoção do que ficou obsoleto entra num PR posterior. Assim, voltar o app para o deployment anterior nunca o deixa incompatível com o schema já migrado. Reverter um schema de fato exige uma migration corretiva nova, aplicada da mesma forma — ver a política completa em [../database/migrations-prisma.md](../database/migrations-prisma.md).

## Observabilidade pós-deploy

Todo deploy em produção é acompanhado pelo New Relic (latência e taxa de erro por rota da API) e pelos Runtime Logs/Observability da Vercel — ver [../qualidade/observabilidade.md](../qualidade/observabilidade.md). Um pico de erro logo após deploy é o primeiro sinal para rollback. O `NotificacaoScheduler` (Lambda + EventBridge, ver [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md)) ainda não está implementado em nenhum dos dois ambientes.
