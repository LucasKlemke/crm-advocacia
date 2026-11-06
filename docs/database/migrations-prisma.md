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
- **Deploy real (Supabase, Vercel Services)**: `prisma migrate deploy` roda no build do service `api` (`npm run vercel-build` → `apps/api/scripts/migrar-no-deploy.mjs`), **somente em produção** (`VERCEL_ENV=production`), contra `DIRECT_URL` ([../deploy/deploy.md](../deploy/deploy.md)). Previews nunca migram. Falha de migration falha o build e nada é publicado.
- **Deploy acadêmico (AWS)**: o `deploy-aws.yml` registra a task definition nova e roda `npm run migrar -w @crm/api` (= `prisma migrate deploy`) numa task avulsa (`aws ecs run-task`) com a imagem nova; só com exit code 0 o serviço ECS troca de revisão. O container da API **não** migra ao subir ([../deploy/aws-terraform.md](../deploy/aws-terraform.md)). Localmente: `npm run prisma:migrate` (raiz) = `prisma migrate dev` em `apps/api`; no CI, `npm run prisma:deploy -w @crm/api`.

## Regra expand/contract (obrigatória)

Nos dois deploys a migration é aplicada **antes** de a versão nova do app entrar no ar, enquanto a versão anterior ainda atende requisições (no AWS, a task antiga segue servindo até o rollout do ECS terminar; na Vercel, o deployment anterior serve até o build novo ser promovido). E um rollback (Instant Rollback da Vercel, circuit breaker do ECS, "Re-run all jobs" no run antigo do `deploy-aws.yml` ou `git revert` na `main`) volta o app, **nunca o schema**. Logo, toda migration precisa ser compatível ao mesmo tempo com o código novo e com o código anterior:

1. **Expand** (PR da funcionalidade): só acrescentar — tabela nova, coluna anulável ou com `DEFAULT`, índice novo, valor novo de enum (que o código antigo nunca lê nem grava). Nada de `DROP`, `RENAME` ou `NOT NULL` sem default em coluna existente.
2. **Migrar dados**, se preciso, na própria migration (SQL idempotente) ou num passo posterior; o código novo tolera linhas ainda no formato antigo.
3. **Contract** (PR posterior, depois que nenhuma versão em execução ou alvo de rollback usa o que vai sair): remover a coluna/tabela obsoleta, apertar `NOT NULL`.

Renomear coluna = criar a nova (expand) → código grava nas duas e lê a nova → remover a antiga (contract). Na revisão do SQL (passo 3 do fluxo acima), qualquer `DROP`/`RENAME`/`ALTER ... SET NOT NULL` precisa justificar por que é seguro com a versão anterior ainda no ar.
