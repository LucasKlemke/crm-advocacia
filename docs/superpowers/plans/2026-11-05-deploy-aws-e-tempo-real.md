# Deploy AWS (Terraform + GitHub Actions) e campanhas em tempo real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A API passa a rodar na AWS (ECS Fargate atrás de CloudFront/ALB, RDS, S3), provisionada por Terraform e publicada pelo GitHub Actions, e o progresso das campanhas de WhatsApp chega ao navegador em tempo real (webhook UAZAPI assinado → sincronização → WebSocket).

**Architecture:** Webhook e um polling de fallback no servidor disparam `campanhaService.sincronizarPeloSistema`; toda sincronização que muda algo publica `campanha.atualizada` num barramento em memória por escritório; um servidor `ws` em `/api/ws`, autenticado por ticket JWT de 60 s, entrega os eventos ao escritório certo; o web atualiza o cache do TanStack Query. Infra em `infra/bootstrap` (estado + OIDC) e `infra/terraform` (ambiente `pac`).

**Tech Stack:** NestJS 12 (Express 5, ESM), `ws`, `jose`, Prisma 6, React 19 + TanStack Query, Playwright, Terraform ≥ 1.11 + `hashicorp/aws` ~> 6.0, Docker (ARM64), GitHub Actions (OIDC).

**Spec:** `docs/superpowers/specs/2026-11-05-deploy-aws-e-tempo-real-design.md` (leia a seção "Decisões após a revisão de construtor": ela prevalece sobre o texto anterior do spec).

## Global Constraints

- CLAUDE.md vale inteiro: TDD (teste antes, ao lado do arquivo), Conventional Commits em português, Controller nunca importa Repository, Service só via `TenantContext` (exceto os métodos "PeloSistema" desta entrega, que recebem ids e derivam o `escritorioId` da própria linha), toda escrita com log na mesma transação (RN20), toda query filtrada por `escritorio_id` (RN19).
- Mensagens de commit terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Sem `git push`, sem `terraform apply`/`destroy` contra conta real, sem chamadas a contas externas (AWS, Vercel, GitHub API). Terraform local só com `fmt`, `init -backend=false` e `validate` (nada de `plan`/`apply`, que exigem credencial).
- Nunca commitar `.superpowers/`, `.env*` (exceto `.env.example`), `*.tfstate*`, `.terraform/`, `terraform.tfvars`.
- Node 24. API sobe sempre com `--import ./dist/instrumentacao.js`.
- Variáveis novas da API: `API_PUBLIC_URL`, `UAZAPI_WEBHOOK_SECRET`, `WEB_ORIGINS` (vírgula), `TEMPO_REAL_HABILITADO` (padrão `true`; só `"false"` desliga), `TEMPO_REAL_POLLING_MS` (padrão `15000`; `0` desliga). Web: `VITE_WS_URL`.
- Constantes: debounce do webhook 2000 ms; ticket JWT HS256 com `aud: "crm-ws"`, validade 60 s, uso único (`jti`); ping a cada 25000 ms; máx. 5 conexões WS por usuário; fechamento 4401 (não autenticado) e 4403 (origem proibida); throttle de invalidação de mensagens no web 3000 ms; reconexão 1 s → 30 s exponencial.
- Contrato de evento WS (servidor → cliente, JSON): `{ "tipo": "pronto" }` e `{ "tipo": "campanha.atualizada", "campanha": CampanhaDTO }` (`packages/compartilhado/src/tipos/campanha.ts`).
- Terraform: região padrão `us-east-1`; prefixo de nomes `crm-pac`; `default_tags` `Projeto=crm-advocacia`, `Ambiente=pac`, `GerenciadoPor=terraform`; `required_version = ">= 1.11"`.
- Piso de cobertura e thresholds dos `jest.config.cjs` continuam passando; `npm run lint`, `npm run typecheck`, `npm test` verdes ao fim de cada task que toca código.

## Review Focus

1. Evento de campanha do escritório A nunca chega a um socket do escritório B, nem quando o mesmo usuário é membro dos dois (o socket fica preso ao `escritorioId` do ticket) → teste de integração na Task 6.
2. Webhook com assinatura de outra instância, assinatura truncada ou instância soft-deleted → 404/ignorado sem chamar a UAZAPI → testes na Task 5.
3. Rajada de 50 webhooks da mesma instância em 1 s → uma única sincronização (debounce) → teste na Task 5.
4. UAZAPI fora do ar durante polling/webhook → erro logado, laço continua, nada quebra o processo (sem unhandled rejection) → teste na Task 5.
5. Navegador perde a rede/servidor reinicia → cliente reconecta pedindo **ticket novo** (ticket é de uso único) e o indicador volta para "Ao vivo" → teste na Task 7.

---

### Task 1: Log de sistema (autor nulo + origem)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Log`: `usuarioId String?`, relação `usuario Usuario?`; enum novo `OrigemLog { usuario sistema }` mapeado para `origem_log`; campo `origem OrigemLog @default(usuario)`)
- Create: `apps/api/prisma/migrations/<timestamp>_log_origem_sistema/migration.sql` (via `npm run prisma:migrate -- --name log_origem_sistema`; nunca `db push`)
- Modify: `apps/api/src/dominio/services/log.service.ts`, `log.service.test.ts`, `apps/api/src/dominio/repositories/log.repository.ts` (+ teste, se tipos mudarem)
- Modify: `docs/produto/regras-negocio.md` (RN20: "quem (usuário ou sistema)"), `docs/database/schema.md` (tabela `log`), CLAUDE.md (RN20 linha: "quem — usuário ou sistema —")

**Interfaces:**
- Produces: `logService.registrarSistema(escritorioId: string, registro: RegistroLog, db?: Db): Promise<Log>` — grava `origem: "sistema"`, sem `usuario`.

- [ ] Step 1: teste `registrarSistema grava origem sistema sem autor e no escritório informado` (espera `logRepository.create` chamado com `origem: "sistema"`, `escritorio.connect.id === escritorioId`, sem chave `usuario`); teste que `registrar` continua gravando `origem` padrão (sem passar `origem`) e `usuario.connect`.
- [ ] Step 2: `npx jest apps/api/src/dominio/services/log.service.test.ts` → FAIL.
- [ ] Step 3: schema + migration + implementação. Conferir com `grep -rn "\.usuario\b\|usuarioId" apps/api/src` todo consumidor de `log.usuario`/`usuarioId` que agora é anulável e ajustar tipos.
- [ ] Step 4: `npm run typecheck && npm test -w @crm/api` → PASS.
- [ ] Step 5: commit `feat(log): registra escritas do sistema com autor nulo e origem sistema`.

### Task 2: Assinatura e URL do webhook por instância

**Files:**
- Create: `apps/api/src/dominio/lib/auth/assinatura-webhook.ts` + `.test.ts`

**Interfaces:**
- Produces:
  - `assinarInstancia(instanciaId: string, segredo: string): string` — `base64url(HMAC-SHA256(segredo, instanciaId))` com `node:crypto`.
  - `assinaturaValida(instanciaId: string, assinatura: string, segredo: string): boolean` — compara com `timingSafeEqual`; tamanhos diferentes → `false` sem lançar.
  - `urlWebhookDaInstancia(instanciaId: string, env?: NodeJS.ProcessEnv): string | null` — `${API_PUBLIC_URL sem barra final}/api/webhooks/uazapi/${instanciaId}/${assinatura}`; `null` se faltar `API_PUBLIC_URL` ou `UAZAPI_WEBHOOK_SECRET`.

- [ ] Step 1: testes: assinatura é determinística e url-safe (`/^[A-Za-z0-9_-]+$/`); `assinaturaValida` true para a própria, false para a de outro id, false para string vazia/truncada, false com segredo diferente; `urlWebhookDaInstancia` remove barra final de `API_PUBLIC_URL`, devolve `null` sem cada uma das duas envs.
- [ ] Step 2: rodar → FAIL. Step 3: implementar. Step 4: rodar → PASS.
- [ ] Step 5: commit `feat(webhook): assinatura HMAC por instância para a URL do webhook UAZAPI`.

### Task 3: Registrar o webhook na UAZAPI ao criar/conectar/sincronizar instâncias

**Files:**
- Modify: `apps/api/src/dominio/lib/external/uazapi-client.ts` (+ teste)
- Modify: `apps/api/src/dominio/services/instancia-whatsapp.service.ts` (+ teste)

**Interfaces:**
- Consumes: `urlWebhookDaInstancia` (Task 2).
- Produces: `uazapiClient.configurarWebhook(token: string, url: string): Promise<void>`.

- [ ] Step 1: **Pesquisa obrigatória** antes do teste: na documentação da UAZAPI (https://docs.uazapi.com, uazapiGO v2), confirmar o endpoint de webhook da instância (esperado `POST /webhook`, header `token`), o corpo (esperado `{ url, enabled: true, events: [...], excludeMessages: [...] }`) e os nomes de evento de progresso de envio em massa e status de mensagem (esperados `sender` e `messages_update`). Não assinar eventos de mensagens recebidas (`messages`). Registrar o que a doc diz num comentário curto no client, citando a URL consultada. Se a doc não for acessível, usar o formato esperado acima e escrever no comentário que não foi confirmado.
- [ ] Step 2: testes do client (fetch mockado, mesmo padrão dos testes existentes): método, path, header `token`, corpo com `url` e os eventos; erro HTTP → lança o mesmo tipo de erro dos outros métodos.
- [ ] Step 3: testes do service: ao criar e ao conectar instância, chama `configurarWebhook(token, urlWebhookDaInstancia(id))` quando a URL não é `null`; com URL `null` não chama; falha de `configurarWebhook` **não** derruba criação/conexão (vira `console.warn` com id da instância, sem token); a sincronização de instâncias (método existente que reconcilia `/instance/all`) reconfigura o webhook das instâncias ativas (idempotente).
- [ ] Step 4: FAIL → implementar → PASS (`npm test -w @crm/api`).
- [ ] Step 5: commit `feat(instancias): registra o webhook assinado na UAZAPI`.

### Task 4: Barramento de eventos + sincronização pelo sistema

**Files:**
- Create: `apps/api/src/dominio/lib/tempo-real/eventos-campanha.ts` + `.test.ts`
- Modify: `apps/api/src/dominio/services/campanha.service.ts` (+ teste), `apps/api/src/dominio/repositories/campanha.repository.ts` (+ teste)
- Modify: `apps/api/prisma/schema.prisma` (`@@index([instanciaWhatsappId, status])` em `Campanha`) + migration `campanha_indice_instancia_status`

**Interfaces:**
- Produces:
  - `type EventoCampanha = { tipo: "campanha.atualizada"; escritorioId: string; campanha: CampanhaDTO }`
  - `eventosCampanha.publicar(evento: EventoCampanha): void` e `eventosCampanha.assinar(escritorioId: string, ouvinte: (e: EventoCampanha) => void): () => void` (retorna cancelamento). Exceção de um ouvinte não impede os outros.
  - `campanhaService.sincronizarPeloSistema(campanhaId: string): Promise<boolean>` — `true` se mudou. Lê a campanha + token da instância sem tenant da sessão; instância ausente/soft-deleted ou folder ausente → `false`; usa `compararSincronizacao`; grava com `logService.registrarSistema(campanha.escritorioId, ...)` na mesma transação.
  - `campanhaService.idsAtivosDaInstancia(instanciaId: string): Promise<string[]>` — status `agendada|enviando|pausada`.
  - `campanhaService.idsParaPolling(): Promise<string[]>` — status `agendada|enviando` com instância não soft-deleted.
  - `sincronizar(ctx, id)` (existente) e `sincronizarPeloSistema` publicam `campanha.atualizada` **depois do commit** quando mudou. O builder localiza o mapeamento existente de entidade → `CampanhaDTO` (o que o controller devolve) e o reutiliza (mover para o domínio se hoje estiver no controller); o evento nunca contém `uazapiToken`.

- [ ] Step 1: testes do barramento: ouvinte do escritório A não recebe evento de B; cancelamento para de entregar; ouvinte que lança não impede o próximo.
- [ ] Step 2: testes do service: `sincronizarPeloSistema` grava + `registrarSistema` com `escritorioId` da campanha e publica um evento; sem mudança não grava nem publica e devolve `false`; instância soft-deleted → `false` sem chamar UAZAPI; `sincronizar` (usuário) também publica quando muda; publicação acontece só após a transação resolver (transação que rejeita → nenhum evento).
- [ ] Step 3: testes do repository para as duas consultas de ids (filtros de status e `softDeletedAt: null`).
- [ ] Step 4: FAIL → schema/migration + implementação → PASS.
- [ ] Step 5: commit `feat(campanhas): sincronização pelo sistema publica campanha.atualizada`.

### Task 5: Webhook assinado, debounce e polling de fallback

**Files:**
- Create: `apps/api/src/tempo-real/agendador-sincronizacao.ts` + `.test.ts`
- Create: `apps/api/src/tempo-real/config-tempo-real.ts` + `.test.ts` (lê `TEMPO_REAL_HABILITADO`, `TEMPO_REAL_POLLING_MS`, `WEB_ORIGINS`)
- Create: `apps/api/src/tempo-real/tempo-real.module.ts`
- Modify: `apps/api/src/webhooks/uazapi-webhook.controller.ts` (+ teste), `webhooks.module.ts`, `apps/api/src/app.module.ts`, `apps/api/src/criar-app.ts` (text parser passa a cobrir `/api/webhooks/uazapi` e subcaminhos)

**Interfaces:**
- Consumes: Task 2 `assinaturaValida`; Task 4 `sincronizarPeloSistema`, `idsAtivosDaInstancia`, `idsParaPolling`.
- Produces:
  - `lerConfigTempoReal(env?: NodeJS.ProcessEnv): { habilitado: boolean; pollingMs: number; origensWeb: string[] }`
  - `class AgendadorSincronizacao` (provider Nest via token `AGENDADOR_SINCRONIZACAO`) com `agendarInstancia(instanciaId: string): void` (debounce 2000 ms por instância), `iniciarPolling(): void`, `parar(): void` (limpa timers; chamado em `onModuleDestroy`). Polling usa `setInterval(...).unref()`, não reentra se a rodada anterior não terminou, e sincroniza em sequência. Erros: `console.error` com ids, nunca rejeição solta. Desabilitado (`habilitado=false`) → `agendarInstancia` e `iniciarPolling` são no-op. Em `NODE_ENV=test` o polling não inicia automaticamente.
  - Rota nova `POST /api/webhooks/uazapi/:instanciaId/:assinatura`: assinatura inválida → 404 sem trabalho; válida → 200 `{ ok: true }` e `agendarInstancia`. Log só de metadados (tipo do evento, bytes, instanciaId). Rota antiga `POST /api/webhooks/uazapi` mantém comportamento atual.

- [ ] Step 1: testes de config: padrões, `"false"` desliga, `"0"` desliga polling, `WEB_ORIGINS` com espaços/vazios.
- [ ] Step 2: testes do agendador com `jest.useFakeTimers()`: 50 chamadas em 1 s → 1 `idsAtivosDaInstancia` + 1 sync por id após 2000 ms; instâncias diferentes não se atrasam; polling chama `idsParaPolling` a cada `pollingMs`, não reentra; falha da UAZAPI numa campanha não impede a próxima nem a próxima rodada; `parar()` cancela pendências; desabilitado não faz nada.
- [ ] Step 3: testes do controller (supertest, padrão de `uazapi-webhook.controller.test.ts`): assinatura válida → 200 e agendou; inválida/de outra instância/truncada → 404 e não agendou; corpo não-JSON aceito; rota antiga continua 200.
- [ ] Step 4: FAIL → implementar → PASS (`npm test -w @crm/api`, `npm run lint`).
- [ ] Step 5: commit `feat(webhook): webhook assinado agenda sincronização com debounce e polling de fallback`.

### Task 6: Ticket e servidor WebSocket `/api/ws`

**Files:**
- Modify: `apps/api/package.json` (dependências `ws` e dev `@types/ws`, versões estáveis atuais fixadas com `^`)
- Modify: `apps/api/src/dominio/lib/auth/sessao-jwt.ts` (+ teste): ticket
- Create: `apps/api/src/tempo-real/tempo-real.controller.ts` + `.test.ts` (`GET /api/tempo-real/ticket`)
- Create: `apps/api/src/tempo-real/servidor-ws.ts` + `servidor-ws.test.ts` (integração com porta efêmera)
- Modify: `apps/api/src/main.ts` (anexa o servidor WS ao `app.getHttpServer()` quando habilitado; fecha no shutdown)
- Modify: `apps/api/.env.example`, `.github/workflows/ci.yml` (env dummy das variáveis novas)

**Interfaces:**
- Consumes: Task 4 `eventosCampanha.assinar`; Task 5 `lerConfigTempoReal`; `resolverTenantContext` (existente em `apps/api/src/comum/tenant/`), `TenantGuard`/`@Tenant()`.
- Produces:
  - `assinarTicketWs({ sub, escritorioId }): Promise<{ ticket: string; jti: string }>` e `verificarTicketWs(ticket): Promise<{ sub: string; escritorioId: string; jti: string } | null>` (HS256, mesma chave da sessão, `aud: "crm-ws"`, `exp` 60 s, `jti` aleatório; `exp`/`iat`/`jti` obrigatórios; token de sessão comum é rejeitado por `aud`).
  - `GET /api/tempo-real/ticket` (TenantGuard) → `200 { ticket }`; desabilitado → 404.
  - `anexarServidorWs(servidor: http.Server, opcoes: { origensWeb: string[] }): { fechar(): Promise<void> }` — `WebSocketServer({ noServer: true })` tratando `upgrade` só para `pathname === "/api/ws"` (outros paths: `socket.destroy()`); ticket em `?ticket=`; ticket inválido/expirado/reusado → fecha 4401; `Origin` presente e fora de `origensWeb` e diferente do host da requisição → 4403; resolve tenant pelo banco (membro ativo, `escritorioId` do ticket) antes de assinar eventos; envia `{tipo:"pronto"}`; repassa `campanha.atualizada` do escritório (sem `escritorioId` no payload enviado); ping 25000 ms, encerra quem não respondeu; 6ª conexão do mesmo usuário fecha a mais antiga; ao fechar cancela a assinatura. Registro de `jti` usados em memória com expiração.

- [ ] Step 1: testes do ticket: round-trip; expirado (fake clock ou `exp` no passado) → null; token de sessão → null; ticket de sessão sem `jti` → null.
- [ ] Step 2: testes de integração (`servidor-ws.test.ts`, servidor http real em porta 0, `resolverTenantContext` mockado): sem ticket → 4401; ticket reusado → 4401 na segunda; origem proibida → 4403; dois clientes de escritórios A e B, publicar para A → só A recebe, com `tipo` e `campanha`; mesmo usuário com tickets de A e B em dois sockets → cada um só recebe o seu; desconectar cancela assinatura (publicar depois não lança); path diferente de `/api/ws` não faz upgrade.
- [ ] Step 3: teste do controller do ticket: 200 com ticket verificável, 401 sem sessão, 404 desabilitado.
- [ ] Step 4: FAIL → implementar → PASS; `npm run build -w @crm/api` e subir `npm run start -w @crm/api` localmente para conferir que o bundle ESM do tsup carrega `ws` (Ctrl-C depois; não deixar processo órfão).
- [ ] Step 5: commit `feat(tempo-real): WebSocket /api/ws autenticado por ticket entrega campanha.atualizada por escritório`.

### Task 7: Web — conexão em tempo real e indicador "Ao vivo"

**Files:**
- Create: `apps/web/src/hooks/use-tempo-real-campanhas.ts` + `.test.ts`
- Create: `apps/web/src/lib/tempo-real.ts` + `.test.ts` (conexão: ticket → URL → `WebSocket`, backoff)
- Modify: layout autenticado (o componente de shell que envolve as rotas logadas — o builder localiza via `rotas.tsx`) para montar o hook uma vez; `apps/web/src/paginas/campanhas/detalhe/_components/detalhe-campanha.tsx` (+ teste) para o indicador; `apps/web/vite.config.ts` (`ws: true` no proxy `/api`); `apps/web/src/vite-env.d.ts` ou equivalente (`VITE_WS_URL`)

**Interfaces:**
- Consumes: `apiFetch` (`apps/web/src/lib/api-client.ts`), query keys de `use-campanhas.ts` (`["campanhas"]`, `["campanhas","detalhe",id,pagina]`, `["campanhas","mensagens",id,pagina]`), contrato WS dos Global Constraints.
- Produces:
  - `montarUrlWs(ticket: string, base: string | undefined, localizacao: Location): string` — com `base` → `${base}/api/ws?ticket=`; sem → `ws(s)://${location.host}/api/ws?ticket=` conforme protocolo da página.
  - `useTempoRealCampanhas(): void` e `useEstadoTempoReal(): "conectado" | "conectando" | "indisponivel"` (contexto ou store simples; o builder escolhe, sem dependência nova).
  - Comportamento: pede ticket (`GET /api/tempo-real/ticket`); 404 → `indisponivel` e não tenta mais; outra falha/fechamento → reconecta com backoff 1 s, 2 s, 4 s… até 30 s, **sempre com ticket novo**; ao receber `campanha.atualizada`: `setQueryData` em todas as queries `["campanhas","detalhe",id,*]` em cache (mescla campos da campanha) e na lista `["campanhas"]` se ela guarda array de campanhas (o builder confere o formato), e `invalidateQueries({queryKey:["campanhas","mensagens",id]})` com throttle 3000 ms por campanha; fecha socket ao desmontar/logout.
  - Detalhe da campanha mostra "Ao vivo" (estado `conectado`) ou "Atualização manual" (demais), com tokens de tema (sem cor literal), `aria-live="polite"`; botão Sincronizar continua.

- [ ] Step 1: testes de `montarUrlWs` (http→ws, https→wss, base com barra final).
- [ ] Step 2: testes do hook com `WebSocket` falso global e `apiFetch` mockado: conecta com ticket; evento atualiza o cache do detalhe sem refetch; 404 no ticket → `indisponivel` e nenhuma nova tentativa após avançar timers; fechamento → nova tentativa após 1000 ms pedindo ticket novo; desmontar fecha o socket; throttle de invalidação de mensagens (dois eventos em 1 s → 1 invalidação).
- [ ] Step 3: teste do detalhe: mostra "Ao vivo" quando conectado e "Atualização manual" quando não.
- [ ] Step 4: FAIL → implementar → PASS (`npm test -w @crm/web`, `npm run lint`, `npm run typecheck`).
- [ ] Step 5: commit `feat(web): progresso de campanhas em tempo real via WebSocket`.

### Task 8: E2E com UAZAPI falsa

**Files:**
- Create: `e2e/fake-uazapi.mjs` (Node `http`, porta 3999): `POST /sender/listfolders`/`GET` conforme o client usa (o builder confere método/path em `uazapi-client.ts`) devolvendo uma pasta com contadores; `POST /__fake/contadores` muda os contadores; `/sender/listmessages` → lista vazia; `/webhook` → 200; qualquer outro → 200 `{}`.
- Create: `e2e/campanhas-tempo-real.spec.ts`
- Modify: `playwright.config.ts` (webServer extra para o fake; env da API: `UAZAPI_SERVER_URL=http://localhost:3999`, `UAZAPI_WEBHOOK_SECRET=segredo-e2e`, `TEMPO_REAL_POLLING_MS=0`), `.github/workflows/ci.yml` se precisar

**Interfaces:**
- Consumes: rota do webhook (Task 5), WS (Task 6), indicador e cache (Task 7), helpers de login/seed já usados nos specs existentes (o builder reaproveita o padrão de `e2e/*.spec.ts`, ex. cadastro via UI ou Prisma).

- [ ] Step 1: spec: cria escritório/usuário pelo fluxo usado nos outros specs; semeia instância (token fake) e campanha (`uazapiFolderId` = id da pasta do fake, status `enviando`, `totalDestinatarios` 10) direto no banco com Prisma; abre o detalhe; espera "Ao vivo"; muda contadores no fake (`logSucesso` 7); chama `POST /api/webhooks/uazapi/<id>/<assinatura>` (assinatura calculada no teste com `node:crypto` e `segredo-e2e`); espera ver o 7 na tela **sem clicar** em Sincronizar, em até 10 s.
- [ ] Step 2: `npm run e2e` → o spec novo FAIL antes da integração completa / PASS depois; todos os 33 anteriores continuam passando.
- [ ] Step 3: commit `test(e2e): progresso de campanha em tempo real com UAZAPI falsa`.

### Task 9: Imagem Docker da API e S3 por task role

**Files:**
- Create: `apps/api/Dockerfile`, `.dockerignore` (raiz)
- Modify: `apps/api/prisma/schema.prisma` (`binaryTargets = ["native", "rhel-openssl-3.0.x", "linux-arm64-openssl-3.0.x", "debian-openssl-3.0.x"]`)
- Modify: `apps/api/src/dominio/lib/external/s3-client.ts` (+ teste): `credentials` explícitas só quando `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` existem; senão omite (cadeia padrão do SDK → task role)
- Modify: `apps/api/package.json` script `migrar` = `prisma migrate deploy` (usado pelo run-task do deploy)

**Interfaces:**
- Produces: imagem que roda `node --enable-source-maps --import ./dist/instrumentacao.js dist/main.js` a partir de `/app/apps/api` como usuário não-root, porta 3001, e que também aceita o comando `npm run migrar -w @crm/api` (Prisma CLI presente na imagem final).

- [ ] Step 1: teste do s3-client: sem as envs de chave, o `AwsS3Client` é construído sem `credentials`; com elas, com.
- [ ] Step 2: FAIL → implementar → PASS.
- [ ] Step 3: Dockerfile multi-stage `node:24-bookworm-slim` + `openssl` + `ca-certificates`; `npm ci` com cache de camada pelo lock; `prisma generate`; `npm run build -w @crm/api`; estágio final com `npm ci --omit=dev -w @crm/api --include-workspace-root=false` (ou `npm prune`), mantendo `prisma` CLI disponível (mover `prisma` para `dependencies` da API se estiver em dev). `HEALTHCHECK` não (o ALB faz).
- [ ] Step 4: verificação local: `docker build -f apps/api/Dockerfile -t crm-api:local .` (arquitetura nativa) e `docker run --rm -d --name crm-api-teste -p 3101:3001 --env-file <arquivo temporário no scratchpad com DATABASE_URL apontando para host.docker.internal:5432 e o resto dummy> crm-api:local`; `curl -fsS localhost:3101/api/saude` → 200; `docker run --rm ... npm run migrar -w @crm/api` sai 0; parar e remover o container e a imagem de teste.
- [ ] Step 5: commit `build(api): imagem Docker de produção e S3 pela cadeia padrão de credenciais`.

### Task 10: Terraform — bootstrap (estado remoto + OIDC do GitHub)

**Files:**
- Create: `infra/bootstrap/{versions.tf,main.tf,variables.tf,outputs.tf,README.md}`
- Modify: `.gitignore` (`.terraform/`, `*.tfstate*`, `*.tfvars` exceto `*.tfvars.example`, `.terraform.lock.hcl` **fica versionado**)

**Interfaces:**
- Produces (outputs): `bucket_estado` (nome do bucket do estado), `role_deploy_arn`.
- Variáveis: `regiao` (padrão `us-east-1`), `repositorio_github` (`"LucasKlemke/crm-advocacia"` como padrão — o builder confere o `origin` com `git remote -v` e usa o owner/repo real), `prefixo` (`crm-pac`).
- Recursos: `aws_s3_bucket` do estado com nome `${prefixo}-tfstate-${account_id}`, versionamento, SSE-S3, block public access, `prevent_destroy`; `aws_iam_openid_connect_provider` `token.actions.githubusercontent.com` (client id `sts.amazonaws.com`); `aws_iam_role` `${prefixo}-github-deploy` com trust `StringEquals aud = sts.amazonaws.com` e `StringLike sub` em `repo:<owner>/<repo>:ref:refs/heads/main` e `repo:<owner>/<repo>:pull_request`, `max_session_duration` 3600, política `AdministratorAccess` anexada (simplificação documentada no README com a alternativa de menor privilégio). Estado do bootstrap fica local (README explica que o arquivo `terraform.tfstate` do bootstrap não é versionado e deve ser guardado pelo usuário).

- [ ] Step 1: escrever os arquivos.
- [ ] Step 2: `cd infra/bootstrap && terraform fmt -check && terraform init -backend=false && terraform validate` → "Success!".
- [ ] Step 3: commit `feat(infra): bootstrap do Terraform com estado remoto e OIDC do GitHub` (inclui `.terraform.lock.hcl`).

### Task 11: Terraform — ambiente `pac`

**Files:**
- Create: `infra/terraform/{versions.tf,providers.tf,variables.tf,outputs.tf,rede.tf,ecr.tf,iam.tf,segredos.tf,rds.tf,s3.tf,logs.tf,alb.tf,ecs.tf,cloudfront.tf,orcamento.tf,terraform.tfvars.example,backend.hcl.example,README.md}`

**Interfaces:**
- Backend: `backend "s3" { key = "pac/terraform.tfstate", use_lockfile = true, encrypt = true }` com `bucket`/`region` vindos de `-backend-config` (arquivo `backend.hcl` não versionado; `.example` versionado).
- Variáveis: `regiao`, `prefixo` (`crm-pac`), `image_tag` (string, sem padrão), `web_origins` (list(string)), `uazapi_server_url`, `uazapi_admin_token` (sensitive), `new_relic_license_key` (sensitive, padrão `""`), `new_relic_app_name` (padrão `crm-advocacia-pac`), `budget_email`, `budget_limit_usd` (padrão `30`), `db_instance_class` (padrão `db.t4g.micro`), `task_cpu` (`512`), `task_memory` (`1024`).
- Outputs: `api_url` (`https://<cloudfront domain>`), `ecr_repository_url`, `ecs_cluster`, `ecs_service`, `task_definition_family`, `subnets_publicas` (list), `sg_task`, `log_group`.
- Recursos (spec, seção "Por que cada peça" + decisões): VPC `10.20.0.0/16`, 2 subnets públicas e 2 privadas em AZs distintas, IGW, sem NAT; ECR com `image_tag_mutability = IMMUTABLE`, scan on push, lifecycle mantendo 10 imagens; SG do ALB (entrada 80 só da prefix list `com.amazonaws.global.cloudfront.origin-facing` via `data "aws_ec2_managed_prefix_list"`), SG da task (3001 só do SG do ALB; saída livre), SG do RDS (5432 só do SG da task); RDS Postgres 16 conforme spec; `random_password` (sem caracteres que quebrem URL); `random_password` para `AUTH_SECRET` (48) e `UAZAPI_WEBHOOK_SECRET` (32) e para o header de origem (32); secret `crm-pac/api` JSON com `AUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `UAZAPI_WEBHOOK_SECRET`, `UAZAPI_ADMIN_TOKEN`, `NEW_RELIC_LICENSE_KEY`; S3 de documentos com CORS para `web_origins` (`PUT`,`GET`,`HEAD`; headers `*`; `ETag` exposto); log group `/ecs/crm-pac-api` 14 dias; ALB + target group `ip` porta 3001 healthcheck `/api/saude`, `deregistration_delay = 30`, `idle_timeout = 120`; listener 80 com ação padrão 403 fixa e regra que encaminha quando `http_header X-Origem-CloudFront` = segredo; ECS cluster (Container Insights desligado), task definition Fargate ARM64 (`runtime_platform`), `environment` e `secrets` conforme spec (incluindo `API_PUBLIC_URL = https://<cloudfront>`, `WEB_ORIGINS = join(",", web_origins)`, `TEMPO_REAL_HABILITADO = "true"`, `AWS_S3_PREFIX = "documentos"`), execution role (ECR + logs + leitura do secret), task role (S3 do bucket: Get/Put/Delete/List no prefixo), service com `desired_count 1`, `assign_public_ip = true` nas subnets públicas, `deployment_circuit_breaker { enable = true, rollback = true }`, `health_check_grace_period_seconds = 60`, `enable_execute_command = false`; CloudFront com origem ALB (`http-only`, `origin_read_timeout 60`, header customizado), `Managed-CachingDisabled` + `Managed-AllViewerExceptHostHeader`, todos os métodos, `viewer_protocol_policy = "https-only"`, `price_class = "PriceClass_100"`, certificado padrão; budget mensal com notificações em 80% e 100% para `budget_email`.
- Dependência circular CloudFront ↔ `API_PUBLIC_URL`: o domínio do CloudFront só depende do ALB, e a task definition depende do CloudFront — sem ciclo; o builder confirma no `validate`/grafo.

- [ ] Step 1: escrever os arquivos (sem módulos próprios).
- [ ] Step 2: `cd infra/terraform && terraform fmt -check && terraform init -backend=false && terraform validate` → "Success!".
- [ ] Step 3: conferir com `grep` que nenhum valor sensível tem padrão no código e que `terraform.tfvars`/`backend.hcl` estão no `.gitignore`.
- [ ] Step 4: commit `feat(infra): ambiente pac na AWS com ECS Fargate, CloudFront, RDS e S3`.

### Task 12: GitHub Actions — validação, plan e deploy

**Files:**
- Modify: `.github/workflows/ci.yml` (job `infra`: `hashicorp/setup-terraform@v3` com `terraform_version: 1.11.x` ou superior estável, `fmt -check -recursive infra`, `init -backend=false` + `validate` em `infra/bootstrap` e `infra/terraform`; sem credencial AWS)
- Create: `.github/workflows/infra-plan.yml`, `.github/workflows/deploy-aws.yml`, `scripts/deploy/verificar-rollout.sh` (+ teste em bash simples ou via `node --test` se o builder preferir script `.mjs`)

**Interfaces:**
- Variáveis de repositório: `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `TF_STATE_BUCKET`, `WEB_ORIGINS_JSON` (ex. `["https://crm-advocacia-pac.vercel.app"]`), `UAZAPI_SERVER_URL`. Secrets: `TF_VAR_UAZAPI_ADMIN_TOKEN`, `TF_VAR_NEW_RELIC_LICENSE_KEY`, `TF_VAR_BUDGET_EMAIL`.
- `infra-plan.yml`: `pull_request` para `main`/`dev` com `paths: [infra/**, apps/api/**, .github/workflows/infra-plan.yml]`; `permissions: id-token: write, contents: read, pull-requests: write`; sem `AWS_DEPLOY_ROLE_ARN` → passo único que escreve no summary "pulado" e sai verde; com ela: `aws-actions/configure-aws-credentials@v4` (OIDC) → `terraform init -backend-config=bucket=... -backend-config=region=...` → `terraform plan -var image_tag=<tag em execução, lida do ECS via aws cli; fallback "inicial">` → resumo no `$GITHUB_STEP_SUMMARY`.
- `deploy-aws.yml`: `push` em `main` + `workflow_dispatch`; `concurrency: deploy-aws` sem cancelamento; mesmo pulo sem role. Passos: checkout → OIDC → `terraform init` → se o repositório ECR não existir, `terraform apply -auto-approve -target=aws_ecr_repository.api` → login ECR → `docker/setup-buildx-action` + `docker/build-push-action` com `platforms: linux/arm64`, tag `${{ github.sha }}`, cache GHA → `terraform apply -auto-approve -target=aws_ecs_task_definition.api -var image_tag=$SHA` → `aws ecs run-task` (launch type FARGATE, subnets/SG dos outputs, `assignPublicIp=ENABLED`, override `command` = `["npm","run","migrar","-w","@crm/api"]`) → `aws ecs wait tasks-stopped` → exige `exitCode == 0` do container (senão imprime o link do log e falha) → `terraform apply -auto-approve -var image_tag=$SHA` → `aws ecs wait services-stable` → `scripts/deploy/verificar-rollout.sh <cluster> <service> <taskdef-arn esperado>` (falha se o deployment `PRIMARY` não usa a revisão esperada ou `rolloutState != COMPLETED`) → `curl -fsS --retry 5 $API_URL/api/saude`. Todas as `TF_VAR_*` vêm de secrets/variáveis; `web_origins` de `WEB_ORIGINS_JSON`.
- Arquivos de workflow validados com `npx --yes @action-validator/cli` **ou** `actionlint` se disponível; se nenhum estiver disponível offline, validar YAML com `node -e` + `yaml` já instalado no repo e registrar no relatório.

- [ ] Step 1: escrever workflows e o script.
- [ ] Step 2: testar `verificar-rollout.sh` com JSON de exemplo de `describe-services` (caso ok, caso rollback, caso IN_PROGRESS) via stub de `aws` no `PATH` — script de teste em `scripts/deploy/verificar-rollout.test.sh` rodado manualmente; documentar o comando.
- [ ] Step 3: validação de sintaxe dos workflows (ver Interfaces).
- [ ] Step 4: commit `ci: deploy da API na AWS por OIDC com migrations antes do rollout`.

### Task 13: Vercel só com a SPA no Project `pac` + documentação

**Files:**
- Modify/Create: `vercel.json` → `vercel.ts` (só se a doc atual do `@vercel/config` suportar `services` e rewrite externo; checar `https://vercel.com/docs/project-configuration/vercel-ts`) **ou** manter `vercel.json` (Supabase) e criar `apps/web/vercel.json` para o Project `pac` com Root Directory `apps/web` (rewrites: `/api/(.*)` → `https://API_ORIGIN_AQUI/api/$1` com instrução de troca, e SPA fallback). O builder escolhe a primeira se viável e testável localmente (`npx vercel build` **não** — exige link; validar só tipos/lint), senão a segunda. Registrar a escolha no relatório.
- Modify: `docs/deploy/deploy.md` (topologia nova do deploy acadêmico: Vercel SPA + AWS; o deploy Supabase segue com Services e `TEMPO_REAL_HABILITADO=false`; webhook por instância e instâncias próprias por deploy; migrations expand/contract)
- Create: `docs/deploy/aws-terraform.md` (passo a passo do usuário: pré-requisitos, bootstrap, `backend.hcl`, variáveis/secrets do GitHub, primeiro deploy, Vercel `pac` com `API_ORIGIN`/`VITE_WS_URL`, reconfigurar webhooks das instâncias, migração opcional de dados antigos com `pg_dump`/`aws s3 sync`, custos estimados por recurso, `terraform destroy` — o bucket de estado e o bootstrap ficam para o fim)
- Create: `docs/arquitetura/tempo-real.md` (fluxo webhook → sincronização → barramento → WS, ticket, limites: 1 task/memória, como trocar por LISTEN/NOTIFY)
- Modify: `docs/database/migrations-prisma.md` (regra expand/contract), `docs/README.md` (índice), `CLAUDE.md` (stack: Hosting = Vercel só SPA + AWS ECS/RDS/S3/CloudFront via Terraform; CI/CD inclui deploy por OIDC; tabela de comandos com `terraform` e `docker build`; arquitetura menciona `/api/ws`; variáveis novas), `apps/api/.env.example`, `apps/web/.env.example` (se existir; senão criar com `VITE_WS_URL=`)

- [ ] Step 1: escrever.
- [ ] Step 2: `npm run lint` (se `vercel.ts` entrar no lint) e checar links relativos dos docs com `grep -o '](\.\./[^)]*)\|](\./[^)]*)'` apontando para arquivos existentes.
- [ ] Step 3: commit `docs(deploy): deploy acadêmico na AWS com Terraform e tempo real das campanhas`.

### Task 14: Verificação final

- [ ] `npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run e2e` → tudo verde, pisos de cobertura ok.
- [ ] `terraform fmt -check -recursive infra` e `validate` nos dois diretórios.
- [ ] `git status` limpo; nenhum `.env`, `tfstate`, `.terraform/` versionado (`git ls-files | grep -E 'tfstate|\.terraform/|\.env$'` vazio).
