# CRM Advocacia

CRM multi-tenant para escritórios de advocacia. Visão de produto, stack e regras de negócio: **[CLAUDE.md](CLAUDE.md)**. Documentação técnica detalhada por área: **[docs/README.md](docs/README.md)**.

## Contexto acadêmico

> **Projeto sem fins lucrativos.** Este é um projeto de portfólio desenvolvido como **Trabalho de Conclusão de Curso (TCC) — 2026, 8º semestre**, no **Centro Universitário Católica de Santa Catarina**, por Lucas Affonso Klemke.

Não há qualquer finalidade comercial: o sistema não é vendido, licenciado ou monetizado. Ele nasceu de uma necessidade real (o escritório do Dr. Lucas Quintino, OAB/SC 71.025) e é mantido exclusivamente como exercício acadêmico e demonstração técnica de portfólio.

## Arquitetura em uma linha

Monorepo npm: API **NestJS** (`apps/api`, com o domínio e o Prisma), SPA **React + Vite** (`apps/web`) e o pacote **`@crm/compartilhado`** (DTOs, schemas Zod, enums). Em produção os dois apps sobem no mesmo Project da Vercel (Services), na mesma origem. Detalhes em [docs/arquitetura/visao-geral.md](docs/arquitetura/visao-geral.md).

## Setup local

Pré-requisitos: Node.js 24+, Docker (para o Postgres local) e npm.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # DATABASE_URL já aponta para o docker-compose; gere AUTH_SECRET com `openssl rand -base64 32`
docker compose up -d                     # Postgres local (docs/database/docker-setup.md); `npm run dev` também sobe via predev
npm run prisma:migrate                   # aplica migrations e gera o client
npm run dev                              # API em :3001 + web em :5173
```

O app fica disponível em [http://localhost:5173](http://localhost:5173). O Vite encaminha `/api/*` para a API (`API_NEST_URL`, padrão `http://localhost:3001`).

## Scripts (raiz)

| Comando | Descrição |
|---|---|
| `npm run dev` | Postgres (Docker) + API (`tsx watch`, :3001) + web (Vite, :5173) em desenvolvimento |
| `npm run build` / `npm start` | Build de produção (api: tsup → `apps/api/dist`; web: `apps/web/dist`) / servir os dois builds (API via `npm run start -w @crm/api`, que carrega a instrumentação do New Relic; web via `vite preview`) |
| `npm run lint` / `npm run typecheck` | ESLint do monorepo / checagem de tipos de cada pacote |
| `npm test` / `npm run test:coverage` | Jest em todos os pacotes / com cobertura e piso institucional (75% backend, 25% frontend) |
| `npm run e2e` | Build + Playwright contra o build de produção (API :3001, web :4173) — ver [docs/testes/estrategia-tdd.md](docs/testes/estrategia-tdd.md) |
| `npm run prisma:generate` / `npm run prisma:migrate` | Prisma client / migrations em `apps/api/prisma` — ver [docs/database/migrations-prisma.md](docs/database/migrations-prisma.md) |
| `npm run dev:tunnel` | `dev` + túnel ngrok para a API em :3001 (webhook da UAZAPI); `ngrok:start` / `ngrok:stop` controlam o túnel em segundo plano |

## Estrutura

Layout de pastas e regras de fronteira entre pacotes em [docs/app/estrutura-codigo.md](docs/app/estrutura-codigo.md). Fluxo de branches/commits em [docs/git/commits-e-branches.md](docs/git/commits-e-branches.md); deploy em [docs/deploy/deploy.md](docs/deploy/deploy.md).
