# Deploy

Instruções de deploy exigidas pela documentação mínima da linha Web Apps ([directions-webapp.md](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-webapp.md)). Complementa [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md) (decisão de stack) e [../database/docker-setup.md](../database/docker-setup.md) (banco local).

## Por que dois deploys de produção

O curso (PAC Extensionista VII, Católica SC) exige um ambiente público e estável, mas **não permite Supabase** como parte da stack avaliada. Ao mesmo tempo, o produto nasceu de uma necessidade real (escritório do Dr. Lucas Quintino) e a versão que vai pro cliente final prioriza velocidade/DX, o que torna Supabase a escolha certa para produção de verdade. Em vez de escolher um dos dois, o projeto mantém **os dois em paralelo**, a partir do mesmo código-fonte:

| Deploy | Backend | Público |
|---|---|---|
| `crm-advocacia-pac` | Amazon RDS (PostgreSQL) + Amazon S3 | Avaliação acadêmica (professor/banca) |
| `crm-advocacia-supabase` | Supabase (PostgreSQL) + Supabase Storage | Cliente final / produção real |

Nenhum dos dois é "o ambiente de teste do outro" — ambos rodam a mesma `main`, migrada e com dados próprios; é o par de bancos/buckets configurado por variável de ambiente que muda, nunca o código.

## Ambientes

| Ambiente | App | Banco | Storage | Uso |
|---|---|---|---|---|
| Local (desenvolvimento) | `next dev` na máquina do desenvolvedor | PostgreSQL via Docker Compose ou RDS direto ([docker-setup.md](../database/docker-setup.md)) | Conforme `.env.local` | Dia a dia de desenvolvimento e TDD |
| Produção — acadêmico | Vercel, Project `crm-advocacia-pac` | Amazon RDS (PostgreSQL) | Amazon S3 | Ambiente apresentado à disciplina — sem dependência de Supabase |
| Produção — real | Vercel, Project `crm-advocacia-supabase` | Supabase (PostgreSQL, via Supavisor pooler) | Supabase Storage (API S3-compatível) | Uso pelo escritório/cliente final |

Não há ambiente de staging separado — os dois Projects de produção fazem esse papel entre si (mudança arriscada pode ser validada primeiro no deploy acadêmico, de menor risco, antes de refletir no de produção real), complementado pelos gates de CI (testes, cobertura, SonarCloud) antes do merge em `main`.

## Hosting: um repositório, dois Vercel Projects

Os dois deploys **não são branches diferentes** — isso faria o código divergir com o tempo. Em vez disso:

- Dois Vercel Projects (`crm-advocacia-pac` e `crm-advocacia-supabase`) apontam pro mesmo repositório GitHub (`LucasKlemke/crm-advocacia`).
- Ambos têm `main` como Production Branch — um único push dispara os dois builds.
- O comportamento diverge só por **variáveis de ambiente**, configuradas separadamente por Project em Settings → Environment Variables no painel da Vercel (ou via `vercel env add --scope lucas-klemkes-projects`, linkando o diretório local a cada Project com `vercel link --project <nome>`).
- Nenhuma lógica de aplicação faz `if (ambiente === 'aws')` — a "escolha" de backend acontece inteiramente nas env vars (ver seção seguinte).

## S3Client compatível com múltiplos provedores

`src/lib/external/s3-client.ts` é o único ponto de contato com armazenamento de arquivos (RN17/RN18, ver [../produto/regras-negocio.md](../produto/regras-negocio.md)). Em vez de manter duas implementações (uma AWS, uma Supabase), o mesmo client usa o `@aws-sdk/client-s3` apontado para um endpoint customizável:

- **Sem `AWS_S3_ENDPOINT`** → o SDK usa o endpoint padrão da AWS (comportamento do deploy acadêmico).
- **Com `AWS_S3_ENDPOINT`** → o client usa esse endpoint com `forcePathStyle: true`, funcionando contra qualquer storage S3-compatível — é assim que o deploy de produção real aponta pro Supabase Storage (`https://<project-ref>.storage.supabase.co/storage/v1/s3`), usando as credenciais Access Key/Secret geradas em Supabase → Storage → S3 Connection.

Upload (URL assinada de PUT), download (URL assinada de GET, com `Content-Disposition`), leitura de stream (usada no zip de múltiplos documentos) e exclusão funcionam de forma idêntica nos dois backends — validado manualmente contra o bucket `arquivos` do Supabase antes de ir pra produção.

## Prisma: `DATABASE_URL` vs `DIRECT_URL`

`prisma/schema.prisma` declara as duas:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- **RDS (deploy acadêmico)**: não há pooler — `DATABASE_URL` e `DIRECT_URL` apontam pro mesmo host/porta 5432.
- **Supabase (deploy real)**: `DATABASE_URL` usa o pooler **transaction** do Supavisor (porta `6543`, IPv4, `?pgbouncer=true`) para queries de runtime; `DIRECT_URL` usa o pooler **session** (porta `5432`) para `prisma migrate deploy`. O endpoint de conexão direta do Supabase (`db.<ref>.supabase.co:5432`) só resolve em IPv6 e **não é alcançável a partir do build da Vercel** — usar sempre os hosts `*.pooler.supabase.com`.

## Variáveis de ambiente (por Vercel Project)

| Variável | `crm-advocacia-pac` (AWS) | `crm-advocacia-supabase` |
|---|---|---|
| `DATABASE_URL` | RDS, porta 5432 | Supabase pooler transaction, porta 6543, `?pgbouncer=true` |
| `DIRECT_URL` | igual a `DATABASE_URL` | Supabase pooler session, porta 5432 |
| `NEXTAUTH_SECRET` | valor próprio | valor próprio |
| `NEXTAUTH_URL` | URL pública do deploy acadêmico | URL pública do deploy de produção |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM user com acesso ao bucket S3 | Access Key/Secret do Supabase Storage (S3 Connection) |
| `AWS_REGION` | região do bucket S3 | região do projeto Supabase |
| `AWS_S3_BUCKET` | nome do bucket S3 | `arquivos` |
| `AWS_S3_ENDPOINT` | não definida | endpoint S3-compatível do Supabase Storage |
| `AWS_S3_PREFIX` | prefixo de ambiente (ex. `production`) | prefixo de ambiente |

Nenhuma dessas credenciais é commitada; produção usa o gerenciador de variáveis da Vercel, local usa `.env.local` (fora do controle de versão, com `.env.example` como referência e comentários explicando cada variável — ver [../database/docker-setup.md](../database/docker-setup.md)).

## Pipeline de deploy

1. **Push/PR** → GitHub Actions roda lint, `npm test -- --coverage` (gate de cobertura, ver [../testes/estrategia-tdd.md](../testes/estrategia-tdd.md)), Playwright, e o scan do SonarCloud.
2. **Merge em `main`** (via PR, squash — ver [../git/commits-e-branches.md](../git/commits-e-branches.md)) → GitHub notifica os dois Vercel Projects, que buildam em paralelo.
3. **Build de cada Project** roda `npm run build`, que é `prisma migrate deploy && next build` — aplica migrations pendentes no banco daquele Project (RDS ou Supabase, conforme `DATABASE_URL`/`DIRECT_URL`) antes de buildar a aplicação. Nunca `migrate dev` em produção, ver [../database/migrations-prisma.md](../database/migrations-prisma.md).
4. Vercel publica a nova versão via CDN em cada Project; deploys anteriores ficam disponíveis para rollback instantâneo.

## Rollback

- **Aplicação**: `vercel rollback` (CLI) ou "Promote to Production" num deployment anterior direto no painel da Vercel — por Project, independente um do outro.
- **Banco de dados**: migrations não têm rollback automático (Prisma não gera "down"). Reverter uma mudança de schema exige uma nova migration corretiva, aplicada da mesma forma (`prisma migrate deploy`) — ver a política completa em [../database/migrations-prisma.md](../database/migrations-prisma.md). Nunca reverter o app para uma versão de código incompatível com o schema já migrado em produção. Como os dois Projects têm bancos independentes, uma migration problemática só afeta o banco em que rodou — mas ainda assim é aplicada aos dois no próximo merge em `main`, já que compartilham o mesmo histórico de `prisma/migrations/`.

## Observabilidade pós-deploy

Todo deploy em produção é acompanhado pelo dashboard de New Relic (latência, taxa de erro por rota) — ver [../qualidade/observabilidade.md](../qualidade/observabilidade.md). Um pico de erro logo após deploy é o primeiro sinal para rollback. O `NotificacaoScheduler` (Lambda + EventBridge, ver [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md)) ainda não está implementado nem provisionado em nenhum dos dois ambientes.
