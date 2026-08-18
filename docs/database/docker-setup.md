# PostgreSQL local via Docker

Ambiente de desenvolvimento local. Em produção o banco é Amazon RDS (ver [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md)) — mesma `DATABASE_URL` no formato Postgres, credenciais e host diferentes por ambiente. Ver [schema.md](schema.md) para o modelo de dados e [migrations-prisma.md](migrations-prisma.md) para como versionar mudanças de schema neste banco.

## `docker-compose.yml`

Arquivo na raiz do projeto:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: crm-advocacia-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: crm_user
      POSTGRES_PASSWORD: crm_password
      POSTGRES_DB: crm_advocacia
    ports:
      - "5432:5432"
    volumes:
      - crm_postgres_data:/var/lib/postgresql/data

volumes:
  crm_postgres_data:
```

As credenciais acima são placeholders de desenvolvimento local — nunca reaproveitar em produção. `crm_postgres_data` é um volume nomeado do Docker: os dados sobrevivem a `docker compose down` (só são apagados com `-v` explícito).

## `.env`

O Prisma lê a connection string de `DATABASE_URL`. Para o compose acima:

```env
DATABASE_URL="postgresql://crm_user:crm_password@localhost:5432/crm_advocacia?schema=public"
```

Manter um `.env.example` versionado com esse valor placeholder e `.env` real no `.gitignore` — nunca commitar credenciais reais, mesmo as de desenvolvimento local.

## Comandos do dia a dia

| Ação | Comando |
|---|---|
| Subir o banco em background | `docker compose up -d` |
| Ver status do container | `docker compose ps` |
| Acompanhar logs | `docker compose logs -f postgres` |
| Parar o container (mantém dados) | `docker compose stop` |
| Parar e remover o container (mantém volume/dados) | `docker compose down` |
| **Resetar o banco do zero** (apaga todos os dados) | `docker compose down -v` |
| Conectar via `psql` dentro do container | `docker compose exec postgres psql -U crm_user -d crm_advocacia` |

## Depois de subir o container

1. Confirmar que `DATABASE_URL` no `.env` bate com as credenciais do `docker-compose.yml`.
2. Aplicar as migrations existentes: `npx prisma migrate deploy` (ambiente já com histórico) ou `npx prisma migrate dev` (durante desenvolvimento, também gera client e aplica seed) — ver [migrations-prisma.md](migrations-prisma.md).
3. Opcional: `npx prisma studio` para inspecionar o banco visualmente durante o desenvolvimento.

## Resetar o ambiente local do zero

Quando o schema local ficar inconsistente ou for necessário recomeçar:

```bash
docker compose down -v
docker compose up -d
npx prisma migrate dev
```

Isso recria o container, reaplica todas as migrations versionadas em `prisma/migrations/` na ordem e roda o seed (se configurado) — nunca é necessário editar dados manualmente para "consertar" o banco local.
