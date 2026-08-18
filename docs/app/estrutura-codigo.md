# Estrutura de Código — Next.js

Mapeia as camadas definidas em [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md) (Auth Middleware → Tenant Context → Controller → Service → Repository) para pastas e arquivos concretos do projeto Next.js (App Router). Ver também [design-system.md](design-system.md) e [modularizacao.md](modularizacao.md) para as regras de UI.

## Layout de pastas

```
src/
├── app/                          # App Router — páginas e route handlers
│   ├── (auth)/                   # rotas públicas: login, cadastro de escritório
│   │   ├── login/page.tsx
│   │   └── cadastro/page.tsx
│   ├── (dashboard)/               # rotas autenticadas
│   │   ├── clientes/page.tsx
│   │   ├── casos/page.tsx          # kanban
│   │   ├── prazos/page.tsx
│   │   ├── whatsapp/page.tsx
│   │   └── configuracoes/page.tsx
│   └── api/                      # Controllers — Route Handlers
│       ├── clientes/route.ts
│       ├── clientes/[id]/route.ts
│       ├── casos/route.ts
│       ├── usuarios/route.ts
│       └── ...
├── services/                     # regras de negócio (RN01–RN19)
│   ├── cliente.service.ts
│   ├── caso.service.ts
│   ├── usuario.service.ts
│   ├── escritorio.service.ts
│   └── ...
├── repositories/                 # único ponto de acesso ao Prisma
│   ├── cliente.repository.ts
│   ├── caso.repository.ts
│   └── ...
├── lib/
│   ├── auth/                     # config do NextAuth.js, Tenant Context
│   ├── external/                 # UazapiClient, S3Client, EmailClient
│   ├── prisma.ts                 # instância única do PrismaClient
│   └── utils/                    # funções puras compartilhadas (ver modularizacao.md)
├── hooks/                        # hooks de TanStack Query (client-side)
├── components/
│   ├── ui/                       # componentes shadcn/ui (gerados via CLI)
│   └── shared/                   # composições reutilizáveis entre módulos
└── types/                        # tipos compartilhados front/back
```

## Convenção de nomes por entidade

Cada entidade do domínio (ver [../database/schema.md](../database/schema.md)) mantém nomes de arquivo espelhando a camada, para achar qualquer peça de um módulo sem precisar procurar:

| Camada | Padrão de arquivo | Exemplo |
|---|---|---|
| Controller (Route Handler) | `app/api/<entidade>/route.ts` | `app/api/clientes/route.ts` |
| Service | `services/<entidade>.service.ts` | `services/cliente.service.ts` |
| Repository | `repositories/<entidade>.repository.ts` | `repositories/cliente.repository.ts` |
| Hook de dados (client) | `hooks/use-<entidade>.ts` | `hooks/use-clientes.ts` |

Um Controller nunca importa Repository diretamente — sempre passa pelo Service correspondente.

## Tenant Context na prática

Toda função de Service que lê/escreve dados recebe `escritorioId` como primeiro parâmetro (ou dentro de um objeto de contexto), nunca o busca sozinha de uma fonte não confiável. O helper em `lib/auth/` expõe uma função (ex. `getTenantContext()`) usada no início de cada Route Handler para extrair `usuarioId`, `escritorioId` e `role` da sessão do NextAuth.js antes de chamar o Service — ver a seção de isolamento de tenant em [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md#isolamento-de-tenant-defesa-em-profundidade).

## TanStack Query no client

- Hooks de query/mutation ficam em `src/hooks/`, um arquivo por entidade (`use-clientes.ts`, `use-casos.ts`), nunca `useQuery`/`useMutation` chamado solto dentro de um componente de página.
- Query keys seguem o padrão `[entidade, ...filtros]`, ex.: `['clientes', { busca, ativo }]`, `['casos', 'kanban']` — consistente entre todos os hooks para permitir invalidação previsível (`queryClient.invalidateQueries({ queryKey: ['clientes'] })` após uma mutation).
- Um hook nunca chama `fetch` para uma URL montada manualmente em mais de um lugar — usar uma função cliente HTTP compartilhada (`lib/api-client.ts`) para centralizar base URL, headers e tratamento de erro.

## Regra de fronteira (não negociável)

Um componente de página/UI **nunca** importa `services/*`, `repositories/*` ou `@prisma/client` diretamente. O único caminho de um componente até o banco é: componente → hook (`hooks/*`) → `fetch` para `app/api/*` → Controller → Service → Repository. Isso vale mesmo em Server Components — se precisar de dados no servidor, o Server Component chama o Service diretamente (sem HTTP), mas ainda assim nunca o Repository, para manter a regra de negócio centralizada em uma única camada.
