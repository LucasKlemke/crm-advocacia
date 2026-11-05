# Migrations com Prisma

Como toda alteração de schema deve ser feita, aplicada e revertida, mantendo `apps/api/prisma/migrations/` como histórico auditável do estado do banco em qualquer ambiente. Ver [schema.md](schema.md) para o modelo de dados atual e [docker-setup.md](docker-setup.md) para o banco local onde essas migrations são desenvolvidas.

> **Onde rodar:** o Prisma vive em `apps/api` (`schema.prisma`, `migrations/`, `prisma.config.ts`). Os comandos `npx prisma ...` deste documento rodam com o diretório atual em `apps/api` (ou use os atalhos da raiz: `npm run prisma:generate`, `prisma:migrate`, `prisma:deploy -w @crm/api`).

## Regra central

**Toda alteração de schema passa por uma migration versionada do Prisma.** `prisma db push` é proibido fora de prototipagem descartável em máquina local (nunca em branch compartilhada, nunca com dados que importam) — ele não gera arquivo de migration, logo não deixa rastro auditável do que mudou nem como reverter.

## Fluxo obrigatório para alterar o schema

1. Editar `apps/api/prisma/schema.prisma` com a mudança desejada (nova tabela, coluna, índice, constraint).
2. Gerar a migration: `npx prisma migrate dev --name <nome_descritivo>`.
3. Revisar o SQL gerado em `apps/api/prisma/migrations/<timestamp>_<nome>/migration.sql` — confirmar que reflete exatamente a intenção (atenção especial a colunas `NOT NULL` sem default em tabela com dados, e a `DROP`s).
4. Confirmar que o comando aplicou a migration no banco local e regenerou o Prisma Client.
5. **Commitar a pasta da migration junto com o código que a motivou**, no mesmo commit ou mesmo PR (ver [../git/commits-e-branches.md](../git/commits-e-branches.md)) — schema e código que depende dele nunca ficam dessincronizados no histórico.

## Nomenclatura de migrations

Padrão `<verbo>_<entidade_ou_mudança>`, em português, consistente com o restante da documentação:

- `cria_tabela_escritorio`
- `adiciona_role_em_usuario`
- `adiciona_unique_cpf_por_escritorio`
- `remove_coluna_x_de_caso`

Evitar nomes genéricos como `update` ou `fix` — o nome da migration é o primeiro lugar onde se entende o que mudou, sem abrir o SQL.

## "Migration down" — como reverter

O Prisma não gera script de rollback automático (`migrate dev` só produz o "up"). Formas corretas de reverter, em ordem de preferência:

1. **Ambiente local, migration ainda não commitada/compartilhada**: `npx prisma migrate reset` — dropa o banco local, reaplica todas as migrations do zero e roda o seed. Só usar quando os dados locais são descartáveis.
2. **Migration já commitada/compartilhada (dev, staging, produção)**: nunca apagar ou editar o arquivo da migration já aplicada. Reverter é feito escrevendo uma **nova migration corretiva** que desfaz a mudança (ex.: se `adiciona_coluna_x` foi um erro, criar `remove_coluna_x`). Isso preserva o histórico linear e auditável.
3. **Nunca** editar manualmente a tabela `_prisma_migrations` ou rodar SQL direto no banco fora do fluxo de migration, exceto para investigação read-only.

## Auditoria e rastreamento de estado

- `apps/api/prisma/migrations/` é o histórico imutável de todas as mudanças de schema já aplicadas — funciona como changelog técnico do banco.
- A tabela `_prisma_migrations` (mantida automaticamente pelo Prisma dentro do próprio Postgres) é a fonte de verdade de quais migrations já rodaram em cada ambiente; `npx prisma migrate status` mostra o diff entre o que está no repositório e o que já foi aplicado no banco atual.
- Nunca reescrever (squash, editar, deletar) uma migration que já foi aplicada em qualquer ambiente compartilhado — mesmo que pareça "limpar o histórico", isso quebra a reconstrução do estado do banco a partir do zero e o rastreamento de quando cada mudança de schema entrou.

## Seeds

Hoje não há seed versionado: os dados de referência (`tipo_status`, status padrão de cada escritório) nascem no SQL das migrations e na transação de criação do escritório ([schema.md](schema.md)). Se um seed de desenvolvimento for criado, ele fica em `apps/api/prisma/seed.ts` e é registrado em `prisma.config.ts`. Seeds nunca substituem migrations — populam dados, não alteram estrutura.

## Deploy (CI/CD)

Em produção/staging, usar **`prisma migrate deploy`** (`npm run prisma:deploy -w @crm/api`), nunca `migrate dev`:

- `migrate deploy` só aplica migrations já existentes em `apps/api/prisma/migrations/`, sem tentar gerar novas nem perguntar nada interativamente — seguro para pipeline automatizado.
- `migrate dev` é exclusivo do fluxo de desenvolvimento local (gera novas migrations a partir de mudanças no schema).
- O passo `prisma migrate deploy` roda no build do service `api` na Vercel (`npm run vercel-build` → `apps/api/scripts/migrar-no-deploy.mjs`), **somente em produção** (`VERCEL_ENV=production`), contra `DIRECT_URL`, em cada um dos dois Projects ([../deploy/deploy.md](../deploy/deploy.md)). Previews nunca migram. Falha de migration falha o build e nada é publicado. Toda mudança de schema segue expand/contract, para que o rollback do app nunca fique incompatível com o schema já migrado. Localmente: `npm run prisma:migrate` (raiz) = `prisma migrate dev` em `apps/api`; no CI, `npm run prisma:deploy -w @crm/api`.
