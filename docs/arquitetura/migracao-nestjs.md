# Migração para React + NestJS

**Status:** concluída (Fases 1–5, branch `feature/migracao-nestjs`, PR para `dev`).

## Contexto
O sistema nasceu como um app Next.js único (App Router + Route Handlers + NextAuth). A migração separou a API (NestJS) do front (React + Vite) sem reescrever regra de negócio: services e repositories foram reaproveitados como estavam e só mudaram de lugar na última fase.

## Estratégia: strangler
- A Fase 1 subiu `apps/api` ao lado do Next. Cada grupo de rota migrado passava a ser respondido pelo Nest via `rewrites` do Next (`ROTAS_NA_API_NEST`), com o mesmo contrato HTTP.
- O domínio ficou em `src/` na raiz até a Fase 5, importado pela API via alias. Nada foi copiado.
- A sessão do NextAuth foi lida pelo `TenantGuard` até a Fase 3, quando a API passou a emitir o próprio cookie (`crm_sessao`).
- Na Fase 4 o front virou uma SPA Vite e o Next saiu do projeto.

## Fases
1. Fundação da API + módulo-piloto `status`/`tipos-status` ✅
2. Demais módulos da API ✅ — toda rota de tenant, o perfil e o webhook da UAZAPI passaram a ser servidos pelo Nest
3. Autenticação nativa no Nest; remoção do NextAuth ✅
4. Front React + Vite; remoção do Next ✅
5. Consolidação: domínio em `apps/api/src/dominio`, `@crm/compartilhado`, Prisma em `apps/api`, build com tsup, Vercel Services, CI/SonarCloud, documentação ✅

## Estado final
- `apps/api`: NestJS 12 (ESM). Dev com `tsx watch`; produção com o bundle do tsup (`dist/main.mjs` + `dist/instrumentacao.mjs`), iniciado por `npm run start -w @crm/api` (`node --import ./dist/instrumentacao.mjs dist/main.mjs`).
- `apps/web`: React 19 + Vite + React Router v7. Em dev, proxy `/api` → :3001 (`API_NEST_URL` sobrescreve o alvo).
- `packages/compartilhado`: DTOs, schemas Zod, enums sem Prisma (paridade garantida por teste na API) e utilitários puros.
- Deploy: um Vercel Project por ambiente (acadêmico e real), cada um com os services `web` e `api` na mesma origem ([../deploy/deploy.md](../deploy/deploy.md)).

## Autenticação (Fase 3)

- **Cookie** `crm_sessao`: JWT HS256 (`jose`) assinado com `AUTH_SECRET` (o código ainda aceita `NEXTAUTH_SECRET` como fallback de leitura), `httpOnly`, `SameSite=Lax`, `Path=/`, `Secure` quando `NODE_ENV=production`, 30 dias de duração fixa (sem renovação deslizante). Payload: `{ sub, escritorioId }` — **sem `role`**: papel e membership sempre do banco (`resolverTenantContext`, RN19).
- **Módulo único**: `apps/api/src/dominio/lib/auth/sessao-jwt.ts` (assinar, verificar, opções do cookie). Leitor: `apps/api/src/comum/tenant/ler-sessao.ts` (usado por `TenantGuard` e `UsuarioGuard`). Quem grava/limpa o cookie: só o `SessaoModule` (`apps/api/src/sessao/`), via `gravarCookieSessao`/`limparCookieSessao` (`apps/api/src/comum/sessao/cookie-sessao.ts`).
- **Endpoints**: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/sessao`, `POST /api/sessao/escritorio-ativo`, `POST /api/cadastro`, `POST /api/escritorios`. No browser, `apps/web/src/lib/sessao.ts` (`entrar`, `sair`, `useSessao`); o cookie é httpOnly, então o front só conhece a sessão por `GET /api/auth/sessao`.
- **Sessões antigas invalidadas**: o cookie `authjs.session-token` do NextAuth nunca é lido. Todo usuário precisou entrar de novo após o deploy da Fase 3 — decisão consciente, para não manter `next-auth/jwt` só para migrar cookies.
- **Token com `exp` e `iat` obrigatórios**: `jwtVerify` exige as duas claims e fixa `algorithms: ["HS256"]`, o que impede downgrade para `none` ou outro algoritmo (`sessao-jwt.ts`).
- **Sem corpo urlencoded (anti-CSRF)**: a API registra só o parser JSON (e o de texto do webhook), via `OPCOES_APP = { bodyParser: false }` em `apps/api/src/criar-app.ts`. Um `<form>` cross-site consegue enviar urlencoded (além de multipart/text); sem parser para ele, o login não vira CSRF (a vítima ficaria logada na conta do atacante).

## Convenções da API (permanecem)
- Services do domínio entram no container por token (`useValue` + `@Inject(TOKEN)`), com os tokens no `tokens.ts` do próprio módulo. Nunca dependa de `emitDecoratorMetadata`: o build de produção (esbuild) não o emite.
- Toda rota de tenant: `@UseGuards(TenantGuard)` + `@Tenant() ctx`. `role` sempre do banco. Rotas que só exigem usuário autenticado (sem tenant): `@UseGuards(UsuarioGuard)` + `@UsuarioId()`.
- Erros: `@UseFilters(new ErrosHttpFilter([tradutoresDoModulo]))` (tradutores do próprio módulo; o filtro global de `criar-app.ts` cobre os demais); validação com `ValidacaoZodPipe(schema)` usando schemas de `@crm/compartilhado/schemas` (ou os específicos da API em `dominio/lib/api`).
- Erro inesperado responde 500 `{ error: "Não foi possível concluir a operação." }`.
- `POST` que não cria recurso (ações como sincronizar/desconectar/controlar) leva `@HttpCode(200)`; só criação responde 201.
- Corpo JSON aceito até 10 MB (`LIMITE_CORPO_JSON` em `criar-app.ts`, por causa do CSV das campanhas); acima disso, 413 `{ error: "O conteúdo enviado é maior que o permitido." }`.
- Rotas públicas (`POST /api/webhooks/uazapi`, `/api/auth/*`, `POST /api/cadastro`, `GET /api/saude`) não usam `TenantGuard`. O webhook lê o corpo como texto (parser próprio montado antes do JSON em `configurarApp`) para responder 200 mesmo com corpo vazio ou malformado.

## Decisões da consolidação (Fase 5)
- **Alias `@dominio/*`** na API (em vez de `@/`): deixa explícito o acesso da camada Nest ao domínio. Resolvido só em tempo de build/teste (tsc, Jest, tsup).
- **`@crm/compartilhado`** como pacote só de código-fonte TS (sem build): o Vite transpila, o tsup embute (`noExternal`) e o Jest mapeia por `moduleNameMapper`. Não depende de `@prisma/client`: os enums do Prisma usados na fronteira HTTP são espelhados em `enums.ts`, com teste na API que compara os dois.
- **tsup em vez de `nest build`**: resolve aliases, embute o pacote compartilhado e gera ESM válido. `nest build`/tsc emitiria imports sem extensão, inválidos em ESM.
- **Prisma e env da API em `apps/api`**: `apps/api/prisma/`, `apps/api/.env*` (carregados por `src/config/carregar-env.ts`).
- **Vercel Services em vez de Projects separados para web e api**: mesma origem, rollback atômico e previews coerentes. Por ser Beta, o deploy começa com um spike de go/no-go; o plano B (dois Projects por ambiente) está em [../deploy/deploy.md](../deploy/deploy.md).
- **Migrations só no build de produção**: previews nunca migram o banco.
- **E2E contra o build de produção**: Playwright sobe a API por `npm run start -w @crm/api` (:3001, `NODE_ENV=test`) e o web por `vite preview` (:4173), sem reaproveitar servidor; prova que o bundle do tsup funciona sem `tsx` e sem decorator metadata.
- **Cobertura**: `npm run test:coverage` agrega os três pacotes e `scripts/verificar-piso-cobertura.mjs` confere o piso institucional (75% backend, 25% frontend); a raiz não tem mais `jest.config` nem `tsconfig`.

## Como rodar
1. `npm install`
2. `cp apps/api/.env.example apps/api/.env` e ajustar (ver [../database/docker-setup.md](../database/docker-setup.md))
3. `npm run dev` (Postgres via Docker, API em :3001 e web em :5173)
4. Testes: `npm test` (todos os pacotes) ou `npm run api:test` / `npm run web:test`; `npm run e2e` para o Playwright contra o build de produção
