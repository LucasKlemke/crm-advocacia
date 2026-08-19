# Estrutura de Código — Next.js

Mapeia as camadas definidas em [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md) (Auth Middleware → Tenant Context → Controller → Service → Repository) para pastas e arquivos concretos do projeto Next.js (App Router). Ver também [design-system.md](design-system.md) e [modularizacao.md](modularizacao.md) para as regras de UI.

## Layout de pastas

```
src/
├── app/                          # App Router — páginas e route handlers
│   ├── (auth)/                   # rotas públicas: login, cadastro (nome/e-mail/senha)
│   │   ├── login/page.tsx
│   │   └── cadastro/page.tsx
│   ├── (onboarding)/
│   │   └── onboarding/page.tsx   # cria o primeiro escritório (ou mais um, pelo switcher)
│   ├── (dashboard)/              # rotas autenticadas, com escritório ativo obrigatório
│   │   ├── layout.tsx            # shell: SidebarProvider + AppSidebar + EscritorioSwitcher
│   │   ├── page.tsx
│   │   ├── clientes/page.tsx
│   │   ├── casos/page.tsx          # kanban
│   │   ├── prazos/page.tsx
│   │   ├── mensagens/page.tsx
│   │   ├── perfil/page.tsx       # dados do próprio usuário + senha
│   │   └── configuracoes/
│   │       ├── layout.tsx        # nav lateral própria (sem aninhar outro SidebarProvider)
│   │       ├── page.tsx          # redireciona para /configuracoes/escritorio
│   │       ├── escritorio/page.tsx
│   │       └── usuarios/page.tsx # membros + convites
│   └── api/                      # Controllers — Route Handlers
│       ├── cadastro/route.ts
│       ├── escritorios/route.ts
│       ├── escritorios/atual/route.ts
│       ├── sessao/escritorio-ativo/route.ts
│       ├── membros/route.ts
│       ├── membros/[id]/route.ts
│       ├── convites/route.ts
│       ├── convites/[id]/route.ts
│       ├── perfil/route.ts
│       ├── perfil/senha/route.ts
│       └── ...
├── services/                     # regras de negócio (RN01–RN19)
│   ├── usuario.service.ts        # cadastro, perfil, senha
│   ├── escritorio.service.ts     # criar/ler/atualizar o tenant
│   ├── membro.service.ts         # troca de escritório ativo, gestão de membros
│   ├── convite.service.ts        # convidar, listar pendentes, cancelar
│   └── ...
├── repositories/                 # único ponto de acesso ao Prisma
│   ├── usuario.repository.ts
│   ├── escritorio.repository.ts
│   ├── membro.repository.ts
│   ├── convite.repository.ts
│   └── ...
├── lib/
│   ├── auth/
│   │   ├── config.ts             # NextAuth.js — providers, callbacks jwt/session
│   │   ├── authorize.ts          # credenciais → resolve escritório ativo inicial
│   │   ├── escritorio-ativo.ts   # resolverEscritorioAtivo (sempre valida no banco)
│   │   ├── permissoes.ts         # hierarquia de papéis, puro/sem I/O
│   │   └── tenant-context.ts     # getTenantContext() — RN19
│   ├── external/                 # UazapiClient, S3Client, EmailClient
│   ├── prisma.ts                 # instância única do PrismaClient
│   └── utils/                    # funções puras compartilhadas (ver modularizacao.md)
├── hooks/                        # hooks de TanStack Query (client-side)
├── components/
│   ├── ui/                       # componentes shadcn/ui (gerados via CLI)
│   ├── shell/                    # AppSidebar, NavUsuario, EscritorioSwitcher
│   ├── perfil/                   # PerfilForm, SenhaForm
│   ├── configuracoes/            # EscritorioForm, MembrosTable, ConviteForm, ConvitesTable
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
