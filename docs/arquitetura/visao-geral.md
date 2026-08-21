# Arquitetura do Sistema

Base: RFC original em https://github.com/LucasKlemke/PAC-Extensionista-VII---RFC---CRM-Advocacia, evoluído para **multi-tenant com múltiplos usuários por tenant** — ver [../../CLAUDE.md](../../CLAUDE.md) e [../produto/regras-negocio.md](../produto/regras-negocio.md).

## Visão geral (C4 — Contexto)

Usuários: qualquer número de **escritórios** cadastrados; cada usuário é um perfil global que pode participar de um ou mais escritórios (via `membro`), com um papel — `owner`, `admin` ou `padrao` — por escritório — todos acessando via navegador (HTTPS).

Sistemas externos:
- **Uazapi / WhatsApp** — REST/HTTPS, disparo de mensagens (lembretes, follow-ups, atualizações), uma conexão/número por escritório.
- **Servidor de e-mail** — SMTP/HTTPS, alertas de prazo e e-mails transacionais (confirmação de cadastro, convite de membro, reset de senha).

## Containers

| Container | Tecnologia | Responsabilidade |
|---|---|---|
| Aplicação Web | Next.js / Tailwind CSS | Interface do usuário, incluindo telas de cadastro de escritório e gestão de usuários |
| API Routes | Next.js (Route Handlers) | Backend embutido: HTTP → contexto de tenant → regras de negócio → Prisma |
| Agendador de Notificações | AWS Lambda + EventBridge Scheduler | Consulta prazos de todos os escritórios e dispara WhatsApp/e-mail nos intervalos definidos, isolando por tenant |
| Banco de Dados | PostgreSQL (Amazon RDS) | Persistência relacional multi-tenant (isolamento lógico por `escritorio_id`) |
| Armazenamento de Arquivos | Amazon S3 | Documentos anexados a casos, particionados por escritório (prefixo `escritorio_id/` no path do objeto) |

Fluxo: Web → API Routes (REST/JSON) → Prisma (TCP) → Postgres; API Routes → AWS SDK → S3; Lambda → consulta Postgres (todos os tenants) → aciona Uazapi/SMTP por tenant.

## Componentes internos das API Routes

Pipeline de toda requisição autenticada: **Auth Middleware → Tenant Context → Controller → Service → Repository** (persistência) ou **Service → Cliente Externo** (integração).

| Componente | Tecnologia | Papel |
|---|---|---|
| Auth Middleware | NextAuth.js | Valida JWT; extrai `usuarioId`, `escritorioId` e `role` da sessão |
| Tenant Context | Middleware/helper interno | Injeta `escritorioId` em todo Service/Repository chamado na requisição; nenhuma query roda sem esse contexto |
| Controllers | Route Handlers | Recebem HTTP, delegam para Services. Novos: `EscritorioController` (cadastro/dados do tenant), `UsuarioController` (convite, gestão de membros, perfil) |
| Services | TypeScript | Regras de negócio, incluindo validação de isolamento de tenant e controle de papéis (`owner` > `admin` > `padrao`, ver `permissoes.ts`) |
| Repositories | Prisma ORM | Único ponto de acesso ao banco; **todo método aceita/exige `escritorioId`** e filtra por ele |
| Clientes Externos | HTTP Clients | `UazapiClient` (WhatsApp, credenciais por escritório), `S3Client` (documentos), `EmailClient` (SMTP) |

### Isolamento de tenant (defesa em profundidade)

1. **Nível de sessão**: JWT carrega `escritorioId`; toda rota autenticada resolve o tenant a partir da sessão, nunca de um parâmetro vindo do cliente.
2. **Nível de Service**: cada Service recebe o `escritorioId` do contexto e o repassa ao Repository — nunca confia em `escritorio_id` enviado no corpo da requisição.
3. **Nível de Repository/banco**: toda query Prisma inclui `where: { escritorio_id }` (diretamente ou via relação); índices compostos com `escritorio_id` garantem performance mesmo com muitos tenants.
4. **Auditoria**: tentativas de acesso a recurso de outro `escritorio_id` são logadas e retornam 404 (não 403, para não confirmar existência do recurso a um tenant não autorizado).

## Módulos funcionais

Cada módulo segue o padrão de camadas acima, com regras de negócio concentradas no Service e acesso a dados isolado no Repository.

### Autenticação e Tenants (novo/expandido)
- `AuthMiddleware` (valida JWT em rotas protegidas), `AuthService`/`authorize.ts` (login, resolve o escritório ativo inicial — membership mais antiga).
- `EscritorioController` / `EscritorioService` — cria escritório (onboarding ou "criar outro" pelo switcher), lê/atualiza dados do escritório ativo.
- `UsuarioController` / `UsuarioService` — cadastro de usuário (consumindo convites pendentes automaticamente), edição de perfil, troca de senha.
- `MembroController` / `MembroService` — lista escritórios do usuário, troca o escritório ativo da sessão (sempre revalidando a membership no banco), gestão de membros (papel, remoção) respeitando a hierarquia e a proteção do último `owner`.
- `ConviteController` / `ConviteService` — convida (cria membership direto se o e-mail já é usuário, senão grava convite pendente), lista pendentes, cancela.
- Tabelas: `escritorio`, `usuario`, `membro`, `convite`. Ver [../database/schema.md](../database/schema.md) e [../produto/regras-negocio.md](../produto/regras-negocio.md) RN01–RN03, RN02a–RN02c.

### Gestão de Clientes
- `ClienteController`, `ClienteService` (unicidade de CPF **por escritório**, inativação vs. exclusão), `ClienteRepository`.
- Regras: RN04, RN05.

### Gestão de Casos e Pipeline Kanban
- `CasoController`, `CasoService` (vínculo com cliente/estágio, arquivamento), `CasoRepository`.
- `EstagioService` — CRUD das colunas do kanban (por escritório), valida coluna vazia antes de excluir.
- Regras: RN06–RN09.

### Prazos e Lembretes
- `PrazoController`, `PrazoService` (detecção de prazo retroativo, marcação de conclusão), `PrazoRepository`.
- Regras: RN10–RN12.

### Agendador de Notificações (serviço assíncrono)
- `NotificacaoScheduler` (loop de verificação em background, itera por todos os escritórios ativos), `UazapiClient` (usa credenciais/conexão do escritório do prazo), `EmailClient`.
- Tabelas: `prazo`, `notificacoes_prazo`.
- Regras: RN14–RN16.

### Mensagens WhatsApp
- `MensagemController`, `MensagemService` (substituição de variáveis `{{nome}}`/`{{processo}}`, validação de telefone, controle de tentativas), `MensagemRepository`, `UazapiClient`.
- Templates (`template_mensagem`) são por escritório — todos os membros do mesmo tenant compartilham os mesmos templates.
- Regras: RN13, RN15, RN16.

### Anotações e Documentos
- `AnotacaoController` / `DocumentoController`, `DocumentoService` (validação de tipo/tamanho, URL assinada com prefixo do escritório no path do S3), `AnotacaoRepository` / `DocumentoRepository`, `S3Client`.
- Regras: RN17, RN18.

### Dashboard e Relatórios
- `DashboardController`, `RelatorioController`, `DashboardService` / `RelatorioService` (agregação entre múltiplas tabelas, sempre escopada ao escritório da sessão), reutiliza `ClienteRepository`, `CasoRepository`, `PrazoRepository`, `MensagemRepository`.

## Decisões de stack e motivação

| Decisão | Por quê |
|---|---|
| Next.js (App Router) para front + back | Um único projeto, reduz complexidade de infra; SSR/SSG/Client Components dão performance no dashboard e kanban |
| TanStack Query | Cache automático e sincronização em background do kanban/dashboard sem reload manual |
| Next.js API Routes como backend | Evita servidor separado; adequado ao volume de uso esperado por tenant |
| NextAuth.js com sessão multi-tenant | JWT carrega `escritorioId` + `role`, permitindo resolver o contexto de tenant sem consulta extra ao banco a cada requisição |
| Uazapi | Envio via WhatsApp sem exigir aprovação de conta business oficial; escopo é só envio (não bidirecional); cada escritório conecta seu próprio número |
| PostgreSQL + Prisma | Modelo fortemente relacional (escritório → cliente → caso → prazo/anotação/documento); Prisma dá tipagem, migrations versionadas e evita SQL Injection; isolamento lógico multi-tenant via `escritorio_id` + índices compostos |
| Vercel, dois Projects | Deploy gerenciado de Next.js com SSL automático; um Project usa RDS+S3 (avaliação acadêmica, sem Supabase), outro usa Supabase (produção real) — mesma `main`, variáveis de ambiente diferentes, ver [../deploy/deploy.md](../deploy/deploy.md) |
| S3 + URL assinada | Armazenamento de documentos com acesso restrito ao usuário autenticado do escritório dono do arquivo; client S3 aceita endpoint customizável para funcionar também contra Supabase Storage |
| Lambda + EventBridge | Notificações de prazo rodam em background para todos os escritórios, sem depender de nenhuma UI aberta (RN14) |

### Isolamento lógico vs. físico

Optou-se por **isolamento lógico** (schema único, coluna `escritorio_id` em todas as tabelas de topo, filtrada em toda query) em vez de schema-por-tenant ou banco-por-tenant. Justificativa: volume esperado por tenant é baixo (até 1.000 clientes / 5.000 casos), simplifica migrations e operação, e o Prisma facilita aplicar o filtro de tenant de forma consistente. Se o produto crescer para exigir isolamento físico (compliance, tenants muito grandes), essa é uma migração possível sem redesenho do modelo de dados.

## Fora de escopo arquitetural

Não há: colaboração em tempo real (edição concorrente/locking), integração bidirecional de WhatsApp, módulo financeiro, consulta automática a tribunais (TJSC/CNJ/PJe), portal do cliente, app mobile nativo, billing por tenant. Ver [../../CLAUDE.md](../../CLAUDE.md) para a lista completa.
