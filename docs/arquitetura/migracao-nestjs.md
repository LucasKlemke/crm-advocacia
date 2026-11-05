# Migração para React + NestJS

**Status:** em andamento (branch `feature/migracao-nestjs`) — Fases 1 e 2 concluídas.

## Contexto
O backend roda hoje em Route Handlers do Next.js. A migração separa a API (NestJS) do
front (React + Vite), mantendo o domínio (services/repositories) intacto.

## Estratégia: strangler
- `apps/api` (NestJS 12) roda ao lado do Next e reaproveita `src/services`,
  `src/repositories` e `src/lib` via alias `@/`.
- O Next encaminha para a API cada grupo de rota listado em `ROTAS_NA_API_NEST`
  (`next.config.ts`) quando `API_NEST_URL` está definida. Mesmo contrato HTTP.
- Até a Fase 3 a sessão continua sendo a do NextAuth: o `TenantGuard` lê o mesmo cookie
  e resolve o tenant com `resolverTenantContext` (role sempre do banco — RN19).

## Fases
1. Fundação da API + módulo-piloto `status`/`tipos-status` ✅
2. Demais módulos da API ✅ — toda rota de tenant, o perfil e o webhook da UAZAPI são
   servidos pelo Nest; no Next restam só `auth/[...nextauth]`, `cadastro`,
   `sessao/escritorio-ativo` e `escritorios` (raiz), que dependem da sessão NextAuth e
   saem na Fase 3
3. Autenticação nativa no Nest; remoção do NextAuth
4. Front React + Vite; remoção do Next
5. Consolidação: domínio dentro de `apps/api`, build/deploy, CI, documentação

## Como rodar (durante a migração)
1. `npm install`
2. `.env.local` com `API_NEST_URL=http://localhost:3001`
3. `npm run api:dev` (API em :3001) e `npm run dev` (Next em :3000)
4. Testes: `npm test` (Next) e `npm run api:test` (API)

## Convenções da API
- Services do domínio entram no container por token (`useValue` + `@Inject(TOKEN)`).
- Toda rota de tenant: `@UseGuards(TenantGuard)` + `@Tenant() ctx`.
- Erros: `@UseFilters(new ErrosHttpFilter([tratarErroDeStatus]))` (tradutores do próprio
  módulo; o filtro global de `criar-app.ts` cobre os demais); validação com
  `ValidacaoZodPipe(schemaExistente)`.
- Erro inesperado responde 500 `{ error: "Não foi possível concluir a operação." }`.
- `POST` que não cria recurso (ações como sincronizar/desconectar/controlar) leva
  `@HttpCode(200)`, como as rotas Next; só criação responde 201.
- Corpo JSON aceito até 10 MB (`LIMITE_CORPO_JSON` em `criar-app.ts`, por causa do CSV
  das campanhas); acima disso, 413 `{ error: "O conteúdo enviado é maior que o permitido." }`.
- Rotas públicas (hoje só `POST /api/webhooks/uazapi`) não usam `TenantGuard`. O webhook
  lê o corpo como texto (parser próprio montado antes do JSON em `configurarApp`) para
  responder 200 mesmo com corpo vazio ou malformado.
