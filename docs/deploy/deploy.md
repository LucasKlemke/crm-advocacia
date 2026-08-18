# Deploy

Instruções de deploy exigidas pela documentação mínima da linha Web Apps ([directions-webapp.md](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-webapp.md)). Complementa [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md) (decisão de stack) e [../database/docker-setup.md](../database/docker-setup.md) (banco local).

## Ambientes

| Ambiente | App | Banco | Uso |
|---|---|---|---|
| Local (desenvolvimento) | `next dev` na máquina do desenvolvedor | PostgreSQL via Docker Compose ([docker-setup.md](../database/docker-setup.md)) | Dia a dia de desenvolvimento e TDD |
| Produção | AWS Amplify Hosting | Amazon RDS (PostgreSQL) | Ambiente público, acessível para avaliação (requisito da disciplina: "acesso público e estável, sem depender de notebook pessoal ou ambiente local") |

Não há ambiente de staging separado neste estágio do projeto — dado o volume esperado (1.000 clientes / 5.000 casos por escritório) e o formato de portfólio individual, produção é o único ambiente hospedado; validações antes de deploy acontecem localmente e via os gates de CI (testes, cobertura, SonarCloud).

## O que exatamente roda no AWS Amplify

O Amplify é usado **apenas como hosting/build/deploy** da aplicação Next.js (build do App Router, SSR/SSG, distribuição via CDN, SSL automático) — não os recursos de backend automatizado do Amplify (Auth, DataStore, API GraphQL gerenciada). Autenticação (NextAuth.js), banco (RDS + Prisma), storage (S3) e jobs assíncronos (Lambda + EventBridge) são geridos e versionados explicitamente pelo próprio projeto, não provisionados automaticamente pelo Amplify. Isso mantém controle total sobre a arquitetura, alinhado ao núcleo comum de engenharia da disciplina.

## Infraestrutura necessária (provisionada manualmente, fora do repositório de app)

- **Amazon RDS** — instância PostgreSQL, mesma região do Amplify para minimizar latência.
- **Amazon S3** — bucket para documentos anexados a casos (ver RN17/RN18 em [../produto/regras-negocio.md](../produto/regras-negocio.md)).
- **AWS Lambda + Amazon EventBridge Scheduler** — `NotificacaoScheduler`, roda periodicamente independente da aplicação web (ver [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md)).
- **Credenciais Uazapi** — conexão WhatsApp por escritório (fora do escopo deste repositório; gerenciadas pelo próprio tenant via QR Code).
- **Servidor SMTP** — para `EmailClient` (alertas de prazo, e-mails transacionais).

## Variáveis de ambiente (produção, configuradas no Amplify)

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Connection string do RDS, formato Postgres (mesmo shape do `.env` local, credenciais/host diferentes) |
| `NEXTAUTH_SECRET` | Assinatura do JWT de sessão |
| `NEXTAUTH_URL` | URL pública da aplicação |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (ou IAM role do Amplify) | Acesso a S3 para upload/URL assinada de documentos |
| `S3_BUCKET_NAME` | Bucket de documentos |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | `EmailClient` |
| `SONAR_TOKEN` | Usado apenas no pipeline de CI (GitHub Actions), não em runtime da app — ver [../qualidade/analise-estatica.md](../qualidade/analise-estatica.md) |
| `NEW_RELIC_LICENSE_KEY` | Agente de APM — ver [../qualidade/observabilidade.md](../qualidade/observabilidade.md) |

Nenhuma dessas credenciais é commitada; produção usa o gerenciador de variáveis do Amplify, local usa `.env` (fora do controle de versão, com `.env.example` como referência — ver [docker-setup.md](../database/docker-setup.md)).

## Pipeline de deploy

1. **Push/PR** → GitHub Actions roda lint, `npm test -- --coverage` (gate de cobertura, ver [../testes/estrategia-tdd.md](../testes/estrategia-tdd.md)), Playwright, e o scan do SonarCloud.
2. **Merge em `main`** (via PR, squash — ver [../git/commits-e-branches.md](../git/commits-e-branches.md)) → dispara o build do Amplify (integração direta com o repositório GitHub).
3. **Build do Amplify** (`amplify.yml`) roda, nesta ordem: `npm ci` → `npx prisma migrate deploy` (aplica migrations pendentes no RDS antes do build da app — nunca `migrate dev` em produção, ver [../database/migrations-prisma.md](../database/migrations-prisma.md)) → `npx prisma generate` → `next build`.
4. Amplify publica a nova versão via CDN; deploy anterior fica disponível para rollback rápido pela própria interface do Amplify.

## Rollback

- **Aplicação**: reverter para o build anterior diretamente no console do Amplify (mantém histórico de builds), ou reverter o commit em `main` e deixar o pipeline redeployar.
- **Banco de dados**: migrations não têm rollback automático (Prisma não gera "down"). Reverter uma mudança de schema exige uma nova migration corretiva, aplicada da mesma forma (`prisma migrate deploy`) — ver a política completa em [../database/migrations-prisma.md](../database/migrations-prisma.md). Nunca reverter o app para uma versão de código incompatível com o schema já migrado em produção.

## Observabilidade pós-deploy

Todo deploy em produção é acompanhado pelo dashboard de New Relic (latência, taxa de erro por rota, execuções do `NotificacaoScheduler`) — ver [../qualidade/observabilidade.md](../qualidade/observabilidade.md). Um pico de erro logo após deploy é o primeiro sinal para rollback.
