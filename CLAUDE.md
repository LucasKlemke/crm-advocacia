# CRM Advocacia — Multi-tenant (evolução do RFC do Escritório Lucas Quintino)

Monorepo npm com a API em NestJS (`apps/api`), o front em React + Vite (`apps/web`) e o código puro compartilhado entre os dois (`packages/compartilhado`). Este arquivo é a especificação do produto, evoluída a partir do RFC original do projeto (PAC Extensionista VII — Engenharia de Software, Católica SC). RFC original (base): https://github.com/LucasKlemke/PAC-Extensionista-VII---RFC---CRM-Advocacia/blob/main/README.md

> **Documentação completa:** este arquivo é o resumo executivo. O detalhamento técnico por área (banco de dados, estrutura do monorepo (API Nest, web React, pacote compartilhado), testes, git) vive em `docs/`, indexado em **[docs/README.md](docs/README.md)** — comece por lá antes de implementar qualquer parte do sistema.

## O que é o sistema

CRM simples para escritórios de advocacia (originado a partir da necessidade real do Dr. Lucas Quintino, advogado autônomo, OAB/SC 71.025), que resolve três problemas centrais: centralizar cadastro/histórico de clientes, dar visibilidade do andamento dos casos via kanban, e permitir disparo de mensagens de WhatsApp direto do sistema.

O sistema é **multi-tenant**: cada escritório cadastrado (`escritorio`) tem seus próprios dados totalmente isolados dos demais. Dentro de um escritório, pode haver **múltiplos usuários** (o advogado titular que se cadastrou + colaboradores convidados), compartilhando o mesmo conjunto de clientes, casos e templates do tenant.

## Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Backend (API) | NestJS 12 (ESM, Express 5) + TypeScript — `apps/api`; build de produção com tsup (esbuild) |
| Frontend | React 19 + Vite + React Router v7 + TypeScript — `apps/web` (SPA) |
| Código compartilhado | `@crm/compartilhado` (`packages/compartilhado`): DTOs, schemas Zod, enums e utilitários puros |
| Estado assíncrono no cliente | TanStack Query (React Query) |
| Estilo | Tailwind CSS |
| Autenticação | Sessão própria da API: cookie httpOnly `crm_sessao` (JWT HS256 via `jose`, `AUTH_SECRET`, `exp`/`iat` obrigatórios); `role` sempre lido do banco; login só aceita corpo JSON (urlencoded é recusado, anti-CSRF) |
| Validação | Zod — mesmos schemas no formulário (web) e no pipe da API |
| Banco de dados | PostgreSQL + Prisma ORM (`apps/api/prisma`) — Amazon RDS (deploy acadêmico, via Terraform) ou Supabase (deploy real), mesmo schema, ver [docs/deploy/deploy.md](docs/deploy/deploy.md) |
| Armazenamento de arquivos | S3 ou provedor S3-compatível (URL assinada) — Amazon S3 (deploy acadêmico) ou Supabase Storage (deploy real) |
| Jobs assíncronos e tempo real | `NotificacaoScheduler`: AWS Lambda + EventBridge Scheduler (ainda não implementado). Progresso de campanhas e conexão das instâncias: webhook assinado da UAZAPI + polling de fallback no processo da API + WebSocket `/api/ws` (`ws`), só onde há processo vivo (ECS) — ver [docs/arquitetura/tempo-real.md](docs/arquitetura/tempo-real.md) |
| WhatsApp | Uazapi (API não-oficial via QR Code, apenas envio) |
| Hosting | Deploy acadêmico (`crm-advocacia-pac`): Vercel só com a SPA (`apps/web/vercel.json`, proxy de `/api/*`) + AWS (ECS Fargate, ALB, CloudFront, RDS, S3, Secrets Manager) em Terraform (`infra/`). Deploy real (`crm-advocacia-supabase`): Vercel Services (`vercel.json` da raiz, `web` + `api` na mesma origem, `TEMPO_REAL_HABILITADO=false`) — ver [docs/deploy/deploy.md](docs/deploy/deploy.md) e [docs/deploy/aws-terraform.md](docs/deploy/aws-terraform.md) |
| CI/CD | GitHub Actions: `ci.yml` (lint, typecheck, cobertura, e2e, SonarCloud, `terraform fmt/validate`), `infra-plan.yml` (`terraform plan` em PR) e `deploy-aws.yml` (push na `main`: imagem ARM64 no ECR → migration em `run-task` → `terraform apply` → rollout conferido), com credencial AWS só por OIDC |
| Análise estática | ESLint (flat config do monorepo) + SonarCloud |
| Monitoramento | New Relic (agente Node na API) |
| Testes | Jest + `@swc/jest` (+ supertest na API, Testing Library no web) e Playwright (E2E contra o build de produção) |
| Componentes de UI | shadcn/ui sobre Tailwind, sempre via tokens de tema — ver [docs/app/design-system.md](docs/app/design-system.md) |

## Arquitetura (camadas do backend)

O browser fala com uma única origem: `/api/*` vai para a API Nest, o resto para a SPA (proxy do Vite em dev e no `vite preview`, Vercel Services no deploy real, rewrite da Vercel para o CloudFront no acadêmico). A exceção é o WebSocket `/api/ws`, que no deploy acadêmico vai direto ao CloudFront (`VITE_WS_URL`) autenticado por ticket. Todo request da API segue: **Auth (TenantGuard) → Tenant Context → Controller → Service → Repository** (persistência), ou **Service → Cliente Externo** (integrações).

- **Auth / TenantGuard** (`apps/api/src/comum/tenant`): lê e valida o cookie `crm_sessao` e resolve `usuarioId` + `escritorioId`; o `role` vem sempre do banco (RN19). Toda rota de tenant usa `@UseGuards(TenantGuard)` + `@Tenant() ctx`.
- **Tenant Context**: o `TenantContext` produzido pelo guard é o único jeito de chamar um Service — nenhum Repository é chamado sem ele.
- **Controllers** (Nest, `apps/api/src/<modulo>/*.controller.ts`): recebem HTTP, validam com `ValidacaoZodPipe(schema)` (schemas de `@crm/compartilhado/schemas`), delegam a Services e traduzem erros com `ErrosHttpFilter`. Nunca importam Repository (regra de lint).
- **Services** (`apps/api/src/dominio/services`): regras de negócio (isolamento entre tenants, CPF único por escritório, papéis, templates, retentativas etc.). Entram no container do Nest por token (`useValue` + `@Inject(TOKEN)`).
- **Repositories** (`apps/api/src/dominio/repositories`, Prisma): único ponto de acesso ao banco; toda query filtra por `escritorio_id`.
- **Clientes externos** (`apps/api/src/dominio/lib/external`): `UazapiClient` (WhatsApp), `S3Client` (documentos); `EmailClient` (SMTP) previsto, ainda não implementado.
- **Tempo real** (`apps/api/src/tempo-real`, `apps/api/src/webhooks`): webhook público `POST /api/webhooks/uazapi/:instanciaId/:assinatura` (HMAC do id com `UAZAPI_WEBHOOK_SECRET`; inválido → 404) e polling de fallback disparam `sincronizarPeloSistema` (log com origem `sistema`; o webhook cobre também campanhas concluídas nas últimas 24 h), e o evento `connection` dispara `verificarStatusPeloSistema` da instância; a mudança vai pelo barramento em memória `eventosCampanha` (por escritório; eventos `campanha.atualizada`, `campanha.removida`, `campanha.mensagens`, `instancia.atualizada`) ao WebSocket `/api/ws`, aberto com ticket de uso único (`GET /api/tempo-real/ticket`, 60 s, preso ao escritório da sessão). Variáveis: `API_PUBLIC_URL`, `UAZAPI_WEBHOOK_SECRET`, `WEB_ORIGINS`, `TEMPO_REAL_HABILITADO`, `TEMPO_REAL_POLLING_MS` (API) e `VITE_WS_URL` (web). Detalhes em [docs/arquitetura/tempo-real.md](docs/arquitetura/tempo-real.md).
- **Front** (`apps/web`): componentes → hooks TanStack Query (`hooks/`) → `apiFetch` (`lib/api-client.ts`) → `/api/*`. O hook `useTempoRealCampanhas` (montado uma vez no layout autenticado) mantém o WebSocket e atualiza o cache das campanhas e das instâncias. Nunca importa `@prisma/client` nem código da API (regra de lint); compartilha só `@crm/compartilhado`.

Serviço assíncrono separado: `NotificacaoScheduler` (Lambda) roda em background verificando prazos de **todos os escritórios** e acionando WhatsApp/e-mail — não depende de nenhum usuário estar com a interface aberta, e processa cada tenant de forma isolada.

## Monorepo e comandos

| Pasta | Pacote | O que é |
|---|---|---|
| `apps/api` | `@crm/api` | API NestJS + domínio (`src/dominio`: services, repositories, lib) + Prisma (`prisma/`) |
| `apps/web` | `@crm/web` | SPA React + Vite |
| `packages/compartilhado` | `@crm/compartilhado` | DTOs (`tipos/`), schemas Zod (`schemas/`), enums sem Prisma (`enums.ts`), utilitários puros (`utils/`, `auth/permissoes.ts`) |
| `e2e/` | — | Specs Playwright dos fluxos críticos |

Imports: na API, `@dominio/*` → `apps/api/src/dominio/*`; no web, `@/*` → `apps/web/src/*`; nos dois, `@crm/compartilhado/<caminho>`.

| Comando (raiz) | O que faz |
|---|---|
| `npm run dev:full` | Postgres (Docker, via `predev:full`) + API em :3001 (`tsx watch`) + web em :5173 (proxy `/api`) |
| `npm run dev:api` / `npm run dev:web` | Só a API (Postgres via `predev:api`) / só o web |
| `npm test` / `npm run test:coverage` | Jest de todos os pacotes / com cobertura + piso institucional |
| `npm run lint` / `npm run typecheck` | ESLint do monorepo / `tsc --noEmit` em cada pacote |
| `npm run build` / `npm start` | `apps/api/dist/main.mjs` (tsup) + `apps/web/dist` / API pelo script `start` do `@crm/api` (`--import ./dist/instrumentacao.mjs`) + `vite preview` do web |
| `npm run e2e` | Build + Playwright contra o build de produção (API :3001, web :4173) |
| `npm run prisma:migrate` | `prisma migrate dev` em `apps/api` |
| `npm run dev:tunnel` / `npm run ngrok:start` | Túnel ngrok para a API em :3001 (webhook da UAZAPI; use a URL como `API_PUBLIC_URL`) |
| `docker build -f apps/api/Dockerfile -t crm-api .` | Imagem de produção da API (contexto = raiz; o deploy gera `linux/arm64`) |
| `terraform fmt -check -recursive infra` / `terraform init -backend=false && terraform validate` | Checagens locais da infra (o segundo em `infra/bootstrap` e em `infra/terraform`); `plan`/`apply` só pelo passo a passo de [docs/deploy/aws-terraform.md](docs/deploy/aws-terraform.md) |

## Modelo de dados (22 tabelas)

`escritorio` (tenant) · `usuario` (perfil global) · `membro` (N:N usuário↔escritório com papel) · `convite` (pendências por e-mail) · `cliente` (FK escritório; soft delete via `soft_deleted_at`) · `comentario` (ancorado por `escopo`+`escopo_id`, sem FK; hoje `cliente` e `caso`) · `log` (auditoria append-only: quem/quando/o quê + diff) · `tipo_status` (referência global, seed fixo de 6 tipos, só o administrador do sistema edita) · `status` (FK escritório + tipo_status; colunas do kanban, configuráveis pelo próprio escritório) · `tipo_processo` (FK escritório; natureza do processo com nome/cor/ícone, cadastrada pelo escritório — substituiu o antigo título livre do caso) · `caso` (FK escritório + cliente + status + tipo_processo + responsável opcional; campo `valor`) · `prazo` (FK caso) · `notificacoes_prazo` (FK prazo; controla envio 3d/1d/0d antes) · `template_mensagem` (FK escritório) · `historico_mensagem` (FK cliente + template) · `anotacao` (FK caso — a ser absorvida por `comentario` com escopo `caso`) · `documento` (FK caso, máx 10MB, tipos PDF/DOCX/JPG/PNG/JPEG) · `instancia_whatsapp` (FK escritório; vínculo com uma instância UAZAPI, guarda o token de envio; soft delete via `soft_deleted_at`) · `campanha` (FK escritório + instância opcional + criador; disparo em massa a partir de CSV, guarda o `uazapi_folder_id`) · `campanha_item` (FK campanha; uma mensagem já renderizada por destinatário, snapshot imutável) · `evento` (FK escritório + criador; compromisso da agenda com início/fim, modalidade presencial/online e vínculo opcional e exclusivo a caso ou cliente; soft delete via `soft_deleted_at`) · `evento_participante` (FK evento + membro; quem participa do evento, único por par). Ver detalhamento completo em [docs/database/schema.md](docs/database/schema.md).

Banco local sobe via Docker Compose ([docs/database/docker-setup.md](docs/database/docker-setup.md)); toda alteração de schema é feita via migration do Prisma, nunca `db push`, com histórico auditável em `prisma/migrations/` ([docs/database/migrations-prisma.md](docs/database/migrations-prisma.md)).

## Regras de negócio essenciais

- **RN02 (revisada)**: sistema multi-tenant — cadastro de escritório é self-service pela UI (cria o tenant + o usuário titular); um escritório nunca acessa dados de outro.
- **RN02a**: usuário titular pode convidar/cadastrar colaboradores dentro do próprio escritório; apenas o titular gerencia usuários (criar, desativar, promover).
- **RN04/RN05**: cliente nunca é excluído permanentemente — "desativar" grava `cliente.soft_deleted_at` (ativo = `NULL`), operação reversível por "Restaurar"; CPF é armazenado sem máscara e é único **por escritório** (não globalmente).
- **RN06/RN07**: todo caso precisa de cliente ativo e de um `status` do escritório; nunca existe "solto".
- **RN08/RN09**: casos arquivados saem do kanban mas ficam no histórico; um `status` só pode ser removido se não tiver casos vinculados.
- **RN10/RN11/RN12**: prazo sempre vinculado a um caso; datas passadas viram "retroativo" com indicação visual; notificações automáticas em 3 dias antes, 1 dia antes e no dia — sem ação manual.
- **RN13/RN14/RN15/RN16**: disparo de WhatsApp exige telefone cadastrado; processado assíncrono via Lambda; todo envio (sucesso/falha) fica no histórico; até 3 retentativas automáticas em falha.
- **RN17/RN18**: upload de documento limitado a 10MB, tipos aceitos PDF/DOCX/JPG/PNG/JPEG.
- **RN19 (nova)**: nenhuma query de aplicação pode retornar ou modificar dados de um `escritorio_id` diferente do da sessão autenticada — isolamento de tenant é regra transversal a todos os módulos.
- **RN30 (nova)**: instância de WhatsApp nunca é apagada fisicamente — excluir grava `soft_deleted_at`, porque a linha é a única cópia do `uazapi_token` e sem ela toda campanha daquela instância perde o canal de controle com a UAZAPI. Vale também para a sincronização, que marca a instância ausente de `/instance/all` em vez de removê-la e a restaura quando ela reaparece.
- **RN31 (nova)**: agenda (`/agenda`) é compartilhada — todo membro do escritório vê e cria eventos do tenant — e o vínculo do evento é opcional e **exclusivo**: `caso_id` XOR `cliente_id`, ou nenhum dos dois, com o alvo validado contra o escritório da sessão antes de qualquer escrita. Editar/excluir cabe ao autor, `owner` ou `admin`, e excluir é soft delete; sem recorrência e sem notificações nesta versão.
- **RN22 (nova)**: todo caso tem um `tipo_processo` obrigatório do próprio escritório no lugar de título livre; nome único por escritório, escrita restrita a owner/admin, e tipo com processos vinculados não pode ser excluído.
- **RN20 (nova)**: toda escrita gera um registro em `log` (quem — usuário ou o próprio sistema —, quando, o quê e o diff dos campos), gravado na mesma transação da mudança — escrita que falha não deixa log, e mudança efetivada nunca fica sem log. Tabela append-only; ação em lote gera um log por entidade afetada.
- **RN21 (nova)**: comentários (`comentario`) substituem campos livres de observação, são ancorados por `escopo`+`escopo_id` e o alvo é validado contra o tenant antes de qualquer escrita. Editar é exclusivo do autor; excluir (soft) cabe ao autor, `owner` ou `admin`.

Detalhamento completo em [docs/produto/regras-negocio.md](docs/produto/regras-negocio.md); casos de uso/user stories por fluxo em [docs/produto/casos-de-uso.md](docs/produto/casos-de-uso.md).

## Requisitos não funcionais relevantes

- Telas/buscas/salvamentos < 2s; dashboard < 3s mesmo com volume alto.
- Senhas com bcrypt (nunca texto puro); tudo via HTTPS/TLS; dados sensíveis (CPF, telefone, dados processuais) tratados conforme LGPD.
- Suportar até 1.000 clientes / 5.000 casos **por escritório**, com número de escritórios crescendo sem degradação (índices por `escritorio_id` em todas as tabelas escopadas).
- Interface responsiva (desktop e mobile via browser), acessível (contraste, navegação por teclado, alt text).
- Logs de erro estruturados; mensagens de erro ao usuário sem detalhes técnicos internos.
- Isolamento de tenant é requisito de segurança crítico: nenhum vazamento de dado entre escritórios, mesmo em caso de bug de aplicação (defesa em profundidade — ver [docs/arquitetura/visao-geral.md](docs/arquitetura/visao-geral.md)).

## Desenvolvimento: testes e Git

- **Test-driven**: toda regra de negócio ou componente com lógica tem teste escrito antes da implementação, ao lado do arquivo (`*.test.ts(x)`). Meta de cobertura institucional (linha Web Apps do Portfólio, cobrada na prova de autoria): **75% backend (`apps/api` + `packages/compartilhado`) / 25% frontend (`apps/web`)**, conferida por `scripts/verificar-piso-cobertura.mjs`; metas internas por camada nos `jest.config.cjs` de cada pacote (Services ~90%, Repositories/Controllers ~70-80%), gate de CI. Ferramentas: Jest + `@swc/jest` (supertest na API, Testing Library no web) e Playwright (E2E contra o build de produção). Detalhes em [docs/testes/estrategia-tdd.md](docs/testes/estrategia-tdd.md).
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`), branches `feature/<slug>`/`fix/<slug>`, sem commit direto em `main`, migration e teste sempre no mesmo commit da mudança que os motivou. Detalhes em [docs/git/commits-e-branches.md](docs/git/commits-e-branches.md). Documentação também replicada na Wiki do GitHub nos marcos da disciplina — ver [docs/git/wiki-github.md](docs/git/wiki-github.md).
- **Estrutura de código e UI**: convenções de pastas/nomes por pacote e camada (API Nest, domínio, web, compartilhado) em [docs/app/estrutura-codigo.md](docs/app/estrutura-codigo.md); Tailwind + shadcn/ui sempre via tokens de tema (nunca `bg-blue-500` literal) em [docs/app/design-system.md](docs/app/design-system.md); regras de reuso de componentes/hooks em [docs/app/modularizacao.md](docs/app/modularizacao.md).
- **Qualidade e deploy**: análise estática via SonarCloud (Quality Gate obrigatório em todo PR) em [docs/qualidade/analise-estatica.md](docs/qualidade/analise-estatica.md); monitoramento via New Relic em [docs/qualidade/observabilidade.md](docs/qualidade/observabilidade.md); pipeline de deploy (Vercel, dois Projects — RDS+S3 para avaliação acadêmica, Supabase para produção real —, migrations, rollback) em [docs/deploy/deploy.md](docs/deploy/deploy.md).

## Uso de subagentes

Ao elaborar planos ou executar tarefas propostas pelo usuário, priorize o uso de subagentes (Agent tool) para paralelizar o trabalho, acelerar a execução e preservar o contexto da conversa principal. Delegue investigações, buscas amplas no código e etapas independentes a subagentes ao invés de executá-las diretamente sempre que fizer sentido.

## Autor / contexto

Projeto de portfólio (PAC Extensionista VII, Católica SC) de Lucas Affonso Klemke, evoluído a partir da necessidade real do escritório do Dr. Lucas Quintino para suportar múltiplos escritórios. RFC original e assets (mockups, diagramas C4, DER) versionados em `github.com/LucasKlemke/PAC-Extensionista-VII---RFC---CRM-Advocacia`.
