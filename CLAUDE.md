# CRM Advocacia — Multi-tenant (evolução do RFC do Escritório Lucas Quintino)

Este projeto ainda não possui código-fonte implementado. Este arquivo documenta a especificação do produto, evoluída a partir do RFC original do projeto (PAC Extensionista VII — Engenharia de Software, Católica SC), para guiar a implementação. RFC original (base): https://github.com/LucasKlemke/PAC-Extensionista-VII---RFC---CRM-Advocacia/blob/main/README.md

> **Documentação completa:** este arquivo é o resumo executivo. O detalhamento técnico por área (banco de dados, estrutura do app Next.js, testes, git) vive em `docs/`, indexado em **[docs/README.md](docs/README.md)** — comece por lá antes de implementar qualquer parte do sistema.

## O que é o sistema

CRM simples para escritórios de advocacia (originado a partir da necessidade real do Dr. Lucas Quintino, advogado autônomo, OAB/SC 71.025), que resolve três problemas centrais: centralizar cadastro/histórico de clientes, dar visibilidade do andamento dos casos via kanban, e permitir disparo de mensagens de WhatsApp direto do sistema.

O sistema é **multi-tenant**: cada escritório cadastrado (`escritorio`) tem seus próprios dados totalmente isolados dos demais. Dentro de um escritório, pode haver **múltiplos usuários** (o advogado titular que se cadastrou + colaboradores convidados), compartilhando o mesmo conjunto de clientes, casos e templates do tenant.

## Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend + Backend | Next.js (App Router) + TypeScript |
| Estado assíncrono no cliente | TanStack Query (React Query) |
| Estilo | Tailwind CSS |
| Autenticação | NextAuth.js (JWT, sessão carrega `escritorioId` + `role`) |
| Banco de dados | PostgreSQL + Prisma ORM |
| Armazenamento de arquivos | Amazon S3 (URL assinada) |
| Jobs assíncronos | AWS Lambda + Amazon EventBridge Scheduler |
| WhatsApp | Uazapi (API não-oficial via QR Code, apenas envio) |
| Hosting | AWS Amplify (app) + Amazon RDS (Postgres) |
| CI/CD | GitHub Actions |
| Análise estática | SonarCloud |
| Monitoramento | New Relic |
| Testes | Jest + Testing Library (unit/integração) + Playwright (E2E) |
| Componentes de UI | shadcn/ui sobre Tailwind, sempre via tokens de tema — ver [docs/app/design-system.md](docs/app/design-system.md) |

## Arquitetura (camadas do backend)

Todo request segue: **Auth Middleware → Tenant Context → Controller → Service → Repository** (persistência), ou **Service → Cliente Externo** (integrações).

- **Auth Middleware** (NextAuth.js): valida JWT em toda rota protegida e extrai `escritorioId` + `role` do usuário autenticado.
- **Tenant Context**: garante que toda query subsequente seja automaticamente escopada ao `escritorioId` da sessão — nenhum Repository pode ser chamado sem esse contexto.
- **Controllers** (Route Handlers Next.js): recebem HTTP, delegam a Services. Ex.: `EscritorioController`, `UsuarioController`, `ClienteController`, `CasoController`, `PrazoController`, `MensagemController`, `DocumentoController`, `DashboardController`, `RelatorioController`.
- **Services**: regras de negócio (isolamento entre tenants, validação de CPF único por escritório, controle de papéis de usuário, substituição de variáveis `{{nome}}`/`{{processo}}` em templates, controle de tentativas de envio, etc.).
- **Repositories** (Prisma ORM): único ponto de acesso ao banco; toda query filtra por `escritorio_id`.
- **Clientes externos**: `UazapiClient` (WhatsApp), `S3Client` (documentos), `EmailClient` (SMTP).

Serviço assíncrono separado: `NotificacaoScheduler` (Lambda) roda em background verificando prazos de **todos os escritórios** e acionando WhatsApp/e-mail — não depende de nenhum usuário estar com a interface aberta, e processa cada tenant de forma isolada.

## Modelo de dados (12 tabelas)

`escritorio` (tenant) · `usuario` (N por escritório; titular/colaborador) · `cliente` (FK escritório) · `estagio_pipeline` (FK escritório; colunas do kanban, configuráveis) · `caso` (FK cliente + estagio) · `prazo` (FK caso) · `notificacoes_prazo` (FK prazo; controla envio 3d/1d/0d antes) · `template_mensagem` (FK escritório) · `historico_mensagem` (FK cliente + template) · `anotacao` (FK caso) · `documento` (FK caso, máx 10MB, tipos PDF/DOCX/JPG/PNG/JPEG). Ver detalhamento completo em [docs/database/schema.md](docs/database/schema.md).

Banco local sobe via Docker Compose ([docs/database/docker-setup.md](docs/database/docker-setup.md)); toda alteração de schema é feita via migration do Prisma, nunca `db push`, com histórico auditável em `prisma/migrations/` ([docs/database/migrations-prisma.md](docs/database/migrations-prisma.md)).

## Regras de negócio essenciais

- **RN02 (revisada)**: sistema multi-tenant — cadastro de escritório é self-service pela UI (cria o tenant + o usuário titular); um escritório nunca acessa dados de outro.
- **RN02a**: usuário titular pode convidar/cadastrar colaboradores dentro do próprio escritório; apenas o titular gerencia usuários (criar, desativar, promover).
- **RN04/RN05**: cliente nunca é excluído permanentemente se tiver casos vinculados (apenas inativado); CPF é único **por escritório** (não globalmente).
- **RN06/RN07**: todo caso precisa de cliente ativo e etapa de pipeline; nunca existe "solto".
- **RN08/RN09**: casos arquivados saem do kanban mas ficam no histórico; etapa do pipeline só pode ser removida se vazia.
- **RN10/RN11/RN12**: prazo sempre vinculado a um caso; datas passadas viram "retroativo" com indicação visual; notificações automáticas em 3 dias antes, 1 dia antes e no dia — sem ação manual.
- **RN13/RN14/RN15/RN16**: disparo de WhatsApp exige telefone cadastrado; processado assíncrono via Lambda; todo envio (sucesso/falha) fica no histórico; até 3 retentativas automáticas em falha.
- **RN17/RN18**: upload de documento limitado a 10MB, tipos aceitos PDF/DOCX/JPG/PNG/JPEG.
- **RN19 (nova)**: nenhuma query de aplicação pode retornar ou modificar dados de um `escritorio_id` diferente do da sessão autenticada — isolamento de tenant é regra transversal a todos os módulos.

Detalhamento completo em [docs/produto/regras-negocio.md](docs/produto/regras-negocio.md); casos de uso/user stories por fluxo em [docs/produto/casos-de-uso.md](docs/produto/casos-de-uso.md).

## Requisitos não funcionais relevantes

- Telas/buscas/salvamentos < 2s; dashboard < 3s mesmo com volume alto.
- Senhas com bcrypt (nunca texto puro); tudo via HTTPS/TLS; dados sensíveis (CPF, telefone, dados processuais) tratados conforme LGPD.
- Suportar até 1.000 clientes / 5.000 casos **por escritório**, com número de escritórios crescendo sem degradação (índices por `escritorio_id` em todas as tabelas escopadas).
- Interface responsiva (desktop e mobile via browser), acessível (contraste, navegação por teclado, alt text).
- Logs de erro estruturados; mensagens de erro ao usuário sem detalhes técnicos internos.
- Isolamento de tenant é requisito de segurança crítico: nenhum vazamento de dado entre escritórios, mesmo em caso de bug de aplicação (defesa em profundidade — ver [docs/arquitetura/visao-geral.md](docs/arquitetura/visao-geral.md)).

## Desenvolvimento: testes e Git

- **Test-driven**: toda regra de negócio ou componente com lógica tem teste escrito antes da implementação. Meta de cobertura institucional (linha Web Apps do Portfólio, cobrada na prova de autoria): **75% backend / 25% frontend**; metas internas por camada (Services ~90%, Repositories/Controllers ~70-80%) garantem esse piso com folga, gate de CI. Ferramentas: Jest + Testing Library (unit/integração) e Playwright (E2E dos fluxos críticos). Detalhes em [docs/testes/estrategia-tdd.md](docs/testes/estrategia-tdd.md).
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`), branches `feature/<slug>`/`fix/<slug>`, sem commit direto em `main`, migration e teste sempre no mesmo commit da mudança que os motivou. Detalhes em [docs/git/commits-e-branches.md](docs/git/commits-e-branches.md). Documentação também replicada na Wiki do GitHub nos marcos da disciplina — ver [docs/git/wiki-github.md](docs/git/wiki-github.md).
- **Estrutura de código e UI**: convenções de pastas/nomes por camada em [docs/app/estrutura-codigo.md](docs/app/estrutura-codigo.md); Tailwind + shadcn/ui sempre via tokens de tema (nunca `bg-blue-500` literal) em [docs/app/design-system.md](docs/app/design-system.md); regras de reuso de componentes/hooks em [docs/app/modularizacao.md](docs/app/modularizacao.md).
- **Qualidade e deploy**: análise estática via SonarCloud (Quality Gate obrigatório em todo PR) em [docs/qualidade/analise-estatica.md](docs/qualidade/analise-estatica.md); monitoramento via New Relic em [docs/qualidade/observabilidade.md](docs/qualidade/observabilidade.md); pipeline de deploy (AWS Amplify + RDS, migrations, rollback) em [docs/deploy/deploy.md](docs/deploy/deploy.md).

## Autor / contexto

Projeto de portfólio (PAC Extensionista VII, Católica SC) de Lucas Affonso Klemke, evoluído a partir da necessidade real do escritório do Dr. Lucas Quintino para suportar múltiplos escritórios. RFC original e assets (mockups, diagramas C4, DER) versionados em `github.com/LucasKlemke/PAC-Extensionista-VII---RFC---CRM-Advocacia`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
