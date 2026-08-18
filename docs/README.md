# Documentação do Projeto

Índice da documentação técnica. Ponto de entrada: [../CLAUDE.md](../CLAUDE.md) (visão geral do produto). Este arquivo mapeia onde está cada regra específica, para não precisar adivinhar nome de arquivo.

## Produto

- [produto/regras-negocio.md](produto/regras-negocio.md) — todas as regras de negócio (RN01–RN19), requisitos não funcionais relevantes e fluxos alternativos (FA-01 a FA-08). Consulte antes de implementar qualquer validação ou comportamento de domínio.
- [produto/casos-de-uso.md](produto/casos-de-uso.md) — casos de uso/user stories por fluxo (cadastro de escritório, clientes, kanban, prazos, WhatsApp, documentos, isolamento de tenant), cada um apontando as RN/FA correspondentes. Documentação mínima exigida pela linha Web Apps do Portfólio.

## Arquitetura

- [arquitetura/visao-geral.md](arquitetura/visao-geral.md) — C4 (contexto/containers/componentes), camadas do backend (Auth Middleware → Tenant Context → Controller → Service → Repository), módulos funcionais, decisões de stack e isolamento de tenant. Consulte antes de decidir onde uma nova peça de lógica deve morar.

## Banco de dados

- [database/docker-setup.md](database/docker-setup.md) — como subir o PostgreSQL local via Docker Compose, variáveis de ambiente, comandos do dia a dia.
- [database/schema.md](database/schema.md) — as 12 tabelas do modelo de dados multi-tenant, relacionamentos e notas de implementação Prisma.
- [database/migrations-prisma.md](database/migrations-prisma.md) — fluxo obrigatório de migrations (`migrate dev`/`migrate deploy`), como reverter, nomenclatura, seeds, auditoria do histórico de schema. Consulte sempre que for alterar `schema.prisma`.

## App (Next.js)

- [app/estrutura-codigo.md](app/estrutura-codigo.md) — layout de pastas, convenção de nomes por entidade/camada, uso do TanStack Query, regra de fronteira UI → API → Service → Repository.
- [app/design-system.md](app/design-system.md) — Tailwind + shadcn/ui, regra de sempre usar tokens de tema (nunca cor literal), onde configurar tokens, instalação de componentes via CLI.
- [app/modularizacao.md](app/modularizacao.md) — hierarquia de componentes, quando extrair componente/hook/função reutilizável, tipagem compartilhada.

## Testes

- [testes/estrategia-tdd.md](testes/estrategia-tdd.md) — ferramentas (Jest + Testing Library + Playwright), processo TDD obrigatório, metas de cobertura (piso institucional 75% backend / 25% frontend, cobrado na prova de autoria, mais metas internas por camada que garantem esse piso) com gate de CI, fluxos críticos cobertos por E2E.

## Qualidade

- [qualidade/analise-estatica.md](qualidade/analise-estatica.md) — SonarCloud: o que é verificado (bugs, code smells, security hotspots, duplicação, cobertura importada do Jest), configuração, Quality Gate como check obrigatório de PR.
- [qualidade/observabilidade.md](qualidade/observabilidade.md) — New Relic: o que é monitorado na app e na Lambda de notificações, logs estruturados, alertas e dashboards.

## Deploy

- [deploy/deploy.md](deploy/deploy.md) — ambientes (local vs. produção), o que exatamente roda no AWS Amplify, variáveis de ambiente, pipeline de deploy (CI → migrations → build → publish), rollback.

## Git

- [git/commits-e-branches.md](git/commits-e-branches.md) — Conventional Commits, nomenclatura de branches, granularidade de commit, regra de PR/merge (squash), exigência de testes e migrations no mesmo commit da mudança que os motivou.
- [git/wiki-github.md](git/wiki-github.md) — mapeamento de `docs/` para a Wiki do GitHub (requisito institucional obrigatório, separado da documentação técnica em `docs/`) e quando sincronizar.

## Como navegar isso como LLM trabalhando no projeto

1. Toda tarefa que envolve **regra de negócio** → ler `produto/regras-negocio.md` primeiro; `produto/casos-de-uso.md` para o fluxo do ponto de vista do usuário.
2. Toda tarefa que envolve **onde colocar código novo** → `arquitetura/visao-geral.md` (camada) + `app/estrutura-codigo.md` (pasta/arquivo).
3. Toda tarefa que **muda o schema** → `database/schema.md` (o que muda) + `database/migrations-prisma.md` (como aplicar).
4. Toda tarefa de **UI** → `app/design-system.md` (tokens) + `app/modularizacao.md` (reuso).
5. Toda tarefa de **código de produção** → não é considerada concluída sem o teste correspondente (`testes/estrategia-tdd.md`) e um commit no padrão (`git/commits-e-branches.md`).
6. Toda tarefa de **deploy ou infraestrutura** → `deploy/deploy.md`; mudanças que afetam monitoramento → também `qualidade/observabilidade.md`.
7. Antes de cada orientação/entrega → conferir se a Wiki do GitHub precisa de atualização (`git/wiki-github.md`).
