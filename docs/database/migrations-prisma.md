# Migrations com Prisma

Como toda alteração de schema deve ser feita, aplicada e revertida, mantendo `prisma/migrations/` como histórico auditável do estado do banco em qualquer ambiente. Ver [schema.md](schema.md) para o modelo de dados atual e [docker-setup.md](docker-setup.md) para o banco local onde essas migrations são desenvolvidas.

## Regra central

**Toda alteração de schema passa por uma migration versionada do Prisma.** `prisma db push` é proibido fora de prototipagem descartável em máquina local (nunca em branch compartilhada, nunca com dados que importam) — ele não gera arquivo de migration, logo não deixa rastro auditável do que mudou nem como reverter.

## Fluxo obrigatório para alterar o schema

1. Editar `prisma/schema.prisma` com a mudança desejada (nova tabela, coluna, índice, constraint).
2. Gerar a migration: `npx prisma migrate dev --name <nome_descritivo>`.
3. Revisar o SQL gerado em `prisma/migrations/<timestamp>_<nome>/migration.sql` — confirmar que reflete exatamente a intenção (atenção especial a colunas `NOT NULL` sem default em tabela com dados, e a `DROP`s).
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

- `prisma/migrations/` é o histórico imutável de todas as mudanças de schema já aplicadas — funciona como changelog técnico do banco.
- A tabela `_prisma_migrations` (mantida automaticamente pelo Prisma dentro do próprio Postgres) é a fonte de verdade de quais migrations já rodaram em cada ambiente; `npx prisma migrate status` mostra o diff entre o que está no repositório e o que já foi aplicado no banco atual.
- Nunca reescrever (squash, editar, deletar) uma migration que já foi aplicada em qualquer ambiente compartilhado — mesmo que pareça "limpar o histórico", isso quebra a reconstrução do estado do banco a partir do zero e o rastreamento de quando cada mudança de schema entrou.

## Seeds

`prisma/seed.ts` popula dados de desenvolvimento — por exemplo, os estágios de pipeline padrão (Prospecção, Consulta, Contrato, Em Andamento, Concluído) para um escritório de teste, conforme descrito em [schema.md](schema.md#estagio_pipeline). Rodar via `npx prisma db seed` (ou automaticamente após `migrate dev`/`migrate reset`). Seeds nunca substituem migrations — populam dados, não alteram estrutura.

## Deploy (CI/CD)

Em produção/staging, usar **`npx prisma migrate deploy`**, nunca `migrate dev`:

- `migrate deploy` só aplica migrations já existentes em `prisma/migrations/`, sem tentar gerar novas nem perguntar nada interativamente — seguro para pipeline automatizado.
- `migrate dev` é exclusivo do fluxo de desenvolvimento local (gera novas migrations a partir de mudanças no schema).
- O passo `prisma migrate deploy` roda dentro do próprio `npm run build` (`prisma migrate deploy && next build`), executado pela Vercel em cada um dos dois Projects de produção — ver [../deploy/deploy.md](../deploy/deploy.md) — garantindo que o schema do banco daquele ambiente sempre esteja compatível com o código que está subindo.
