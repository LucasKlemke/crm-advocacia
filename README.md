# CRM Advocacia

CRM multi-tenant para escritórios de advocacia. Visão de produto, stack e regras de negócio: **[CLAUDE.md](CLAUDE.md)**. Documentação técnica detalhada por área: **[docs/README.md](docs/README.md)**.

## Setup local

Pré-requisitos: Node.js 20+, Docker (para o Postgres local) e npm.

```bash
npm install
cp .env.example .env      # DATABASE_URL já aponta para o docker-compose abaixo; gere NEXTAUTH_SECRET com `openssl rand -base64 32`
docker compose up -d      # sobe o Postgres local (docs/database/docker-setup.md)
npm run prisma:migrate    # aplica migrations e gera o client
npm run dev
```

O app fica disponível em [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Sobe o app em desenvolvimento |
| `npm run build` / `npm run start` | Build de produção / servir o build |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:coverage` | Testes unitários/integração (Jest), com cobertura |
| `npm run e2e` | Testes E2E (Playwright) — ver [docs/testes/estrategia-tdd.md](docs/testes/estrategia-tdd.md) |
| `npm run prisma:generate` / `npm run prisma:migrate` | Prisma client / migrations — ver [docs/database/migrations-prisma.md](docs/database/migrations-prisma.md) |

## Estrutura

Layout de pastas documentado em [docs/app/estrutura-codigo.md](docs/app/estrutura-codigo.md). Este commit inicial traz apenas o harness (Next.js + TypeScript + Tailwind + shadcn/ui + Prisma + Jest + Playwright configurados); páginas e regras de negócio entram em commits/PRs seguintes, um por vez, conforme [docs/git/commits-e-branches.md](docs/git/commits-e-branches.md).
