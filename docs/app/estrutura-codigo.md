# Estrutura de Código — Monorepo (API NestJS + Web React + Compartilhado)

Mapeia as camadas definidas em [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md) (TenantGuard → Tenant Context → Controller → Service → Repository) para pacotes, pastas e arquivos concretos. Ver também [design-system.md](design-system.md) e [modularizacao.md](modularizacao.md) para as regras de UI, e [../arquitetura/migracao-nestjs.md](../arquitetura/migracao-nestjs.md) para o histórico da migração a partir do Next.js.

## Pacotes

```
apps/
├── api/                          # @crm/api — NestJS 12 (ESM)
│   ├── prisma/                   # schema.prisma + migrations/ (histórico auditável)
│   ├── prisma.config.ts
│   ├── tsup.config.ts            # build de produção → dist/main.js + dist/instrumentacao.js
│   ├── jest.config.cjs / jest.setup.ts
│   ├── scripts/migrar-no-deploy.mjs
│   ├── test/                     # utilitários de teste (criarAppDeTeste, sessão simulada)
│   └── src/
│       ├── main.ts               # bootstrap: carrega .env local → Nest → listen
│       ├── instrumentacao.ts     # agente New Relic; carregado por `--import`, não importado pelo main
│       ├── criar-app.ts          # prefixo /api, parsers (só JSON e texto do webhook), filtro global — usado também nos testes
│       ├── app.module.ts
│       ├── comum/                # TenantGuard/UsuarioGuard, ErrosHttpFilter, ValidacaoZodPipe, cookie de sessão
│       ├── config/               # carregarEnvLocal
│       ├── <modulo>/             # um por grupo de rota: clientes, casos, status, campanhas, sessao, ...
│       │   ├── <modulo>.module.ts
│       │   ├── <modulo>.controller.ts (+ .test.ts com supertest)
│       │   └── tokens.ts         # tokens de injeção dos services do domínio
│       └── dominio/              # regras de negócio — independentes do Nest
│           ├── services/         # <entidade>.service.ts (+ .test.ts, repository mockado)
│           ├── repositories/     # <entidade>.repository.ts (+ .test.ts contra Postgres real)
│           └── lib/
│               ├── api/          # tradutores de erro, serializadores, payloads e schemas Zod só da API
│               ├── auth/         # sessão (jose), escritório ativo, resolver de tenant
│               ├── external/     # UazapiClient, S3Client
│               ├── documentos/   # zip, URLs públicas
│               ├── utils/        # utilitários só do back (diff, período de evento)
│               └── prisma.ts     # instância única do PrismaClient
└── web/                          # @crm/web — React 19 + Vite + React Router v7
    └── src/
        ├── main.tsx              # monta <App /> (StrictMode)
        ├── app.tsx               # providers + router
        ├── rotas.tsx             # árvore de rotas (públicas, onboarding, dashboard, configurações)
        ├── compat/               # camada de compatibilidade herdada do Next (next-navigation, next-link, next-image)
        ├── paginas/              # uma tela por arquivo (clientes.tsx, casos.tsx, ...) + subpastas (campanhas/, configuracoes/, layouts/, `_components/` da tela)
        ├── components/
        │   ├── ui/               # shadcn/ui (gerados via CLI)
        │   ├── shell/            # app-sidebar, nav-usuario, escritorio-switcher
        │   ├── shared/           # componentes reutilizáveis entre telas
        │   ├── providers/        # QueryProvider
        │   └── <modulo>/         # componentes de feature (clientes, casos, dashboard, configuracoes, perfil, auth)
        ├── hooks/                # use-<entidade>.ts — TanStack Query
        └── lib/
            ├── api-client.ts     # apiFetch + ApiError
            ├── sessao.ts         # entrar/sair/sessão no browser
            ├── query/            # chaves.ts (query keys), opcoes-padrao.ts, query-client-raiz.ts
            ├── utils/            # utilitários só do front (datas, agenda, CSV, formatação)
            ├── utils.ts          # cn()
            └── test-utils*.tsx / test-paginas.tsx   # renderComQuery, renderComRotas, renderPagina
packages/
└── compartilhado/                # @crm/compartilhado — só TypeScript-fonte, sem build
    └── src/
        ├── enums.ts              # espelho dos enums do Prisma usados na fronteira HTTP
        ├── tipos/                # DTOs trafegados entre api e web
        ├── schemas/              # schemas Zod (formulário no web, pipe na API)
        ├── utils/                # CPF, telefone, e-mail, cores/ícones de status, campanhas
        └── auth/permissoes.ts    # hierarquia de papéis (owner > admin > padrao)
e2e/                              # Playwright — um spec por fluxo crítico
```

## Imports e aliases

| Onde | Alias | Aponta para |
|---|---|---|
| `apps/api` | `@dominio/*` | `apps/api/src/dominio/*` |
| `apps/web` | `@/*` | `apps/web/src/*` |
| `apps/api`, `apps/web` | `@crm/compartilhado/<caminho>` | `packages/compartilhado/src/<caminho>.ts` (via `exports`) |

Dentro de `apps/api/src` (camada Nest) e dentro do compartilhado, imports entre arquivos do mesmo pacote são relativos. O alias `@dominio/` marca explicitamente o acesso da camada Nest ao domínio. Os aliases são resolvidos pelo `tsc`, pelo Jest (`moduleNameMapper`) e pelo tsup/Vite; o artefato de produção da API é um bundle e nunca resolve alias em runtime.

## Convenção de nomes por entidade

| Camada | Padrão de arquivo | Exemplo |
|---|---|---|
| Controller (Nest) | `apps/api/src/<modulo>/<modulo>.controller.ts` | `apps/api/src/clientes/clientes.controller.ts` |
| Service | `apps/api/src/dominio/services/<entidade>.service.ts` | `cliente.service.ts` |
| Repository | `apps/api/src/dominio/repositories/<entidade>.repository.ts` | `cliente.repository.ts` |
| Schema Zod (web + API) | `packages/compartilhado/src/schemas/<entidade>.ts` | `schemas/cliente.ts` |
| Schema Zod só da API | `apps/api/src/dominio/lib/api/schemas-<entidade>.ts` | `schemas-escritorio.ts` |
| DTO | `packages/compartilhado/src/tipos/<entidade>.ts` | `tipos/cliente.ts` |
| Hook de dados (web) | `apps/web/src/hooks/use-<entidade>.ts` | `use-clientes.ts` |

## Tenant Context na prática

Toda rota de tenant declara `@UseGuards(TenantGuard)` e recebe `@Tenant() ctx: TenantContext`. O guard lê o cookie `crm_sessao`, valida o JWT e resolve a membership no banco (o `role` nunca vem do token). O controller repassa `ctx` ao Service como primeiro parâmetro, e o Service nunca busca o tenant sozinho nem confia em `escritorioId` vindo do corpo da requisição. Rotas que só exigem usuário autenticado (sem escritório) usam `UsuarioGuard` + `@UsuarioId()`. Ver [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md#isolamento-de-tenant-defesa-em-profundidade).

Services e repositories do domínio são objetos (não classes) e entram no Nest por token: `{ provide: CLIENTE_SERVICE, useValue: clienteService }` + `@Inject(CLIENTE_SERVICE)`, com os tokens no `tokens.ts` do próprio módulo. Isso dispensa `emitDecoratorMetadata`, que o build com esbuild não gera, e permite `overrideProvider` nos testes.

Erros de domínio viram HTTP no controller: `@UseFilters(new ErrosHttpFilter([tradutorDoModulo]))`; o filtro global de `criar-app.ts` cobre o restante (erro inesperado → 500 genérico).

## TanStack Query no web

- Hooks de query/mutation ficam em `apps/web/src/hooks/`, um arquivo por entidade, nunca `useQuery`/`useMutation` solto numa página.
- Query keys vêm de fábricas centralizadas em `lib/query/chaves.ts`, com uma raiz por entidade (`RAIZ_CASOS`, `RAIZ_DASHBOARD`...), de modo que uma escrita invalida tudo da entidade pela raiz.
- Toda chamada HTTP passa por `apiFetch` (`lib/api-client.ts`), que centraliza base URL relativa (`/api`), credenciais e o erro tipado `ApiError`; sessão expirada (401) redireciona ao login.
- Em testes de componente, `renderComQuery` (`lib/test-utils.tsx`) envolve a árvore num `QueryClientProvider` sem retry; para páginas com rotas, `renderComRotas` (`lib/test-utils-rotas.tsx`) e `renderPagina`/`mockApi` (`lib/test-paginas.tsx`).

## Regra de fronteira (não negociável — verificada pelo ESLint)

- `apps/web` nunca importa `@prisma/client` nem código da API. O único caminho de uma tela até o banco é: componente → hook → `apiFetch` → `/api/*` → Controller → Service → Repository.
- `packages/compartilhado` não importa nenhum app, nem Prisma, Nest ou React. Só TypeScript puro + Zod.
- Controllers nunca importam Repositories, sempre passam pelo Service.
- Código novo usado pelos dois lados vai para o compartilhado. Usado por um lado só, fica no app dele.
