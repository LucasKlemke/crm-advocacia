# Migração para React + NestJS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o CRM de Next.js full-stack para **React (Vite) + NestJS** sem parar o sistema: API NestJS ao lado do Next (strangler), autenticação própria no Nest, front SPA em React + Vite, e consolidação final (domínio dentro da API, build, deploy, CI, docs).

**Architecture:** Strangler em 5 fases. Fases 1–2 sobem `apps/api` (NestJS 12) reaproveitando `src/services`/`src/repositories`/`src/lib` via alias, e o Next encaminha cada grupo `/api/*` migrado por `rewrites` (`ROTAS_NA_API_NEST`). Fase 3 troca o NextAuth por cookie `crm_sessao` emitido pelo Nest (jose, HS256). Fase 4 cria `apps/web` (Vite + React Router 7) com camada `compat` para os imports do Next e remove o Next. Fase 5 move o domínio para `apps/api`, cria `packages/compartilhado`, build com tsup, deploy na Vercel, CI e SonarCloud.

**Tech Stack:** NestJS 12.3.2 (ESM, Express 5), tsx (dev), tsup (build), Jest 29 + `@swc/jest` + supertest, Zod 4, Prisma 6, jose, React 19 + Vite + React Router 7.18 + TanStack Query, Tailwind v4 + shadcn/ui, Playwright.

**Spec:** sem spec separado — decisões combinadas com o usuário em 2026-11-01 e registradas em **Decisões de arquitetura** abaixo. Toolchain da API validado em spike (Nest 12 + Jest/`@swc/jest` + supertest; Nest 12 via `tsx`); infraestrutura do web (codemod, compat, sessão, rotas) validada em spike na redação da Fase 4A.

## Roteiro

| Fase | Tasks | Entrega | Pode pausar aqui? |
|---|---|---|---|
| 1 | 1.1–1.7 | `apps/api` com auth/tenant/erros/validação; `status` e `tipos-status` no Nest | Sim |
| 2 | 2.1–2.5, 2.20–2.27, 2.40–2.43, 2.Z | Todas as rotas de tenant e perfil no Nest | Sim |
| 3 | 3.1–3.10 | Login/logout/sessão/cadastro/troca e criação de escritório no Nest; NextAuth removido | Sim (3.5–3.7 em sequência, sem deploy no meio) |
| 4 | 4.1–4.10, 4.20–4.35 | `apps/web` (React + Vite) com todas as páginas; Next removido | Sim |
| 5 | 5.1–5.11 | Domínio em `apps/api`, `packages/compartilhado`, build, deploy, CI, SonarCloud, docs, PR | — |

A numeração tem lacunas de propósito (2.6–2.19, 2.28–2.39, 4.11–4.19): as partes foram redigidas em paralelo. Executar **em ordem crescente**.

**Antes de qualquer merge em `dev`/`main`:** a partir da Fase 1, rotas `/api` dependem da API Nest em todo ambiente (`API_NEST_URL`). Ou a branch só é integrada ao fim da Fase 5, ou a Task 5.9 (deploy) é antecipada.

## Notas de consolidação (prevalecem sobre o texto das tasks)

As fases foram escritas em paralelo e reconciliadas depois. Pontos que um executor precisa saber:

1. **Helpers compartilhados da API:** `searchParamsDaRequisicao` e `paginaDaQuery` vivem em `apps/api/src/comum/query.ts` (Task 2.1). As Tasks 2.25–2.27 importam de lá.
2. **Guard de sessão sem tenant:** `UsuarioGuard` + `@UsuarioId()` em `apps/api/src/comum/tenant/` (Task 2.20). A Fase 3 troca só a implementação de `resolverUsuarioDaRequisicao`; as Tasks 4.20–4.22 usam esses nomes.
3. **Tokens de DI são locais ao módulo:** `USUARIO_SERVICE`, `MEMBRO_SERVICE`, `ESCRITORIO_SERVICE` e `DOCUMENTO_SERVICE` aparecem em mais de um `tokens.ts` (comentários, perfil, sessão, documentos, `comum/tokens-documentos.ts`). São symbols distintos, cada um provido e injetado dentro do próprio módulo — não é conflito. Ao criar um módulo, importe sempre do `tokens.ts` do próprio módulo.
4. **Registro em arquivos comuns:** cada task mostra `app.module.ts`, `ROTAS_NA_API_NEST` e `configurarApp` assumindo as tasks anteriores feitas. Ao aplicar, **acrescente** ao que já existe — nunca apague módulos, prefixos ou parsers registrados antes. `configurarApp` tem uma única chamada `useBodyParser("json", …)` (Task 2.41), precedida do parser de texto do webhook (Task 2.43).
5. **`ROTAS_NA_API_NEST` e `escritorios`:** até a Task 3.5 o item é `"escritorios/atual"` (nunca `"escritorios"`, que engoliria o POST raiz ainda no Next). A Task 3.5 troca por `"escritorios"`.
6. **Contrato de `entrar()`:** `Promise<boolean>` (`false` = credencial inválida, lança `Error` em outra falha) — definido na Fase 3 e mantido na 4.5; as páginas da 4.24 já usam assim.
7. **Tema:** `next-themes` permanece no web (`Provedores`, Task 4.8, tema light fixo). A Task 4.35 não remove essa dependência.
8. **Ponte do Next (Task 4.3):** `src/compat-next/` e os `paths`/`moduleNameMapper` da raiz só existem enquanto o Next roda. A Task 4.35 apaga `src/compat-next` e reescreve `tsconfig.json`/`jest.config.ts`; a Task 5.2 aborta se encontrar resíduo do Next.
9. **Mensagem de erro 500:** genérica em toda a API (`"Não foi possível concluir a operação."`). Testes portados das rotas Next já estão ajustados; 502 (S3/zip) e 413 (corpo grande) mantêm mensagens próprias.
10. **Sessões antigas:** a Fase 3 invalida as sessões do NextAuth — todos os usuários precisam logar de novo após o deploy.
11. **Decisões pendentes do usuário (Fase 5):** Vercel Services (Beta) vs. Projects separados (plano B na Task 5.9); banco de preview; SonarCloud (`SONAR_TOKEN`, org/projectKey); `AUTH_SECRET` e `NEW_RELIC_*` por Project; proteção de branch.

## Decisões de arquitetura (todas as fases)

- **Monorepo npm workspaces**: a raiz continua sendo o app Next (sem mover nada nesta fase) e declara `"workspaces": ["apps/*"]`.
- **Mesmo contrato HTTP**: prefixo global `api`, mesmos paths, mesmos corpos (`{ status }`, `{ tipos }`, `{ ok: true }`, `{ error, detalhes? }`) e mesmos códigos. O `apiFetch` do front não muda.
- **Serviços como `useValue` + `@Inject(TOKEN)` explícito**: os services/repositories atuais são objetos singleton, não classes. Registrá-los por token deixa o Nest independente de `emitDecoratorMetadata` (o `tsx`/esbuild não emite metadata) e torna trivial substituí-los nos testes com `overrideProvider`.
- **Erros**: um único `ErrosHttpFilter`, instanciado por controller com os tradutores do módulo (`tratarErroDeStatus` etc., reaproveitados como estão). Tradutores **não** são globais: classes homônimas em services diferentes (ex.: 4× `ClienteNaoEncontradoError`) podem mapear para códigos diferentes.
- **Mensagem de erro 500**: genérica (`"Não foi possível concluir a operação."`, a mesma do fallback do `apiFetch`) em vez da mensagem por rota. Mudança consciente de contrato, só para erros inesperados.
- **Sem CORS**: em dev e prod o browser fala só com a origem do Next; o Next faz proxy (`rewrites`) para a API. Cookies de sessão seguem funcionando sem configuração cross-site.

## Global Constraints

- Node `v26` (local); NestJS fixado em `12.3.2` (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/testing`).
- `apps/api` é ESM (`"type": "module"`); config do Jest da API precisa ser `jest.config.cjs`.
- Código de `apps/api/src` usa **imports relativos** entre si; `@/` é reservado ao domínio em `src/` da raiz.
- Todo controller com rota de tenant usa `@UseGuards(TenantGuard)`. Nenhum service é chamado sem um `TenantContext` vindo do guard (RN19).
- `role` sempre do banco, nunca do JWT.
- API escuta em `API_PORT` (padrão `3001`); Next encaminha só quando `API_NEST_URL` está definida.
- Conventional Commits; teste no mesmo commit da mudança; nunca commitar em `main` (branch atual: `feature/migracao-nestjs`).
- Next 16: antes de mexer em `next.config.ts`, ler `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/rewrites.md`.

## Estrutura de arquivos

```
package.json                          (modificar: workspaces + scripts api:*)
tsconfig.json                         (modificar: exclude apps)
jest.config.ts                        (modificar: ignora apps/)
eslint.config.mjs                     (modificar: ignora apps/**)
next.config.ts                        (modificar: rewrites para a API Nest)
src/lib/auth/resolver-tenant.ts       (criar: TenantContext, erros e resolverTenantContext, sem NextAuth)
src/lib/auth/resolver-tenant.test.ts  (criar)
src/lib/auth/tenant-context.ts        (modificar: usa resolver-tenant, reexporta)
src/lib/api/erros.ts                  (modificar: importa erros de resolver-tenant)
apps/api/package.json                 (criar)
apps/api/tsconfig.json                (criar)
apps/api/jest.config.cjs              (criar)
apps/api/src/main.ts                  (criar: bootstrap)
apps/api/src/app.module.ts            (criar)
apps/api/src/criar-app.ts             (criar: configuração compartilhada main/testes)
apps/api/src/saude/saude.controller.ts(+ .test.ts)
apps/api/src/comum/erros-http.filter.ts      (+ .test.ts)
apps/api/src/comum/validacao.pipe.ts         (+ .test.ts)
apps/api/src/comum/tenant/tenant.guard.ts    (+ .test.ts)
apps/api/src/comum/tenant/tenant.decorator.ts
apps/api/src/comum/tenant/tenant.module.ts
apps/api/src/comum/tenant/ler-sessao.ts      (+ .test.ts)
apps/api/src/status/status.module.ts
apps/api/src/status/status.controller.ts     (+ .test.ts)
apps/api/src/status/tipos-status.controller.ts (+ .test.ts)
apps/api/src/status/tokens.ts
apps/api/test/utils.ts                (criar: helper de app de teste)
docs/arquitetura/migracao-nestjs.md   (criar: ADR + roteiro)
```

---

---

## Fase 1 — Fundação da API NestJS

Sobe `apps/api` ao lado do Next, com autenticação/tenant equivalentes aos de hoje (lendo a sessão do NextAuth), filtro de erros e validação Zod no mesmo contrato HTTP, e serve `status`/`tipos-status` pelo Nest via rewrite.

### Task 1.1: Workspace e esqueleto da API com health check

**Files:**
- Modify: `package.json`, `tsconfig.json`, `jest.config.ts`, `eslint.config.mjs`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/jest.config.cjs`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/criar-app.ts`, `apps/api/src/saude/saude.controller.ts`
- Test: `apps/api/src/saude/saude.controller.test.ts`

**Interfaces:**
- Produces: `configurarApp(app: INestApplication): INestApplication` (prefixo `api` + shutdown hooks), `AppModule`, rota `GET /api/saude → 200 { ok: true }`.

- [ ] **Step 1: Declarar workspaces e isolar `apps/` do Next**

Em `package.json` (raiz), adicionar ao objeto raiz:

```json
"workspaces": ["apps/*"],
```

e em `"scripts"`:

```json
"api:dev": "npm run dev -w @crm/api",
"api:test": "npm test -w @crm/api",
"api:typecheck": "npm run typecheck -w @crm/api",
```

Em `tsconfig.json` (raiz): `"exclude": ["node_modules", "apps"]`.

Em `jest.config.ts` (raiz): `testPathIgnorePatterns: ["<rootDir>/e2e/", "<rootDir>/node_modules/", "<rootDir>/.next/", "<rootDir>/apps/"],`.

Em `eslint.config.mjs`, dentro de `globalIgnores([...])`, adicionar `"apps/**",` (a API ganha lint próprio na Fase 5).

- [ ] **Step 2: Criar o pacote da API**

`apps/api/package.json`:

```json
{
  "name": "@crm/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "test": "jest",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "12.3.2",
    "@nestjs/core": "12.3.2",
    "@nestjs/platform-express": "12.3.2",
    "dotenv": "^17.4.2",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@nestjs/testing": "12.3.2",
    "@swc/core": "^1.13.0",
    "@swc/jest": "^0.2.39",
    "@types/express": "^5.0.3",
    "@types/supertest": "^6.0.3",
    "supertest": "^7.3.1",
    "tsx": "^4.20.0"
  }
}
```

`apps/api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "noEmit": true,
    "types": ["node", "jest"],
    "paths": { "@/*": ["../../src/*"] }
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

`apps/api/jest.config.cjs`:

```js
// CJS de propósito: o pacote é "type": "module", e o Jest 29 roda em CommonJS.
// O @swc/jest transpila o próprio código, o domínio em ../../src e os pacotes ESM
// (Nest 12, next-auth) para CJS.
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.(t|j|mj)s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!(@nestjs|next-auth|@auth|@panva|jose|oauth4webapi)/)"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/../../src/$1" },
  moduleFileExtensions: ["ts", "js", "mjs", "json"],
};
```

Run: `npm install` (na raiz)
Expected: instala sem erro; `ls node_modules/@nestjs` mostra `common core platform-express testing`.

- [ ] **Step 3: Escrever o teste que falha**

`apps/api/src/saude/saude.controller.test.ts`:

```ts
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../app.module";
import { configurarApp } from "../criar-app";

describe("GET /api/saude", () => {
  it("responde 200 { ok: true } sem exigir sessão", async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = configurarApp(modulo.createNestApplication());
    await app.init();

    await request(app.getHttpServer()).get("/api/saude").expect(200, { ok: true });

    await app.close();
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm run api:test`
Expected: FAIL — `Cannot find module '../app.module'`.

- [ ] **Step 5: Implementar**

`apps/api/src/saude/saude.controller.ts`:

```ts
import { Controller, Get } from "@nestjs/common";

// Usado pelo rewrite do Next e pelo deploy para saber se a API está de pé.
@Controller("saude")
export class SaudeController {
  @Get()
  verificar() {
    return { ok: true };
  }
}
```

`apps/api/src/criar-app.ts`:

```ts
import type { INestApplication } from "@nestjs/common";

// Configuração única usada pelo main.ts e pelos testes — o teste exercita exatamente
// o mesmo prefixo/filtros que a API real.
export function configurarApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  return app;
}
```

`apps/api/src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { SaudeController } from "./saude/saude.controller";

@Module({
  controllers: [SaudeController],
})
export class AppModule {}
```

`apps/api/src/main.ts`:

```ts
import "reflect-metadata";
import { resolve } from "node:path";
import { config } from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configurarApp } from "./criar-app";

// Mesmo .env do Next: DATABASE_URL e AUTH_SECRET/NEXTAUTH_SECRET precisam ser
// idênticos, senão o guard não consegue abrir o cookie de sessão.
const raiz = resolve(import.meta.dirname, "../../..");
config({ path: [resolve(raiz, ".env.local"), resolve(raiz, ".env")], quiet: true });

const app = configurarApp(await NestFactory.create(AppModule));
const porta = Number(process.env.API_PORT ?? 3001);
await app.listen(porta);
console.log(`[api] ouvindo em http://localhost:${porta}/api`);
```

- [ ] **Step 6: Rodar os testes e o servidor**

Run: `npm run api:test`
Expected: PASS (1 teste).

Run: `npm run api:dev` em um terminal e `curl -s localhost:3001/api/saude` em outro
Expected: `{"ok":true}`. Encerrar o `api:dev`.

Run: `npm run api:typecheck`
Expected: sem erros.

Run: `npx jest` (raiz) e `npm run lint`
Expected: suítes do Next continuam passando; nenhum arquivo de `apps/` coletado.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json jest.config.ts eslint.config.mjs apps/api
git commit -m "chore(api): cria workspace apps/api com NestJS 12 e health check"
```

---

### Task 1.2: Extrair `resolverTenantContext` sem dependência do NextAuth

O Nest não pode importar `src/lib/auth/config.ts` (ele instancia o NextAuth no import). A regra de resolução do tenant vai para um módulo puro, usado pelo Next e pelo Nest.

**Files:**
- Create: `src/lib/auth/resolver-tenant.ts`, `src/lib/auth/resolver-tenant.test.ts`
- Modify: `src/lib/auth/tenant-context.ts`, `src/lib/api/erros.ts:1-7`

**Interfaces:**
- Produces:
  ```ts
  export interface TenantContext { usuarioId: string; escritorioId: string; role: RoleMembro }
  export interface SessaoMinima { usuarioId?: string | null; escritorioId?: string | null }
  export async function resolverTenantContext(sessao: SessaoMinima | null): Promise<TenantContext>
  export class NaoAutenticadoError / SemEscritorioAtivoError / AcessoNegadoError
  ```
  `tenant-context.ts` continua exportando os mesmos nomes (reexport) — nenhum import existente muda.

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/auth/resolver-tenant.test.ts`:

```ts
import {
  resolverTenantContext,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
} from "./resolver-tenant";
import { membroRepository } from "@/repositories/membro.repository";

jest.mock("@/repositories/membro.repository");

const repo = membroRepository as jest.Mocked<typeof membroRepository>;

describe("resolverTenantContext", () => {
  afterEach(() => jest.clearAllMocks());

  it("lança NaoAutenticadoError sem sessão (RN01)", async () => {
    await expect(resolverTenantContext(null)).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança NaoAutenticadoError quando a sessão não tem usuário", async () => {
    await expect(resolverTenantContext({ usuarioId: null })).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança SemEscritorioAtivoError sem escritorioId", async () => {
    await expect(
      resolverTenantContext({ usuarioId: "user-1", escritorioId: null })
    ).rejects.toThrow(SemEscritorioAtivoError);
  });

  it("lança AcessoNegadoError quando o usuário não é membro (RN19)", async () => {
    repo.findByUsuarioEEscritorio.mockResolvedValue(null);

    await expect(
      resolverTenantContext({ usuarioId: "user-1", escritorioId: "esc-1" })
    ).rejects.toThrow(AcessoNegadoError);
    expect(repo.findByUsuarioEEscritorio).toHaveBeenCalledWith("user-1", "esc-1");
  });

  it("devolve o contexto com o role vindo do banco", async () => {
    repo.findByUsuarioEEscritorio.mockResolvedValue({ escritorioId: "esc-1", role: "padrao" } as never);

    await expect(
      resolverTenantContext({ usuarioId: "user-1", escritorioId: "esc-1" })
    ).resolves.toEqual({ usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/auth/resolver-tenant.test.ts`
Expected: FAIL — `Cannot find module './resolver-tenant'`.

- [ ] **Step 3: Implementar `resolver-tenant.ts`**

```ts
import { membroRepository } from "@/repositories/membro.repository";
import type { RoleMembro } from "@prisma/client";

// Regra de resolução do tenant (RN19) sem nenhuma dependência do NextAuth — usada pelo
// getTenantContext() do Next e pelo TenantGuard da API Nest. Recebe só o que veio da
// sessão (id do usuário e escritório ativo) e consulta a membership no banco.
//
// Crítico: o `role` sai sempre do banco, nunca do JWT — o JWT pode estar com um valor
// stale entre atualizações de papel.

export interface TenantContext {
  usuarioId: string;
  escritorioId: string;
  role: RoleMembro;
}

export interface SessaoMinima {
  usuarioId?: string | null;
  escritorioId?: string | null;
}

export class NaoAutenticadoError extends Error {
  constructor() {
    super("Sessão inválida ou expirada.");
    this.name = "NaoAutenticadoError";
  }
}

export class SemEscritorioAtivoError extends Error {
  constructor() {
    super("Nenhum escritório ativo na sessão.");
    this.name = "SemEscritorioAtivoError";
  }
}

export class AcessoNegadoError extends Error {
  constructor() {
    super("Você não tem acesso a este escritório.");
    this.name = "AcessoNegadoError";
  }
}

export async function resolverTenantContext(sessao: SessaoMinima | null): Promise<TenantContext> {
  if (!sessao?.usuarioId) {
    throw new NaoAutenticadoError();
  }
  if (!sessao.escritorioId) {
    throw new SemEscritorioAtivoError();
  }

  const membro = await membroRepository.findByUsuarioEEscritorio(
    sessao.usuarioId,
    sessao.escritorioId
  );
  if (!membro) {
    throw new AcessoNegadoError();
  }

  return { usuarioId: sessao.usuarioId, escritorioId: sessao.escritorioId, role: membro.role };
}
```

- [ ] **Step 4: Fazer `tenant-context.ts` delegar**

Substituir o conteúdo de `src/lib/auth/tenant-context.ts` por:

```ts
import { auth } from "@/lib/auth/config";
import { resolverTenantContext, type TenantContext } from "@/lib/auth/resolver-tenant";

export {
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
  type TenantContext,
} from "@/lib/auth/resolver-tenant";

// Toda rota/Service do Next que acessa dados de tenant passa por aqui (RN19). A regra
// em si mora em resolver-tenant.ts, compartilhada com o TenantGuard da API Nest.
export async function getTenantContext(): Promise<TenantContext> {
  const session = await auth();
  return resolverTenantContext(
    session?.user
      ? { usuarioId: session.user.id, escritorioId: session.user.escritorioId }
      : null
  );
}
```

Em `src/lib/api/erros.ts`, trocar a origem do import das três classes de `"@/lib/auth/tenant-context"` para `"@/lib/auth/resolver-tenant"` (assim o filtro do Nest importa `erros.ts` sem carregar o NextAuth).

- [ ] **Step 5: Rodar os testes**

Run: `npx jest src/lib/auth src/lib/api src/app/api/status`
Expected: PASS — inclusive o `tenant-context.test.ts` existente, sem alterações.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/resolver-tenant.ts src/lib/auth/resolver-tenant.test.ts src/lib/auth/tenant-context.ts src/lib/api/erros.ts
git commit -m "refactor(auth): extrai resolverTenantContext sem dependência do NextAuth"
```

---

### Task 1.3: Filtro de erros e pipe de validação Zod

**Files:**
- Create: `apps/api/src/comum/erros-http.filter.ts`, `apps/api/src/comum/validacao.pipe.ts`
- Test: `apps/api/src/comum/erros-http.filter.test.ts`, `apps/api/src/comum/validacao.pipe.test.ts`
- Modify: `apps/api/src/criar-app.ts`

**Interfaces:**
- Consumes: `tratarErroDeContexto`, `respostaDadosInvalidos` de `@/lib/api/erros`.
- Produces:
  ```ts
  export type TradutorDeErro = (error: unknown) => Response | null;
  export class ErrosHttpFilter { constructor(tradutores?: TradutorDeErro[]) }
  export class DadosInvalidosError extends Error { readonly zodError?: ZodError }
  export class ValidacaoZodPipe<T> implements PipeTransform { constructor(schema: ZodType<T>) }
  ```
  `configurarApp` passa a registrar `new ErrosHttpFilter()` como filtro global.

- [ ] **Step 1: Escrever os testes que falham**

`apps/api/src/comum/validacao.pipe.test.ts`:

```ts
import { z } from "zod";
import { ValidacaoZodPipe, DadosInvalidosError } from "./validacao.pipe";

const schema = z.object({ nome: z.string().min(1, "Informe o nome") });

describe("ValidacaoZodPipe", () => {
  const pipe = new ValidacaoZodPipe(schema);

  it("devolve o dado parseado quando válido", () => {
    expect(pipe.transform({ nome: "Lead", extra: 1 })).toEqual({ nome: "Lead" });
  });

  it("lança DadosInvalidosError com o ZodError quando inválido", () => {
    expect.assertions(2);
    try {
      pipe.transform({ nome: "" });
    } catch (error) {
      expect(error).toBeInstanceOf(DadosInvalidosError);
      expect((error as DadosInvalidosError).zodError?.flatten().fieldErrors).toEqual({
        nome: ["Informe o nome"],
      });
    }
  });

  it("trata corpo ausente como inválido", () => {
    expect(() => pipe.transform(undefined)).toThrow(DadosInvalidosError);
  });
});
```

`apps/api/src/comum/erros-http.filter.test.ts`:

```ts
import { BadRequestException, Controller, Get, NotFoundException, Post, Body, UseFilters } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { z } from "zod";
import { configurarApp } from "../criar-app";
import { ErrosHttpFilter } from "./erros-http.filter";
import { ValidacaoZodPipe } from "./validacao.pipe";
import { NaoAutenticadoError, SemEscritorioAtivoError, AcessoNegadoError } from "@/lib/auth/resolver-tenant";

class ErroDoModulo extends Error {}

let erroALancar: unknown;

@Controller("teste")
@UseFilters(
  new ErrosHttpFilter([
    (e) => (e instanceof ErroDoModulo ? Response.json({ error: "conflito" }, { status: 409 }) : null),
  ])
)
class TesteController {
  @Get()
  lancar() {
    throw erroALancar;
  }

  @Post()
  criar(@Body(new ValidacaoZodPipe(z.object({ nome: z.string().min(1, "Informe o nome") }))) corpo: { nome: string }) {
    return corpo;
  }
}

describe("ErrosHttpFilter", () => {
  let app: Awaited<ReturnType<typeof criar>>;
  async function criar() {
    const modulo = await Test.createTestingModule({ controllers: [TesteController] }).compile();
    const nest = configurarApp(modulo.createNestApplication());
    await nest.init();
    return nest;
  }
  beforeAll(async () => {
    app = await criar();
  });
  afterAll(() => app.close());

  it.each([
    [new NaoAutenticadoError(), 401, "Sessão inválida ou expirada."],
    [new SemEscritorioAtivoError(), 409, "Nenhum escritório ativo na sessão."],
    [new AcessoNegadoError(), 403, "Você não tem acesso a este escritório."],
  ])("mapeia erro de tenant %p para %i", async (erro, status, mensagem) => {
    erroALancar = erro;
    await request(app.getHttpServer()).get("/api/teste").expect(status, { error: mensagem });
  });

  it("usa os tradutores do módulo", async () => {
    erroALancar = new ErroDoModulo();
    await request(app.getHttpServer()).get("/api/teste").expect(409, { error: "conflito" });
  });

  it("responde 500 genérico sem detalhe técnico para erro inesperado", async () => {
    erroALancar = new Error("connection refused em 10.0.0.1");
    jest.spyOn(console, "error").mockImplementation(() => {});
    await request(app.getHttpServer())
      .get("/api/teste")
      .expect(500, { error: "Não foi possível concluir a operação." });
  });

  it("repassa HttpException com { error }", async () => {
    erroALancar = new NotFoundException("Rota não encontrada.");
    await request(app.getHttpServer()).get("/api/teste").expect(404, { error: "Rota não encontrada." });
  });

  it("trata BadRequestException (ex.: JSON malformado) como Dados inválidos", async () => {
    erroALancar = new BadRequestException("Unexpected token");
    await request(app.getHttpServer()).get("/api/teste").expect(400, { error: "Dados inválidos" });
  });

  it("devolve 400 com detalhes por campo quando o Zod reprova", async () => {
    await request(app.getHttpServer())
      .post("/api/teste")
      .send({ nome: "" })
      .expect(400, { error: "Dados inválidos", detalhes: { nome: ["Informe o nome"] } });
  });

  it("devolve 400 para JSON malformado de verdade", async () => {
    await request(app.getHttpServer())
      .post("/api/teste")
      .set("content-type", "application/json")
      .send("{oops")
      .expect(400, { error: "Dados inválidos" });
  });

  it("filtro global cobre rota inexistente", async () => {
    await request(app.getHttpServer()).get("/api/nao-existe").expect(404);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- comum`
Expected: FAIL — módulos `./validacao.pipe` e `./erros-http.filter` não existem.

- [ ] **Step 3: Implementar o pipe**

`apps/api/src/comum/validacao.pipe.ts`:

```ts
import type { PipeTransform } from "@nestjs/common";
import type { ZodError, ZodType } from "zod";

// Erro de forma do payload. O ErrosHttpFilter converte para o mesmo corpo que as rotas
// Next devolvem: { error: "Dados inválidos", detalhes: { campo: [mensagens] } }.
export class DadosInvalidosError extends Error {
  constructor(readonly zodError?: ZodError) {
    super("Dados inválidos");
    this.name = "DadosInvalidosError";
  }
}

// Reaproveita os schemas Zod de src/lib/api/schemas-*.ts — a validação continua sendo
// definida num lugar só, compartilhado com o front.
export class ValidacaoZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(valor: unknown): T {
    const parsed = this.schema.safeParse(valor);
    if (!parsed.success) {
      throw new DadosInvalidosError(parsed.error);
    }
    return parsed.data;
  }
}
```

- [ ] **Step 4: Implementar o filtro**

`apps/api/src/comum/erros-http.filter.ts`:

```ts
import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { Request, Response as ExpressResponse } from "express";
import { tratarErroDeContexto, respostaDadosInvalidos } from "@/lib/api/erros";
import { DadosInvalidosError } from "./validacao.pipe";

// Os mapeadores de erro de domínio em src/lib/api/erros-*.ts devolvem um Response
// (NextResponse estende Response). Reaproveitá-los aqui mantém um mapeamento só
// enquanto Next e Nest convivem; na Fase 5 eles viram tradutores nativos do Nest.
export type TradutorDeErro = (error: unknown) => Response | null;

const MENSAGEM_ERRO_INESPERADO = "Não foi possível concluir a operação.";

@Catch()
export class ErrosHttpFilter implements ExceptionFilter {
  // Tradutores são por controller, nunca globais: services diferentes têm classes de
  // erro homônimas (ex.: ClienteNaoEncontradoError) com códigos HTTP diferentes.
  constructor(private readonly tradutores: TradutorDeErro[] = []) {}

  async catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const res = http.getResponse<ExpressResponse>();
    const req = http.getRequest<Request>();

    const traduzida = this.traduzir(error);
    if (traduzida) {
      res.status(traduzida.status).json(await traduzida.json());
      return;
    }

    if (error instanceof HttpException) {
      res.status(error.getStatus()).json({ error: error.message });
      return;
    }

    // Log estruturado no servidor; para o usuário, mensagem sem detalhe técnico.
    console.error(`[api] erro em ${req.method} ${req.originalUrl}`, error);
    res.status(500).json({ error: MENSAGEM_ERRO_INESPERADO });
  }

  private traduzir(error: unknown): Response | null {
    if (error instanceof DadosInvalidosError) {
      return respostaDadosInvalidos(error.zodError);
    }
    // O body parser do Nest transforma JSON malformado em BadRequestException.
    if (error instanceof HttpException && error.getStatus() === 400) {
      return respostaDadosInvalidos();
    }
    for (const tradutor of [tratarErroDeContexto, ...this.tradutores]) {
      const resposta = tradutor(error);
      if (resposta) return resposta;
    }
    return null;
  }
}
```

Em `apps/api/src/criar-app.ts`, registrar o filtro global:

```ts
import type { INestApplication } from "@nestjs/common";
import { ErrosHttpFilter } from "./comum/erros-http.filter";

// Configuração única usada pelo main.ts e pelos testes — o teste exercita exatamente
// o mesmo prefixo/filtros que a API real.
export function configurarApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ErrosHttpFilter());
  app.enableShutdownHooks();
  return app;
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run api:test`
Expected: PASS (saúde + pipe + filtro).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/comum apps/api/src/criar-app.ts
git commit -m "feat(api): filtro de erros e validação Zod com o mesmo contrato das rotas Next"
```

---

### Task 1.4: TenantGuard lendo a sessão do NextAuth

**Files:**
- Create: `apps/api/src/comum/tenant/ler-sessao.ts`, `apps/api/src/comum/tenant/tenant.guard.ts`, `apps/api/src/comum/tenant/tenant.decorator.ts`, `apps/api/src/comum/tenant/tenant.module.ts`, `apps/api/test/utils.ts`
- Test: `apps/api/src/comum/tenant/ler-sessao.test.ts`, `apps/api/src/comum/tenant/tenant.guard.test.ts`
- Modify: `apps/api/tsconfig.json` (já inclui `test/**`), `apps/api/jest.config.cjs` (sem mudança — `test/utils.ts` não é suíte)

**Interfaces:**
- Consumes: `lerTokenDaSessao(request: { headers: Headers })` de `@/lib/auth/token`; `resolverTenantContext`, `TenantContext` de `@/lib/auth/resolver-tenant`.
- Produces:
  ```ts
  export const RESOLVEDOR_TENANT: unique symbol;               // token de DI
  export type ResolvedorTenant = (req: Request) => Promise<TenantContext>;
  export async function resolverTenantDaRequisicao(req: Request): Promise<TenantContext>;
  export function headersDaRequisicao(req: Request): Headers;
  export class TenantGuard implements CanActivate              // grava req.tenant
  export const Tenant: () => ParameterDecorator                // lê req.tenant
  export class TenantModule                                    // @Global, exporta RESOLVEDOR_TENANT e TenantGuard
  // apps/api/test/utils.ts
  export const CTX_OWNER: TenantContext;
  export async function criarAppDeTeste(opcoes: { imports?: Type[]; controllers?: Type[]; ctx?: TenantContext | Error; overrides?: [symbol, unknown][] }): Promise<INestApplication>;
  ```

- [ ] **Step 1: Escrever os testes que falham**

`apps/api/src/comum/tenant/ler-sessao.test.ts`:

```ts
import type { Request } from "express";
import { headersDaRequisicao, resolverTenantDaRequisicao } from "./ler-sessao";
import { lerTokenDaSessao } from "@/lib/auth/token";
import { resolverTenantContext } from "@/lib/auth/resolver-tenant";

jest.mock("@/lib/auth/token", () => ({ lerTokenDaSessao: jest.fn() }));
jest.mock("@/lib/auth/resolver-tenant", () => ({ resolverTenantContext: jest.fn() }));

const lerToken = lerTokenDaSessao as jest.Mock;
const resolver = resolverTenantContext as jest.Mock;

function req(headers: Record<string, string | string[] | undefined>) {
  return { headers } as unknown as Request;
}

describe("headersDaRequisicao", () => {
  it("converte os headers do Express em Headers, preservando o cookie", () => {
    const h = headersDaRequisicao(req({ cookie: "authjs.session-token=abc", "x-vazio": undefined }));
    expect(h.get("cookie")).toBe("authjs.session-token=abc");
    expect(h.has("x-vazio")).toBe(false);
  });

  it("junta headers com múltiplos valores", () => {
    const h = headersDaRequisicao(req({ accept: ["a", "b"] }));
    expect(h.get("accept")).toBe("a, b");
  });
});

describe("resolverTenantDaRequisicao", () => {
  afterEach(() => jest.clearAllMocks());

  it("passa sub e escritorioId do JWT para o resolver compartilhado", async () => {
    lerToken.mockResolvedValue({ sub: "user-1", escritorioId: "esc-1", role: "owner" });
    resolver.mockResolvedValue({ usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" });

    const ctx = await resolverTenantDaRequisicao(req({ cookie: "x=1" }));

    expect(resolver).toHaveBeenCalledWith({ usuarioId: "user-1", escritorioId: "esc-1" });
    expect(ctx.role).toBe("padrao");
  });

  it("passa null quando não há token", async () => {
    lerToken.mockResolvedValue(null);
    resolver.mockRejectedValue(new Error("sem sessão"));

    await expect(resolverTenantDaRequisicao(req({}))).rejects.toThrow("sem sessão");
    expect(resolver).toHaveBeenCalledWith(null);
  });
});
```

`apps/api/src/comum/tenant/tenant.guard.test.ts`:

```ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../../test/utils";
import { TenantGuard } from "./tenant.guard";
import { Tenant } from "./tenant.decorator";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

@Controller("eco")
@UseGuards(TenantGuard)
class EcoController {
  @Get()
  eco(@Tenant() ctx: TenantContext) {
    return ctx;
  }
}

describe("TenantGuard", () => {
  it("injeta o TenantContext resolvido no handler", async () => {
    const app = await criarAppDeTeste({ controllers: [EcoController] });
    await request(app.getHttpServer()).get("/api/eco").expect(200, CTX_OWNER);
    await app.close();
  });

  it("responde 401 quando o resolver lança NaoAutenticadoError", async () => {
    const app = await criarAppDeTeste({ controllers: [EcoController], ctx: new NaoAutenticadoError() });
    await request(app.getHttpServer())
      .get("/api/eco")
      .expect(401, { error: "Sessão inválida ou expirada." });
    await app.close();
  });
});
```

`apps/api/test/utils.ts`:

```ts
import type { INestApplication, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { configurarApp } from "../src/criar-app";
import { TenantModule } from "../src/comum/tenant/tenant.module";
import { RESOLVEDOR_TENANT } from "../src/comum/tenant/ler-sessao";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

export const CTX_OWNER: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" };

interface OpcoesAppDeTeste {
  imports?: Type<unknown>[];
  controllers?: Type<unknown>[];
  // Contexto que o guard devolve, ou o erro que ele lança (ex.: NaoAutenticadoError).
  ctx?: TenantContext | Error;
  // Substitui providers por token — ex.: [[STATUS_SERVICE, { listar: jest.fn() }]].
  overrides?: [symbol, unknown][];
}

// App Nest de teste com a mesma configuração do main.ts e o resolver de tenant
// substituído — os testes de controller nunca leem cookie nem banco.
export async function criarAppDeTeste(opcoes: OpcoesAppDeTeste): Promise<INestApplication> {
  const ctx = opcoes.ctx ?? CTX_OWNER;
  let builder = Test.createTestingModule({
    imports: [TenantModule, ...(opcoes.imports ?? [])],
    controllers: opcoes.controllers ?? [],
  })
    .overrideProvider(RESOLVEDOR_TENANT)
    .useValue(async () => {
      if (ctx instanceof Error) throw ctx;
      return ctx;
    });

  for (const [token, valor] of opcoes.overrides ?? []) {
    builder = builder.overrideProvider(token).useValue(valor);
  }

  const modulo = await builder.compile();
  const app = configurarApp(modulo.createNestApplication());
  await app.init();
  return app;
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- tenant`
Expected: FAIL — `./ler-sessao`, `./tenant.guard` etc. não existem.

- [ ] **Step 3: Implementar**

`apps/api/src/comum/tenant/ler-sessao.ts`:

```ts
import type { Request } from "express";
import { lerTokenDaSessao } from "@/lib/auth/token";
import { resolverTenantContext, type TenantContext } from "@/lib/auth/resolver-tenant";

export const RESOLVEDOR_TENANT = Symbol("RESOLVEDOR_TENANT");
export type ResolvedorTenant = (req: Request) => Promise<TenantContext>;

// lerTokenDaSessao espera a interface Headers do fetch; o Express entrega um objeto.
export function headersDaRequisicao(req: Request): Headers {
  const headers = new Headers();
  for (const [nome, valor] of Object.entries(req.headers)) {
    if (valor === undefined) continue;
    headers.set(nome, Array.isArray(valor) ? valor.join(", ") : valor);
  }
  return headers;
}

// Fase 1–2: a sessão ainda é a do NextAuth (mesmo cookie, mesmo AUTH_SECRET). O JWT só
// informa quem é o usuário e qual escritório está ativo; papel e membership vêm do banco
// via resolverTenantContext — a mesma regra que o getTenantContext() do Next usa.
export async function resolverTenantDaRequisicao(req: Request): Promise<TenantContext> {
  const token = await lerTokenDaSessao({ headers: headersDaRequisicao(req) });
  return resolverTenantContext(
    token
      ? {
          usuarioId: token.sub ?? null,
          escritorioId: (token.escritorioId as string | null | undefined) ?? null,
        }
      : null
  );
}
```

`apps/api/src/comum/tenant/tenant.guard.ts`:

```ts
import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { RESOLVEDOR_TENANT, type ResolvedorTenant } from "./ler-sessao";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

export type RequestComTenant = Request & { tenant?: TenantContext };

// Equivalente Nest do getTenantContext() (RN19): sem contexto resolvido, o handler não
// roda. Os erros de tenant sobem para o ErrosHttpFilter (401/409/403).
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(RESOLVEDOR_TENANT) private readonly resolver: ResolvedorTenant) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestComTenant>();
    req.tenant = await this.resolver(req);
    return true;
  }
}
```

`apps/api/src/comum/tenant/tenant.decorator.ts`:

```ts
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestComTenant } from "./tenant.guard";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Só é válido em handlers protegidos por TenantGuard — sem ele, falha alto em vez de
// devolver um contexto vazio que deixaria uma query sem escritorioId.
export const Tenant = createParamDecorator((_dado: unknown, context: ExecutionContext): TenantContext => {
  const tenant = context.switchToHttp().getRequest<RequestComTenant>().tenant;
  if (!tenant) {
    throw new Error("@Tenant() usado sem TenantGuard.");
  }
  return tenant;
});
```

`apps/api/src/comum/tenant/tenant.module.ts`:

```ts
import { Global, Module } from "@nestjs/common";
import { RESOLVEDOR_TENANT, resolverTenantDaRequisicao } from "./ler-sessao";
import { TenantGuard } from "./tenant.guard";

@Global()
@Module({
  providers: [{ provide: RESOLVEDOR_TENANT, useValue: resolverTenantDaRequisicao }, TenantGuard],
  exports: [RESOLVEDOR_TENANT, TenantGuard],
})
export class TenantModule {}
```

Em `apps/api/src/app.module.ts`, importar o módulo:

```ts
import { Module } from "@nestjs/common";
import { SaudeController } from "./saude/saude.controller";
import { TenantModule } from "./comum/tenant/tenant.module";

@Module({
  imports: [TenantModule],
  controllers: [SaudeController],
})
export class AppModule {}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run api:test && npm run api:typecheck`
Expected: PASS em todas as suítes; typecheck sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): TenantGuard que resolve o tenant pela sessão NextAuth e pelo banco"
```

---

### Task 1.5: Módulo-piloto `status` e `tipos-status`

Contrato a reproduzir (das rotas `src/app/api/status/**` e `src/app/api/tipos-status/route.ts`):

| Rota | Sucesso | Erros de domínio (`tratarErroDeStatus`) |
|---|---|---|
| `GET /api/status` | 200 `{ status }` | — |
| `POST /api/status` | 201 `{ status }` | 400 tipo inválido, 403 permissão, 409 nome duplicado |
| `PATCH /api/status/:id` | 200 `{ status }` | 404, 403, 400, 409 |
| `DELETE /api/status/:id` | 200 `{ ok: true }` | 404, 403, 409 com casos |
| `GET /api/tipos-status` | 200 `{ tipos }` | — |

**Files:**
- Create: `apps/api/src/status/tokens.ts`, `apps/api/src/status/status.controller.ts`, `apps/api/src/status/tipos-status.controller.ts`, `apps/api/src/status/status.module.ts`
- Test: `apps/api/src/status/status.controller.test.ts`, `apps/api/src/status/tipos-status.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `criarAppDeTeste`, `CTX_OWNER` (Task 1.1.4); `TenantGuard`, `Tenant` (Task 1.1.4); `ValidacaoZodPipe`, `ErrosHttpFilter` (Task 1.1.3); `statusService.{listar(ctx), criar(ctx, dados), atualizar(ctx, id, dados), excluir(ctx, id)}` e as classes de erro de `@/services/status.service`; `tipoStatusService.listar(ctx)`; `novoStatusSchema`, `edicaoStatusSchema` de `@/lib/api/schemas-status`; `tratarErroDeStatus` de `@/lib/api/erros-status`.
- Produces: `STATUS_SERVICE`, `TIPO_STATUS_SERVICE` (symbols), `StatusModule`.

- [ ] **Step 1: Escrever os testes que falham**

`apps/api/src/status/status.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { StatusModule } from "./status.module";
import { STATUS_SERVICE } from "./tokens";
import {
  StatusNaoEncontradoError,
  NomeStatusDuplicadoError,
  StatusComCasosError,
  PermissaoNegadaError,
} from "@/services/status.service";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const TIPO_ID = "123e4567-e89b-12d3-a456-426614174000";
const corpoValido = { nome: "Lead", tipoStatusId: TIPO_ID, icone: "UserPlus", cor: "#64748b" };

const service = {
  listar: jest.fn(),
  criar: jest.fn(),
  atualizar: jest.fn(),
  excluir: jest.fn(),
};

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({ imports: [StatusModule], ctx, overrides: [[STATUS_SERVICE, service]] });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/status", () => {
  it("lista os status do escritório da sessão", async () => {
    service.listar.mockResolvedValue([{ id: "s1", nome: "Lead" }]);

    await request(await subir()).get("/api/status").expect(200, { status: [{ id: "s1", nome: "Lead" }] });
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER);
  });

  it("responde 401 sem sessão e não chama o service (RN19)", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/status").expect(401);
    expect(service.listar).not.toHaveBeenCalled();
  });
});

describe("POST /api/status", () => {
  it("cria e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "s1", ...corpoValido });

    await request(await subir()).post("/api/status").send(corpoValido).expect(201, {
      status: { id: "s1", ...corpoValido },
    });
    expect(service.criar).toHaveBeenCalledWith(CTX_OWNER, corpoValido);
  });

  it("responde 400 com detalhes quando o payload é inválido", async () => {
    const res = await request(await subir()).post("/api/status").send({ ...corpoValido, nome: "" }).expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(res.body.detalhes.nome).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 409 para nome duplicado", async () => {
    service.criar.mockRejectedValue(new NomeStatusDuplicadoError());

    await request(await subir()).post("/api/status").send(corpoValido).expect(409, {
      error: "Já existe um status com este nome neste escritório.",
    });
  });

  it("responde 403 quando o papel não permite", async () => {
    service.criar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).post("/api/status").send(corpoValido).expect(403);
  });
});

describe("PATCH /api/status/:id", () => {
  it("atualiza parcialmente", async () => {
    service.atualizar.mockResolvedValue({ id: "s1", nome: "Novo" });

    await request(await subir()).patch("/api/status/s1").send({ nome: "Novo" }).expect(200, {
      status: { id: "s1", nome: "Novo" },
    });
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "s1", { nome: "Novo" });
  });

  it("responde 404 quando o status não é do escritório", async () => {
    service.atualizar.mockRejectedValue(new StatusNaoEncontradoError());

    await request(await subir()).patch("/api/status/s1").send({ nome: "Novo" }).expect(404, {
      error: "Status não encontrado.",
    });
  });
});

describe("DELETE /api/status/:id", () => {
  it("exclui e responde { ok: true }", async () => {
    service.excluir.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/status/s1").expect(200, { ok: true });
    expect(service.excluir).toHaveBeenCalledWith(CTX_OWNER, "s1");
  });

  it("responde 409 quando há casos vinculados (RN09)", async () => {
    service.excluir.mockRejectedValue(new StatusComCasosError());

    await request(await subir()).delete("/api/status/s1").expect(409, {
      error: "Este status tem processos vinculados e não pode ser excluído.",
    });
  });
});
```

`apps/api/src/status/tipos-status.controller.test.ts`:

```ts
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { StatusModule } from "./status.module";
import { STATUS_SERVICE, TIPO_STATUS_SERVICE } from "./tokens";
import { SemEscritorioAtivoError } from "@/lib/auth/resolver-tenant";

const tipoStatusService = { listar: jest.fn() };

describe("GET /api/tipos-status", () => {
  afterEach(() => jest.clearAllMocks());

  it("lista os tipos de status", async () => {
    tipoStatusService.listar.mockResolvedValue([{ id: "lead", nome: "Lead" }]);
    const app = await criarAppDeTeste({
      imports: [StatusModule],
      overrides: [[TIPO_STATUS_SERVICE, tipoStatusService], [STATUS_SERVICE, {}]],
    });

    await request(app.getHttpServer()).get("/api/tipos-status").expect(200, {
      tipos: [{ id: "lead", nome: "Lead" }],
    });
    expect(tipoStatusService.listar).toHaveBeenCalledWith(CTX_OWNER);
    await app.close();
  });

  it("responde 409 sem escritório ativo", async () => {
    const app = await criarAppDeTeste({
      imports: [StatusModule],
      ctx: new SemEscritorioAtivoError(),
      overrides: [[TIPO_STATUS_SERVICE, tipoStatusService]],
    });

    await request(app.getHttpServer()).get("/api/tipos-status").expect(409);
    await app.close();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- status`
Expected: FAIL — `./status.module` não existe.

- [ ] **Step 3: Implementar**

`apps/api/src/status/tokens.ts`:

```ts
// Tokens de DI: os services do domínio são objetos singleton (não classes), então
// entram no container via useValue e são injetados por token.
export const STATUS_SERVICE = Symbol("STATUS_SERVICE");
export const TIPO_STATUS_SERVICE = Symbol("TIPO_STATUS_SERVICE");
```

`apps/api/src/status/status.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { STATUS_SERVICE } from "./tokens";
import { novoStatusSchema, edicaoStatusSchema } from "@/lib/api/schemas-status";
import { tratarErroDeStatus } from "@/lib/api/erros-status";
import type { statusService } from "@/services/status.service";
import type { DadosNovoStatus, DadosEdicaoStatus } from "@/services/status.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Colunas do kanban configuráveis pelo escritório (RN08/RN09).
@Controller("status")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeStatus]))
export class StatusController {
  constructor(@Inject(STATUS_SERVICE) private readonly service: typeof statusService) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { status: await this.service.listar(ctx) };
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novoStatusSchema)) dados: DadosNovoStatus
  ) {
    return { status: await this.service.criar(ctx, dados) };
  }

  @Patch(":id")
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(edicaoStatusSchema)) dados: DadosEdicaoStatus
  ) {
    return { status: await this.service.atualizar(ctx, id, dados) };
  }

  @Delete(":id")
  @HttpCode(200)
  async excluir(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.excluir(ctx, id);
    return { ok: true };
  }
}
```

`apps/api/src/status/tipos-status.controller.ts`:

```ts
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { TIPO_STATUS_SERVICE } from "./tokens";
import type { tipoStatusService } from "@/services/tipo-status.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Referência global (seed fixo), mas só para quem tem sessão num escritório.
@Controller("tipos-status")
@UseGuards(TenantGuard)
export class TiposStatusController {
  constructor(@Inject(TIPO_STATUS_SERVICE) private readonly service: typeof tipoStatusService) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { tipos: await this.service.listar(ctx) };
  }
}
```

`apps/api/src/status/status.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { StatusController } from "./status.controller";
import { TiposStatusController } from "./tipos-status.controller";
import { STATUS_SERVICE, TIPO_STATUS_SERVICE } from "./tokens";
import { statusService } from "@/services/status.service";
import { tipoStatusService } from "@/services/tipo-status.service";

@Module({
  controllers: [StatusController, TiposStatusController],
  providers: [
    { provide: STATUS_SERVICE, useValue: statusService },
    { provide: TIPO_STATUS_SERVICE, useValue: tipoStatusService },
  ],
})
export class StatusModule {}
```

Em `apps/api/src/app.module.ts`, adicionar `StatusModule` em `imports`:

```ts
import { Module } from "@nestjs/common";
import { SaudeController } from "./saude/saude.controller";
import { TenantModule } from "./comum/tenant/tenant.module";
import { StatusModule } from "./status/status.module";

@Module({
  imports: [TenantModule, StatusModule],
  controllers: [SaudeController],
})
export class AppModule {}
```

Se `DadosNovoStatus`/`DadosEdicaoStatus` não estiverem exportados de `@/services/status.service`, confirmar com `grep -n "export interface DadosNovoStatus\|export type DadosEdicaoStatus" src/services/status.service.ts` — ambos são exportados hoje.

- [ ] **Step 4: Rodar os testes**

Run: `npm run api:test && npm run api:typecheck`
Expected: PASS em todas as suítes; sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/status apps/api/src/app.module.ts
git commit -m "feat(api): módulo status e tipos-status no NestJS com o mesmo contrato HTTP"
```

---

### Task 1.6: Next encaminha as rotas migradas para a API Nest

**Files:**
- Modify: `next.config.ts`, `.env.example`
- Delete: `src/app/api/status/route.ts`, `src/app/api/status/route.test.ts`, `src/app/api/status/[id]/route.ts`, `src/app/api/status/[id]/route.test.ts` (se existir), `src/app/api/tipos-status/route.ts`, `src/app/api/tipos-status/route.test.ts` (se existir)
- Test: Playwright existente (`e2e/`) + verificação manual

**Interfaces:**
- Consumes: API Nest em `API_NEST_URL` (Task 1.1.5).
- Produces: `ROTAS_NA_API_NEST: string[]` em `next.config.ts` — a Fase 2 só acrescenta itens a essa lista.

- [ ] **Step 1: Ler a doc de rewrites do Next 16**

Run: `sed -n 1,140p node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/rewrites.md`
Confirmar que `rewrites()` aceita `{ beforeFiles, afterFiles, fallback }` e que `beforeFiles` tem prioridade sobre rotas do `app/`. Se a API tiver mudado, adaptar o Step 2 à forma documentada.

- [ ] **Step 2: Adicionar os rewrites**

`next.config.ts`:

```ts
import type { NextConfig } from "next";

// Migração strangler para NestJS (docs/arquitetura/migracao-nestjs.md): cada grupo de
// rota listado aqui é respondido pela API em apps/api. O browser continua falando só
// com o Next (mesma origem), então o cookie de sessão segue sem CORS.
const ROTAS_NA_API_NEST = ["status", "tipos-status"];

const nextConfig: NextConfig = {
  // "archiver" (e "zip-stream"/"is-stream", suas deps internas) é publicado como
  // pacote ESM puro (package.json "type": "module"). Sem transpilePackages o Jest
  // (via next/jest) ignora node_modules por padrão e falha ao interpretar o
  // `import` do pacote — precisa ser transpilado como o resto do app.
  transpilePackages: ["archiver", "zip-stream", "compress-commons", "crc32-stream", "is-stream"],

  async rewrites() {
    const api = process.env.API_NEST_URL;
    if (!api) {
      return { beforeFiles: [], afterFiles: [], fallback: [] };
    }
    return {
      beforeFiles: ROTAS_NA_API_NEST.flatMap((rota) => [
        { source: `/api/${rota}`, destination: `${api}/api/${rota}` },
        { source: `/api/${rota}/:caminho*`, destination: `${api}/api/${rota}/:caminho*` },
      ]),
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
```

Em `.env.example`, ao final:

```
# API_NEST_URL: URL da API NestJS (apps/api). Com ela definida, o Next encaminha as rotas
# listadas em ROTAS_NA_API_NEST (next.config.ts) para a API. Local: http://localhost:3001
API_NEST_URL=
# API_PORT: porta da API NestJS em dev (padrão 3001).
API_PORT=
```

E em `.env.local` (não versionado): `API_NEST_URL=http://localhost:3001`.

- [ ] **Step 3: Verificar ponta a ponta antes de remover as rotas Next**

Terminal 1: `npm run api:dev`
Terminal 2: `npm run dev`
No browser, logar e abrir **Configurações → Status**: listar, criar, renomear e excluir um status.
Expected: tudo funciona, sem `[api] erro em ...` no terminal da API, e `curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/status` sem cookie devolve `401`.

Parar a API (Ctrl+C no terminal 1) e recarregar a página de status.
Expected: a lista falha (o rewrite está ativo) — confirma que quem responde é o Nest. Subir a API de novo.

- [ ] **Step 4: Remover as rotas Next substituídas**

```bash
git rm -r src/app/api/status src/app/api/tipos-status
```

Os testes de contrato equivalentes agora vivem em `apps/api/src/status/*.test.ts`.

- [ ] **Step 5: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run lint && npx tsc --noEmit`
Expected: tudo PASS (o `jest` da raiz não procura mais as rotas removidas; nenhum outro arquivo importava delas — confirmar com `grep -rn "app/api/status\|app/api/tipos-status" src` → vazio).

Run (com API e Next de pé): `npm run e2e`
Expected: PASS nos specs que tocam status/kanban.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts .env.example
git commit -m "feat(api): Next encaminha status e tipos-status para a API NestJS"
```

---

### Task 1.7: Documentar a migração

**Files:**
- Create: `docs/arquitetura/migracao-nestjs.md`
- Modify: `docs/README.md` (adicionar link na seção de arquitetura)

- [ ] **Step 1: Escrever o ADR**

`docs/arquitetura/migracao-nestjs.md`:

```markdown
# Migração para React + NestJS

**Status:** em andamento (branch `feature/migracao-nestjs`) — Fase 1 concluída.

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
2. Demais módulos da API
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
- Erros: `@UseFilters(new ErrosHttpFilter([tradutoresDoModulo]))`; validação com
  `ValidacaoZodPipe(schemaExistente)`.
- Erro inesperado responde 500 `{ error: "Não foi possível concluir a operação." }`.
```

Em `docs/README.md`, na lista de documentos de arquitetura, adicionar:

```markdown
- [Migração para React + NestJS](arquitetura/migracao-nestjs.md) — estratégia strangler, fases e convenções da API
```

- [ ] **Step 2: Commit**

```bash
git add docs/arquitetura/migracao-nestjs.md docs/README.md docs/superpowers/plans/2026-11-01-migracao-nestjs.md
git commit -m "docs(arquitetura): ADR e plano da migração para NestJS"
```

---

### Critério de pronto da Fase 1

- `npm run api:test`, `npm run api:typecheck`, `npx jest`, `npm run lint`, `npx tsc --noEmit` passando.
- Com `API_NEST_URL` definida, status/tipos-status respondidos pelo Nest e e2e verde.
- Sem `API_NEST_URL`, o Next responde 404 para `/api/status` (rotas removidas) — por isso, **até a Fase 5, todo ambiente (dev, preview, produção) precisa de `API_NEST_URL`**. O deploy da API no Vercel entra antes de qualquer merge em `dev`/`main` (ver Fase 5; se o merge precisar acontecer antes, mover a parte de deploy da Fase 5 para logo após a Fase 1).

---

## Fase 2 — Demais módulos da API (parte A)

**Objetivo:** levar para a API Nest os grupos de rota `tipos-processo`, `clientes` (com `clientes/lote` e `clientes/:id/documentos/download-todos`), `casos` (com `casos/filtros`, `casos/kanban` e `casos/:id/documentos/download-todos`) e `comentarios`. O contrato HTTP continua o mesmo: paths, métodos, códigos, corpos `{ chave }` / `{ error, detalhes? }` e o zip em stream. Ao fim de cada task o grupo entra em `ROTAS_NA_API_NEST`, as rotas Next substituídas e seus testes são removidos, e os casos de teste relevantes passam a viver em supertest dentro de `apps/api`. Antes de começar, a Fase 1 precisa estar concluída: `criarAppDeTeste`, `CTX_OWNER`, `TenantGuard`, `@Tenant()`, `ErrosHttpFilter`, `DadosInvalidosError`, `ValidacaoZodPipe` e `ROTAS_NA_API_NEST` já existem.

**Convenções desta parte (somam-se às da Fase 1):**
- Query string é lida por `searchParamsDaRequisicao(req)` (Task 2.1), que devolve um `URLSearchParams` igual ao `new URL(request.url).searchParams` do Next. O `req.query` do Express não é usado: ele transforma parâmetro repetido em array e `a[b]=c` em objeto, o que mudaria a semântica de `parseFiltrosCasoDaQuery`.
- Payload de query inválida (ex.: `GET /api/comentarios`) responde 400 com `throw new DadosInvalidosError(parsed.error)`, o mesmo corpo do `ValidacaoZodPipe`.
- `POST` que no Next respondia 200 (só `clientes/lote`) recebe `@HttpCode(200)`; os demais `POST` ficam com o 201 padrão do Nest.
- Rotas estáticas (`casos/filtros`, `casos/kanban`) são declaradas **antes** de `@Get(":id")` no controller. O Express casa as rotas na ordem de registro, e o Nest registra na ordem de declaração dos métodos.
- O download em zip usa `@Res()` do Express com `responderZip` (Task 2.1) e, na rota, um filtro próprio que traduz erro inesperado para **502** `{ error: "Não foi possível gerar o arquivo zip." }`. É o mesmo código das rotas Next, diferente do 500 genérico das outras rotas.
- Tokens de DI de documentos (`DOCUMENTO_SERVICE`, `ZIP_DOCUMENTOS`) moram em `apps/api/src/comum/tokens-documentos.ts`, porque clientes e casos os usam. O módulo `documentos` da parte B deve importar esse `DOCUMENTO_SERVICE` em vez de criar outro símbolo com o mesmo nome.

---

### Task 2.1: Helpers comuns — query string e resposta zip

**Files:**
- Create: `apps/api/src/comum/query.ts`, `apps/api/src/comum/resposta-zip.ts`, `apps/api/src/comum/tokens-documentos.ts`
- Test: `apps/api/src/comum/query.test.ts`, `apps/api/src/comum/resposta-zip.test.ts`

**Interfaces:**
- Consumes: `TradutorDeErro`, `ErrosHttpFilter` de `apps/api/src/comum/erros-http.filter.ts` (Task 1.3); `configurarApp` (Task 1.1).
- Produces:
  ```ts
  // apps/api/src/comum/query.ts
  export function searchParamsDaRequisicao(req: Request): URLSearchParams;
  export function paginaDaQuery(searchParams: URLSearchParams): number;   // 1-based, inválida → 1
  // apps/api/src/comum/resposta-zip.ts
  export function responderZip(res: ExpressResponse, zip: Readable, nomeArquivo: string): void;
  export const erroAoGerarZip: TradutorDeErro;                             // qualquer erro → 502
  // apps/api/src/comum/tokens-documentos.ts
  export const DOCUMENTO_SERVICE: unique symbol;
  export const ZIP_DOCUMENTOS: unique symbol;
  ```

- [ ] **Step 1: Escrever os testes que falham**

`apps/api/src/comum/query.test.ts`:

```ts
import type { Request } from "express";
import { paginaDaQuery, searchParamsDaRequisicao } from "./query";

function req(originalUrl: string) {
  return { originalUrl } as Request;
}

describe("searchParamsDaRequisicao", () => {
  it("lê a query da URL original, decodificada", () => {
    const params = searchParamsDaRequisicao(req("/api/casos?busca=cobran%C3%A7a&statusId=a,b"));
    expect(params.get("busca")).toBe("cobrança");
    expect(params.get("statusId")).toBe("a,b");
  });

  it("devolve parâmetros vazios quando não há query", () => {
    expect(searchParamsDaRequisicao(req("/api/casos")).toString()).toBe("");
  });

  // Mesma semântica do `new URL(request.url).searchParams` das rotas Next.
  it("get() devolve o primeiro valor de parâmetro repetido e null quando ausente", () => {
    const params = searchParamsDaRequisicao(req("/api/casos?statusId=a&statusId=b"));
    expect(params.get("statusId")).toBe("a");
    expect(params.get("busca")).toBeNull();
  });
});

describe("paginaDaQuery", () => {
  it.each([
    ["", 1],
    ["pagina=3", 3],
    ["pagina=-5", 1],
    ["pagina=0", 1],
    ["pagina=abc", 1],
  ])("'%s' vira página %i", (query, esperado) => {
    expect(paginaDaQuery(new URLSearchParams(query))).toBe(esperado);
  });
});
```

`apps/api/src/comum/resposta-zip.test.ts`:

```ts
import { Readable } from "node:stream";
import { Controller, Get, Res, UseFilters } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import type { Response as ExpressResponse } from "express";
import request from "supertest";
import { configurarApp } from "../criar-app";
import { ErrosHttpFilter } from "./erros-http.filter";
import { erroAoGerarZip, responderZip } from "./resposta-zip";

let falhar = false;

@Controller("zip-teste")
@UseFilters(new ErrosHttpFilter([erroAoGerarZip]))
class ZipTesteController {
  @Get()
  baixar(@Res() res: ExpressResponse) {
    if (falhar) throw new Error("S3 fora do ar em 10.0.0.1");
    responderZip(res, Readable.from([Buffer.from("PK\x03\x04")]), "documentos-caso-Ação de Cobrança.zip");
  }
}

describe("responderZip / erroAoGerarZip", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [ZipTesteController] }).compile();
    app = configurarApp(modulo.createNestApplication());
    await app.init();
  });
  afterAll(() => app.close());
  afterEach(() => {
    falhar = false;
    jest.restoreAllMocks();
  });

  it("transmite o zip com os mesmos headers das rotas Next", async () => {
    const res = await request(app.getHttpServer()).get("/api/zip-teste").responseType("blob").expect(200);

    expect(res.headers["content-type"]).toBe("application/zip");
    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="documentos-caso-Ação de Cobrança.zip"'
    );
    expect(Buffer.from(res.body).toString("latin1")).toBe("PK\x03\x04");
  });

  it("responde 502 sem detalhe técnico quando falha antes do stream", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    falhar = true;

    await request(app.getHttpServer())
      .get("/api/zip-teste")
      .expect(502, { error: "Não foi possível gerar o arquivo zip." });
    expect(console.error).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- comum/query comum/resposta-zip`
Expected: FAIL — `Cannot find module './query'` e `Cannot find module './resposta-zip'`.

- [ ] **Step 3: Implementar**

`apps/api/src/comum/query.ts`:

```ts
import type { Request } from "express";

// As rotas Next liam a query com `new URL(request.url).searchParams`. Reusar um
// URLSearchParams (e não o req.query do Express, que vira array em parâmetro repetido e
// objeto em `a[b]=c`) mantém a semântica de `.get()` — primeiro valor, `null` quando
// ausente — que parseFiltrosCasoDaQuery e as rotas de lista assumem.
export function searchParamsDaRequisicao(req: Request): URLSearchParams {
  const inicio = req.originalUrl.indexOf("?");
  return new URLSearchParams(inicio === -1 ? "" : req.originalUrl.slice(inicio + 1));
}

// Página 1-based vinda da URL. Página inválida ou negativa vira 1 para nunca gerar
// skip negativo no banco (mesma regra das rotas Next de clientes e casos).
export function paginaDaQuery(searchParams: URLSearchParams): number {
  return Math.max(1, Number(searchParams.get("pagina") ?? "1") || 1);
}
```

`apps/api/src/comum/resposta-zip.ts`:

```ts
import { pipeline, type Readable } from "node:stream";
import type { Response as ExpressResponse } from "express";
import type { TradutorDeErro } from "./erros-http.filter";

// Resposta não-JSON: o handler usa @Res() e o Nest não serializa nada. Os headers são
// os mesmos das rotas Next (Content-Disposition com o nome cru entre aspas). O
// res.attachment() do Express não é usado porque trocaria o header por filename*.
//
// Quando o stream começa, o 200 já foi enviado: erro no meio do archiver não vira mais
// status HTTP. O pipeline registra o erro no log e destrói a resposta, então o browser
// vê um download interrompido em vez de um zip truncado "com sucesso".
export function responderZip(res: ExpressResponse, zip: Readable, nomeArquivo: string): void {
  res.status(200);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
  pipeline(zip, res, (erro) => {
    if (erro) console.error("Erro ao montar zip de documentos", erro);
  });
}

// Último tradutor das rotas de zip: o que não foi mapeado antes (tenant, 404 do
// cliente/caso) vira 502, igual às rotas Next. Fica só nessas rotas, nunca no filtro
// global, para não mudar o 500 genérico das demais.
export const erroAoGerarZip: TradutorDeErro = (error) => {
  console.error("Erro ao montar zip de documentos", error);
  return Response.json({ error: "Não foi possível gerar o arquivo zip." }, { status: 502 });
};
```

`apps/api/src/comum/tokens-documentos.ts`:

```ts
// Usados por mais de um módulo (clientes, casos e, na parte B, documentos). Um token só
// evita dois símbolos homônimos apontando para o mesmo service.
export const DOCUMENTO_SERVICE = Symbol("DOCUMENTO_SERVICE");
export const ZIP_DOCUMENTOS = Symbol("ZIP_DOCUMENTOS");
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run api:test -- comum && npm run api:typecheck`
Expected: PASS (query + resposta-zip + suítes da Fase 1); typecheck sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/comum/query.ts apps/api/src/comum/query.test.ts apps/api/src/comum/resposta-zip.ts apps/api/src/comum/resposta-zip.test.ts apps/api/src/comum/tokens-documentos.ts
git commit -m "feat(api): helpers de query string e de resposta zip para os módulos da Fase 2"
```

---

### Task 2.2: Módulo `tipos-processo`

Contrato a reproduzir (`src/app/api/tipos-processo/**`):

| Rota | Sucesso | Erros de domínio (`tratarErroDeTipoProcesso`) |
|---|---|---|
| `GET /api/tipos-processo` | 200 `{ tipos }` | — |
| `POST /api/tipos-processo` | 201 `{ tipo }` | 400 zod, 403 permissão, 409 nome duplicado |
| `PATCH /api/tipos-processo/:id` | 200 `{ tipo }` | 400 zod, 404, 403, 409 |
| `DELETE /api/tipos-processo/:id` | 200 `{ ok: true }` | 404, 403, 409 com processos (RN22) |

**Files:**
- Create: `apps/api/src/tipos-processo/tokens.ts`, `apps/api/src/tipos-processo/tipos-processo.controller.ts`, `apps/api/src/tipos-processo/tipos-processo.module.ts`
- Test: `apps/api/src/tipos-processo/tipos-processo.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/tipos-processo/route.ts`, `src/app/api/tipos-processo/route.test.ts`, `src/app/api/tipos-processo/[id]/route.ts`, `src/app/api/tipos-processo/[id]/route.test.ts`

**Interfaces:**
- Consumes: `criarAppDeTeste`, `CTX_OWNER`, `TenantGuard`, `Tenant`, `ErrosHttpFilter`, `ValidacaoZodPipe` (Fase 1); `tipoProcessoService.{listar(ctx), criar(ctx, dados), atualizar(ctx, id, dados), excluir(ctx, id)}`, `DadosNovoTipoProcesso`, `DadosEdicaoTipoProcesso` e erros `TipoProcessoNaoEncontradoError`, `NomeTipoProcessoDuplicadoError`, `TipoProcessoComCasosError`, `PermissaoNegadaError` de `@/services/tipo-processo.service`; `novoTipoProcessoSchema`, `edicaoTipoProcessoSchema` de `@/lib/api/schemas-tipo-processo`; `tratarErroDeTipoProcesso` de `@/lib/api/erros-tipo-processo`.
- Produces: `TIPO_PROCESSO_SERVICE` (symbol), `TiposProcessoModule`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/tipos-processo/tipos-processo.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { TiposProcessoModule } from "./tipos-processo.module";
import { TIPO_PROCESSO_SERVICE } from "./tokens";
import {
  TipoProcessoNaoEncontradoError,
  NomeTipoProcessoDuplicadoError,
  TipoProcessoComCasosError,
  PermissaoNegadaError,
} from "@/services/tipo-processo.service";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const VALIDO = { nome: "Juros abusivos", icone: "Briefcase", cor: "#6366f1" };

const service = {
  listar: jest.fn(),
  criar: jest.fn(),
  atualizar: jest.fn(),
  excluir: jest.fn(),
};

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [TiposProcessoModule],
    ctx,
    overrides: [[TIPO_PROCESSO_SERVICE, service]],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/tipos-processo", () => {
  it("lista os tipos do escritório", async () => {
    service.listar.mockResolvedValue([{ id: "tipo-processo-1" }]);

    await request(await subir())
      .get("/api/tipos-processo")
      .expect(200, { tipos: [{ id: "tipo-processo-1" }] });
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER);
  });

  it("responde 401 sem sessão e não chama o service (RN19)", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/tipos-processo").expect(401);
    expect(service.listar).not.toHaveBeenCalled();
  });
});

describe("POST /api/tipos-processo", () => {
  it("cria o tipo e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "tipo-processo-1", ...VALIDO });

    await request(await subir())
      .post("/api/tipos-processo")
      .send(VALIDO)
      .expect(201, { tipo: { id: "tipo-processo-1", ...VALIDO } });
    expect(service.criar).toHaveBeenCalledWith(CTX_OWNER, expect.objectContaining(VALIDO));
  });

  it("responde 400 com detalhes para cor fora da paleta", async () => {
    const res = await request(await subir())
      .post("/api/tipos-processo")
      .send({ ...VALIDO, cor: "#abcdef" })
      .expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(res.body.detalhes.cor).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 400 para JSON malformado", async () => {
    await request(await subir())
      .post("/api/tipos-processo")
      .set("content-type", "application/json")
      .send("nao-e-json")
      .expect(400, { error: "Dados inválidos" });
  });

  it("responde 403 quando o papel não pode configurar o escritório", async () => {
    service.criar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).post("/api/tipos-processo").send(VALIDO).expect(403, {
      error: "Você não tem permissão para executar esta ação.",
    });
  });

  it("responde 409 quando o nome já existe no escritório", async () => {
    service.criar.mockRejectedValue(new NomeTipoProcessoDuplicadoError());

    await request(await subir()).post("/api/tipos-processo").send(VALIDO).expect(409, {
      error: "Já existe um tipo de processo com este nome neste escritório.",
    });
  });
});

describe("PATCH /api/tipos-processo/:id", () => {
  it("atualiza parcialmente e responde 200", async () => {
    service.atualizar.mockResolvedValue({ id: "tipo-processo-1", nome: "Revisional" });

    await request(await subir())
      .patch("/api/tipos-processo/tipo-processo-1")
      .send({ nome: "Revisional" })
      .expect(200, { tipo: { id: "tipo-processo-1", nome: "Revisional" } });
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "tipo-processo-1", { nome: "Revisional" });
  });

  it("responde 400 para ícone fora da allow-list", async () => {
    await request(await subir())
      .patch("/api/tipos-processo/tipo-processo-1")
      .send({ icone: "IconeInventado" })
      .expect(400);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("responde 404 para tipo de outro escritório", async () => {
    service.atualizar.mockRejectedValue(new TipoProcessoNaoEncontradoError());

    await request(await subir())
      .patch("/api/tipos-processo/tipo-processo-1")
      .send({ nome: "X" })
      .expect(404, { error: "Tipo de processo não encontrado." });
  });
});

describe("DELETE /api/tipos-processo/:id", () => {
  it("exclui e responde { ok: true }", async () => {
    service.excluir.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/tipos-processo/tipo-processo-1").expect(200, { ok: true });
    expect(service.excluir).toHaveBeenCalledWith(CTX_OWNER, "tipo-processo-1");
  });

  it("responde 409 quando o tipo tem processos vinculados (RN22)", async () => {
    service.excluir.mockRejectedValue(new TipoProcessoComCasosError());

    await request(await subir()).delete("/api/tipos-processo/tipo-processo-1").expect(409, {
      error: "Este tipo tem processos vinculados e não pode ser excluído.",
    });
  });

  it("responde 403 para papel sem permissão", async () => {
    service.excluir.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).delete("/api/tipos-processo/tipo-processo-1").expect(403);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- tipos-processo`
Expected: FAIL — `Cannot find module './tipos-processo.module'`.

- [ ] **Step 3: Implementar**

`apps/api/src/tipos-processo/tokens.ts`:

```ts
export const TIPO_PROCESSO_SERVICE = Symbol("TIPO_PROCESSO_SERVICE");
```

`apps/api/src/tipos-processo/tipos-processo.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { TIPO_PROCESSO_SERVICE } from "./tokens";
import { novoTipoProcessoSchema, edicaoTipoProcessoSchema } from "@/lib/api/schemas-tipo-processo";
import { tratarErroDeTipoProcesso } from "@/lib/api/erros-tipo-processo";
import type {
  tipoProcessoService,
  DadosNovoTipoProcesso,
  DadosEdicaoTipoProcesso,
} from "@/services/tipo-processo.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Natureza do processo, cadastrada pelo escritório (RN22). Escrita restrita a
// owner/admin: a regra está no service, que lança PermissaoNegadaError (403).
@Controller("tipos-processo")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeTipoProcesso]))
export class TiposProcessoController {
  constructor(
    @Inject(TIPO_PROCESSO_SERVICE) private readonly service: typeof tipoProcessoService
  ) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { tipos: await this.service.listar(ctx) };
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novoTipoProcessoSchema)) dados: DadosNovoTipoProcesso
  ) {
    return { tipo: await this.service.criar(ctx, dados) };
  }

  @Patch(":id")
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(edicaoTipoProcessoSchema)) dados: DadosEdicaoTipoProcesso
  ) {
    return { tipo: await this.service.atualizar(ctx, id, dados) };
  }

  @Delete(":id")
  @HttpCode(200)
  async excluir(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.excluir(ctx, id);
    return { ok: true };
  }
}
```

`apps/api/src/tipos-processo/tipos-processo.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { TiposProcessoController } from "./tipos-processo.controller";
import { TIPO_PROCESSO_SERVICE } from "./tokens";
import { tipoProcessoService } from "@/services/tipo-processo.service";

@Module({
  controllers: [TiposProcessoController],
  providers: [{ provide: TIPO_PROCESSO_SERVICE, useValue: tipoProcessoService }],
})
export class TiposProcessoModule {}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run api:test -- tipos-processo && npm run api:typecheck`
Expected: PASS (11 testes); typecheck sem erros.

- [ ] **Step 5: Registrar o módulo, encaminhar o prefixo e remover as rotas Next**

`apps/api/src/app.module.ts` passa a ficar assim:

```ts
import { Module } from "@nestjs/common";
import { SaudeController } from "./saude/saude.controller";
import { TenantModule } from "./comum/tenant/tenant.module";
import { StatusModule } from "./status/status.module";
import { TiposProcessoModule } from "./tipos-processo/tipos-processo.module";

@Module({
  imports: [TenantModule, StatusModule, TiposProcessoModule],
  controllers: [SaudeController],
})
export class AppModule {}
```

(Se a parte B já tiver registrado outros módulos em `imports`, mantenha-os e só acrescente `TiposProcessoModule`.)

Em `next.config.ts`:

```ts
const ROTAS_NA_API_NEST = ["status", "tipos-status", "tipos-processo"];
```

Com `npm run api:dev` e `npm run dev` de pé, abrir **Configurações → Tipos de processo** e criar, renomear e excluir um tipo.
Expected: tudo funciona e o terminal da API não mostra nenhum `[api] erro em ...`.

```bash
git rm -r src/app/api/tipos-processo
grep -rn "app/api/tipos-processo" src
```
Expected do grep: nenhuma saída.

- [ ] **Step 6: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS. O `jest` da raiz deixou de coletar `src/app/api/tipos-processo/**`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/tipos-processo apps/api/src/app.module.ts next.config.ts
git commit -m "feat(api): módulo tipos-processo no NestJS e remoção das rotas Next"
```

---

### Task 2.3: Módulo `clientes` (lista, CRUD, ação em lote e download de documentos)

Contrato a reproduzir (`src/app/api/clientes/**`):

| Rota | Sucesso | Erros |
|---|---|---|
| `GET /api/clientes?busca&pagina&incluirExcluidos` | 200 `{ clientes, total, pagina, porPagina: 20 }` | — |
| `POST /api/clientes` | 201 `{ cliente }` | 400 zod / CPF / telefone / e-mail, 409 CPF duplicado (RN05) |
| `POST /api/clientes/lote` | **200** `{ desativados, ignorados }` ou `{ restaurados, ignorados }` | 400 zod |
| `GET /api/clientes/:id` | 200 `{ cliente }` | 404 (RN19: outro tenant = 404) |
| `PATCH /api/clientes/:id` | 200 `{ cliente }` | 400, 404, 409 |
| `GET /api/clientes/:id/documentos/download-todos` | 200 `application/zip` em stream, `Content-Disposition: attachment; filename="documentos-cliente-<nome>.zip"` | 404 cliente; **502** `{ error: "Não foi possível gerar o arquivo zip." }` em erro inesperado |

Regras do handler Next que precisam ser reproduzidas: paginação (`POR_PAGINA = 20`, `skip = (pagina - 1) * 20`, página inválida vira 1), `incluirExcluidos === "true"`, `busca ?? undefined`, o desvio `acao` → `desativarEmLote`/`restaurarEmLote` e a montagem do zip.

**Files:**
- Create: `apps/api/src/clientes/tokens.ts`, `apps/api/src/clientes/clientes.controller.ts`, `apps/api/src/clientes/clientes.module.ts`
- Test: `apps/api/src/clientes/clientes.controller.test.ts`
- Modify: `src/lib/api/schemas-cliente.ts` (recebe o schema da ação em lote, que hoje é inline na rota), `apps/api/jest.config.cjs` (transpilar o `archiver`), `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/clientes/route.ts`, `src/app/api/clientes/route.test.ts`, `src/app/api/clientes/[id]/route.ts`, `src/app/api/clientes/[id]/route.test.ts`, `src/app/api/clientes/lote/route.ts`, `src/app/api/clientes/lote/route.test.ts`, `src/app/api/clientes/[id]/documentos/download-todos/route.ts`, `src/app/api/clientes/[id]/documentos/download-todos/route.test.ts`

**Interfaces:**
- Consumes: Fase 1 (`criarAppDeTeste`, `CTX_OWNER`, `TenantGuard`, `Tenant`, `ErrosHttpFilter`, `ValidacaoZodPipe`); Task 2.1 (`searchParamsDaRequisicao`, `paginaDaQuery`, `responderZip`, `erroAoGerarZip`, `DOCUMENTO_SERVICE`, `ZIP_DOCUMENTOS`); `clienteService.{listar(ctx, FiltrosCliente), obter(ctx, id), criar(ctx, DadosNovoCliente), atualizar(ctx, id, DadosEdicaoCliente), desativarEmLote(ctx, ids), restaurarEmLote(ctx, ids)}` e erros `ClienteNaoEncontradoError`, `CpfInvalidoError`, `CpfDuplicadoError(excluido: boolean)` de `@/services/cliente.service`; `documentoService.listarPorEscopo(ctx, "cliente", id)`; `montarZipDocumentos(documentos): Archiver` de `@/lib/documentos/zip`; `novoClienteSchema`, `edicaoClienteSchema` de `@/lib/api/schemas-cliente`; `tratarErroDeCliente` de `@/lib/api/erros-cliente`.
- Produces: `acaoEmLoteClientesSchema`, `type AcaoEmLoteClientes` (em `@/lib/api/schemas-cliente`); `CLIENTE_SERVICE`, `POR_PAGINA_CLIENTES = 20`; `ClientesModule`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/clientes/clientes.controller.test.ts`:

```ts
import { Readable } from "node:stream";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { ClientesModule } from "./clientes.module";
import { CLIENTE_SERVICE } from "./tokens";
import { DOCUMENTO_SERVICE, ZIP_DOCUMENTOS } from "../comum/tokens-documentos";
import {
  ClienteNaoEncontradoError,
  CpfDuplicadoError,
  CpfInvalidoError,
} from "@/services/cliente.service";
import { NaoAutenticadoError, SemEscritorioAtivoError } from "@/lib/auth/resolver-tenant";

const CPF = "529.982.247-25";
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

const service = {
  listar: jest.fn(),
  obter: jest.fn(),
  criar: jest.fn(),
  atualizar: jest.fn(),
  desativarEmLote: jest.fn(),
  restaurarEmLote: jest.fn(),
};
const documentos = { listarPorEscopo: jest.fn() };
const montarZip = jest.fn();

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [ClientesModule],
    ctx,
    overrides: [
      [CLIENTE_SERVICE, service],
      [DOCUMENTO_SERVICE, documentos],
      [ZIP_DOCUMENTOS, montarZip],
    ],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  await app?.close();
});

describe("GET /api/clientes", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/clientes").expect(401);
    expect(service.listar).not.toHaveBeenCalled();
  });

  it("responde 409 sem escritório ativo", async () => {
    await request(await subir(new SemEscritorioAtivoError())).get("/api/clientes").expect(409);
  });

  it("repassa busca e paginação ao service e devolve os metadados", async () => {
    service.listar.mockResolvedValue({ clientes: [{ id: "cli-1" }], total: 41 });

    await request(await subir())
      .get("/api/clientes?busca=maria&pagina=3&incluirExcluidos=true")
      .expect(200, { clientes: [{ id: "cli-1" }], total: 41, pagina: 3, porPagina: 20 });
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER, {
      busca: "maria",
      incluirExcluidos: true,
      skip: 40,
      take: 20,
    });
  });

  it("sem query: página 1, sem busca, sem excluídos", async () => {
    service.listar.mockResolvedValue({ clientes: [], total: 0 });

    await request(await subir()).get("/api/clientes").expect(200);
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER, {
      busca: undefined,
      incluirExcluidos: false,
      skip: 0,
      take: 20,
    });
  });

  // Página inválida vinda da URL não pode virar skip negativo no banco.
  it("normaliza página inválida para a primeira", async () => {
    service.listar.mockResolvedValue({ clientes: [], total: 0 });

    await request(await subir()).get("/api/clientes?pagina=-5").expect(200);
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER, expect.objectContaining({ skip: 0 }));
  });
});

describe("POST /api/clientes", () => {
  it("cria o cliente e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "cli-1" });

    await request(await subir())
      .post("/api/clientes")
      .send({ nome: "Maria Silva", cpf: CPF })
      .expect(201, { cliente: { id: "cli-1" } });
    expect(service.criar).toHaveBeenCalledWith(CTX_OWNER, expect.objectContaining({ nome: "Maria Silva" }));
  });

  it.each([
    ["nome curto", { nome: "Ma", cpf: CPF }, "nome"],
    ["CPF com dígito errado", { nome: "Maria Silva", cpf: "123456789" }, "cpf"],
    ["telefone incompleto", { nome: "Maria Silva", cpf: CPF, telefone: "47999998888" }, "telefone"],
    ["e-mail malformado", { nome: "Maria Silva", cpf: CPF, email: "mariasilvateste" }, "email"],
  ])("responde 400 com detalhes por campo (%s)", async (_caso, corpo, campo) => {
    const res = await request(await subir()).post("/api/clientes").send(corpo).expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(res.body.detalhes[campo]).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("aceita telefone e e-mail válidos", async () => {
    service.criar.mockResolvedValue({ id: "cli-1" });

    await request(await subir())
      .post("/api/clientes")
      .send({
        nome: "Maria Silva",
        cpf: CPF,
        telefone: "+55 (47) 99999-8888",
        email: "maria.silva@exemplo.com",
      })
      .expect(201);
  });

  it("responde 400 quando o body não é JSON", async () => {
    await request(await subir())
      .post("/api/clientes")
      .set("content-type", "application/json")
      .send("nao-e-json")
      .expect(400, { error: "Dados inválidos" });
  });

  it("responde 409 quando o CPF já existe no escritório (RN05)", async () => {
    service.criar.mockRejectedValue(new CpfDuplicadoError(false));

    await request(await subir()).post("/api/clientes").send({ nome: "Maria Silva", cpf: CPF }).expect(409, {
      error: "Já existe um cliente com este CPF neste escritório.",
    });
  });

  it("responde 400 quando o service recusa o CPF", async () => {
    service.criar.mockRejectedValue(new CpfInvalidoError());

    await request(await subir()).post("/api/clientes").send({ nome: "Maria Silva", cpf: CPF }).expect(400, {
      error: "CPF inválido.",
    });
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.criar.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir())
      .post("/api/clientes")
      .send({ nome: "Maria Silva", cpf: CPF })
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("POST /api/clientes/lote", () => {
  it("desativa os clientes selecionados e responde 200", async () => {
    service.desativarEmLote.mockResolvedValue({ desativados: 2, ignorados: 0 });

    await request(await subir())
      .post("/api/clientes/lote")
      .send({ ids: [ID_A, ID_B], acao: "desativar" })
      .expect(200, { desativados: 2, ignorados: 0 });
    expect(service.desativarEmLote).toHaveBeenCalledWith(CTX_OWNER, [ID_A, ID_B]);
  });

  it("restaura quando a ação é restaurar", async () => {
    service.restaurarEmLote.mockResolvedValue({ restaurados: 1, ignorados: 0 });

    await request(await subir())
      .post("/api/clientes/lote")
      .send({ ids: [ID_A], acao: "restaurar" })
      .expect(200, { restaurados: 1, ignorados: 0 });
    expect(service.restaurarEmLote).toHaveBeenCalledWith(CTX_OWNER, [ID_A]);
    expect(service.desativarEmLote).not.toHaveBeenCalled();
  });

  it.each([
    ["lista vazia", { ids: [], acao: "desativar" }],
    ["ação desconhecida", { ids: [ID_A], acao: "excluir-de-vez" }],
    ["id que não é uuid", { ids: ["'; drop table cliente; --"], acao: "desativar" }],
  ])("recusa %s com 400", async (_caso, corpo) => {
    await request(await subir()).post("/api/clientes/lote").send(corpo).expect(400);
    expect(service.desativarEmLote).not.toHaveBeenCalled();
    expect(service.restaurarEmLote).not.toHaveBeenCalled();
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .post("/api/clientes/lote")
      .send({ ids: [ID_A], acao: "desativar" })
      .expect(401);
  });
});

describe("GET /api/clientes/:id", () => {
  it("devolve o cliente do escritório", async () => {
    service.obter.mockResolvedValue({ id: "cli-1" });

    await request(await subir()).get("/api/clientes/cli-1").expect(200, { cliente: { id: "cli-1" } });
    expect(service.obter).toHaveBeenCalledWith(CTX_OWNER, "cli-1");
  });

  // RN19: cliente de outro tenant responde 404, nunca 403 — não confirma que existe.
  it("responde 404 para cliente de outro escritório", async () => {
    service.obter.mockRejectedValue(new ClienteNaoEncontradoError());

    await request(await subir()).get("/api/clientes/cli-1").expect(404, { error: "Cliente não encontrado." });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/clientes/cli-1").expect(401);
  });
});

describe("PATCH /api/clientes/:id", () => {
  it("atualiza apenas os campos enviados", async () => {
    service.atualizar.mockResolvedValue({ id: "cli-1" });

    await request(await subir())
      .patch("/api/clientes/cli-1")
      .send({ telefone: "5548988887777" })
      .expect(200, { cliente: { id: "cli-1" } });
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "cli-1", { telefone: "5548988887777" });
  });

  it("aceita null para limpar um campo opcional", async () => {
    service.atualizar.mockResolvedValue({ id: "cli-1" });

    await request(await subir()).patch("/api/clientes/cli-1").send({ telefone: null }).expect(200);
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "cli-1", { telefone: null });
  });

  it("responde 400 com detalhes quando o nome é curto demais", async () => {
    const res = await request(await subir()).patch("/api/clientes/cli-1").send({ nome: "Ma" }).expect(400);
    expect(res.body.detalhes.nome).toBeDefined();
  });

  it("responde 409 em colisão de CPF", async () => {
    service.atualizar.mockRejectedValue(new CpfDuplicadoError(true));

    await request(await subir()).patch("/api/clientes/cli-1").send({ cpf: CPF }).expect(409);
  });
});

describe("GET /api/clientes/:id/documentos/download-todos", () => {
  it("devolve um stream zip com o nome do cliente no filename", async () => {
    service.obter.mockResolvedValue({ id: "cli-1", nome: "Maria Silva" });
    documentos.listarPorEscopo.mockResolvedValue([{ id: "doc-1" }]);
    montarZip.mockReturnValue(Readable.from([Buffer.from("PK\x03\x04")]));

    const res = await request(await subir())
      .get("/api/clientes/cli-1/documentos/download-todos")
      .responseType("blob")
      .expect(200);

    expect(res.headers["content-type"]).toBe("application/zip");
    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="documentos-cliente-Maria Silva.zip"'
    );
    expect(Buffer.from(res.body).toString("latin1")).toBe("PK\x03\x04");
    expect(documentos.listarPorEscopo).toHaveBeenCalledWith(CTX_OWNER, "cliente", "cli-1");
    expect(montarZip).toHaveBeenCalledWith([{ id: "doc-1" }]);
  });

  it("mapeia ClienteNaoEncontradoError para 404 e não monta zip", async () => {
    service.obter.mockRejectedValue(new ClienteNaoEncontradoError());

    await request(await subir())
      .get("/api/clientes/cli-alheio/documentos/download-todos")
      .expect(404, { error: "Cliente não encontrado." });
    expect(montarZip).not.toHaveBeenCalled();
  });

  it("responde 502 quando falha ao listar os documentos", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.obter.mockResolvedValue({ id: "cli-1", nome: "Maria Silva" });
    documentos.listarPorEscopo.mockRejectedValue(new Error("timeout"));

    await request(await subir())
      .get("/api/clientes/cli-1/documentos/download-todos")
      .expect(502, { error: "Não foi possível gerar o arquivo zip." });
  });

  // A resposta já saiu com 200 quando o stream começa: erro interno do archiver não pode
  // desaparecer em silêncio — o pipeline do responderZip registra um listener de erro.
  it("registra listener de erro no stream do zip", async () => {
    service.obter.mockResolvedValue({ id: "cli-1", nome: "Maria Silva" });
    documentos.listarPorEscopo.mockResolvedValue([]);
    const zip = Readable.from([Buffer.from("PK\x03\x04")]);
    const espiaOn = jest.spyOn(zip, "on");
    montarZip.mockReturnValue(zip);

    await request(await subir()).get("/api/clientes/cli-1/documentos/download-todos").expect(200);
    expect(espiaOn).toHaveBeenCalledWith("error", expect.any(Function));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- clientes`
Expected: FAIL — `Cannot find module './clientes.module'`.

- [ ] **Step 3: Mover o schema da ação em lote para o domínio**

Ao fim de `src/lib/api/schemas-cliente.ts`, acrescentar (o mesmo schema que hoje é inline em `src/app/api/clientes/lote/route.ts`):

```ts
// Ação em lote da tabela de clientes. O teto de 200 ids limita o tamanho da transação;
// ids de outro escritório (RN19) e já desativados são descartados pelo Service.
export const acaoEmLoteClientesSchema = z.object({
  ids: z.array(z.uuid()).min(1, "Selecione ao menos um cliente.").max(200),
  acao: z.enum(["desativar", "restaurar"]),
});

export type AcaoEmLoteClientes = z.infer<typeof acaoEmLoteClientesSchema>;
```

- [ ] **Step 4: Fazer o Jest da API transpilar o `archiver`**

O `ClientesModule` registra `montarZipDocumentos` (`@/lib/documentos/zip`). Esse arquivo importa o `archiver@8`, publicado como ESM puro junto com as deps `zip-stream`, `compress-commons`, `crc32-stream` e `is-stream` — a mesma lista do `transpilePackages` do `next.config.ts`. O `saude.controller.test.ts` importa o `AppModule` inteiro, então as suítes que não mexem em zip também passam a carregar o `archiver`. Em `apps/api/jest.config.cjs`, trocar a linha `transformIgnorePatterns` por:

```js
  transformIgnorePatterns: [
    "/node_modules/(?!(@nestjs|next-auth|@auth|@panva|jose|oauth4webapi|archiver|zip-stream|compress-commons|crc32-stream|is-stream)/)",
  ],
```

- [ ] **Step 5: Implementar o módulo**

`apps/api/src/clientes/tokens.ts`:

```ts
export const CLIENTE_SERVICE = Symbol("CLIENTE_SERVICE");

// Mesmo tamanho de página da rota Next (e da tabela de clientes no front).
export const POR_PAGINA_CLIENTES = 20;
```

`apps/api/src/clientes/clientes.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response as ExpressResponse } from "express";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { paginaDaQuery, searchParamsDaRequisicao } from "../comum/query";
import { erroAoGerarZip, responderZip } from "../comum/resposta-zip";
import { DOCUMENTO_SERVICE, ZIP_DOCUMENTOS } from "../comum/tokens-documentos";
import { CLIENTE_SERVICE, POR_PAGINA_CLIENTES } from "./tokens";
import {
  novoClienteSchema,
  edicaoClienteSchema,
  acaoEmLoteClientesSchema,
  type AcaoEmLoteClientes,
} from "@/lib/api/schemas-cliente";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import type {
  clienteService,
  DadosNovoCliente,
  DadosEdicaoCliente,
} from "@/services/cliente.service";
import type { documentoService } from "@/services/documento.service";
import type { montarZipDocumentos } from "@/lib/documentos/zip";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Cadastro de clientes (RN04/RN05). Cliente nunca é apagado: "desativar" é soft delete,
// reversível pela ação em lote "restaurar".
@Controller("clientes")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeCliente]))
export class ClientesController {
  constructor(
    @Inject(CLIENTE_SERVICE) private readonly service: typeof clienteService,
    @Inject(DOCUMENTO_SERVICE)
    private readonly documentos: Pick<typeof documentoService, "listarPorEscopo">,
    @Inject(ZIP_DOCUMENTOS) private readonly montarZip: typeof montarZipDocumentos
  ) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const params = searchParamsDaRequisicao(req);
    const pagina = paginaDaQuery(params);

    const { clientes, total } = await this.service.listar(ctx, {
      busca: params.get("busca") ?? undefined,
      incluirExcluidos: params.get("incluirExcluidos") === "true",
      skip: (pagina - 1) * POR_PAGINA_CLIENTES,
      take: POR_PAGINA_CLIENTES,
    });

    return { clientes, total, pagina, porPagina: POR_PAGINA_CLIENTES };
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novoClienteSchema)) dados: DadosNovoCliente
  ) {
    return { cliente: await this.service.criar(ctx, dados) };
  }

  // A rota Next respondia 200 (não 201): não cria recurso, só muda estado de vários.
  @Post("lote")
  @HttpCode(200)
  async acaoEmLote(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(acaoEmLoteClientesSchema)) { ids, acao }: AcaoEmLoteClientes
  ) {
    return acao === "desativar"
      ? this.service.desativarEmLote(ctx, ids)
      : this.service.restaurarEmLote(ctx, ids);
  }

  @Get(":id")
  async obter(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    return { cliente: await this.service.obter(ctx, id) };
  }

  @Patch(":id")
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(edicaoClienteSchema)) dados: DadosEdicaoCliente
  ) {
    return { cliente: await this.service.atualizar(ctx, id, dados) };
  }

  // Resposta em stream: @Res() tira o Nest da serialização. Erros antes do stream (tenant,
  // cliente de outro escritório) ainda passam pelo filtro: 401/409/403/404, e o resto
  // vira 502 como na rota Next. O filtro de método substitui o do controller, por isso
  // repete tratarErroDeCliente.
  @Get(":id/documentos/download-todos")
  @UseFilters(new ErrosHttpFilter([tratarErroDeCliente, erroAoGerarZip]))
  async baixarTodos(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Res() res: ExpressResponse
  ) {
    const cliente = await this.service.obter(ctx, id);
    const documentos = await this.documentos.listarPorEscopo(ctx, "cliente", id);
    responderZip(res, this.montarZip(documentos), `documentos-cliente-${cliente.nome}.zip`);
  }
}
```

`apps/api/src/clientes/clientes.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { ClientesController } from "./clientes.controller";
import { CLIENTE_SERVICE } from "./tokens";
import { DOCUMENTO_SERVICE, ZIP_DOCUMENTOS } from "../comum/tokens-documentos";
import { clienteService } from "@/services/cliente.service";
import { documentoService } from "@/services/documento.service";
import { montarZipDocumentos } from "@/lib/documentos/zip";

@Module({
  controllers: [ClientesController],
  providers: [
    { provide: CLIENTE_SERVICE, useValue: clienteService },
    { provide: DOCUMENTO_SERVICE, useValue: documentoService },
    { provide: ZIP_DOCUMENTOS, useValue: montarZipDocumentos },
  ],
})
export class ClientesModule {}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm run api:test -- clientes && npm run api:typecheck`
Expected: PASS (todos os testes de `clientes.controller.test.ts`); typecheck sem erros.

- [ ] **Step 7: Registrar o módulo, encaminhar o prefixo e remover as rotas Next**

`apps/api/src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { SaudeController } from "./saude/saude.controller";
import { TenantModule } from "./comum/tenant/tenant.module";
import { StatusModule } from "./status/status.module";
import { TiposProcessoModule } from "./tipos-processo/tipos-processo.module";
import { ClientesModule } from "./clientes/clientes.module";

@Module({
  imports: [TenantModule, StatusModule, TiposProcessoModule, ClientesModule],
  controllers: [SaudeController],
})
export class AppModule {}
```

Em `next.config.ts`:

```ts
const ROTAS_NA_API_NEST = ["status", "tipos-status", "tipos-processo", "clientes"];
```

Verificação manual, com `npm run api:dev` e `npm run dev` de pé:
1. **Clientes**: buscar, paginar, marcar "incluir excluídos", criar com CPF repetido (o toast precisa mostrar o 409), editar, desativar e restaurar em lote.
2. Abrir um processo e, no grupo de documentos do cliente, clicar em **Baixar todos**.

Expected: o zip baixa com o nome `documentos-cliente-<nome>.zip`, e o terminal da API não mostra nenhum `[api] erro em ...`.

```bash
git rm -r src/app/api/clientes
grep -rn "app/api/clientes" src
```
Expected do grep: nenhuma saída.

- [ ] **Step 8: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS. `src/lib/api/schemas-cliente.ts` continua compilando no Next, e o `saude.controller.test.ts` carrega o `AppModule` com o `archiver` transpilado.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/clientes apps/api/src/app.module.ts apps/api/jest.config.cjs src/lib/api/schemas-cliente.ts next.config.ts
git commit -m "feat(api): módulo clientes no NestJS com ação em lote e download de documentos"
```

---

### Task 2.4: Módulo `casos` (lista, kanban, filtros, CRUD/arquivamento e download de documentos)

Contrato a reproduzir (`src/app/api/casos/**`):

| Rota | Sucesso | Erros |
|---|---|---|
| `GET /api/casos?busca&statusId&tipoStatusId&tipoProcessoId&clienteId&responsavelId&dataInicio&dataFim&arquivado&pagina` | 200 `ListaCasos` = `{ casos (serializados), total, pagina, porPagina: 20 }` | — |
| `POST /api/casos` | 201 `{ caso }` (registro **cru**, sem serializar — igual ao Next) | 400 zod / cliente inativo / responsável inválido, 404 cliente/status de outro tenant |
| `GET /api/casos/filtros` | 200 `FiltrosCasoOpcoes` = `{ clientes, membros, status, tipos, tiposProcesso }` | — |
| `GET /api/casos/kanban?<mesmos filtros>` | 200 `{ colunas: [{ status, total, casos (serializados) }] }` | — |
| `GET /api/casos/:id` | 200 `{ caso }` serializado | 404 |
| `PATCH /api/casos/:id` | 200 `{ caso }` serializado | 400, 404 |
| `DELETE /api/casos/:id` | 200 `{ caso }` serializado (arquiva; RN08) | 404 |
| `GET /api/casos/:id/documentos/download-todos` | 200 zip, `filename="documentos-caso-<tipoProcesso.nome>.zip"` | 404 caso; 502 em erro inesperado |

Regras de handler reproduzidas: `parseFiltrosCasoDaQuery` sobre o `URLSearchParams` da requisição, paginação via `montarListaCasos`, serialização (`serializarCaso`/`serializarCasos`, que removem o `senhaHash` do responsável e assinam o avatar), e o `map` das colunas do kanban.

**Files:**
- Create: `apps/api/src/casos/tokens.ts`, `apps/api/src/casos/casos.controller.ts`, `apps/api/src/casos/casos.module.ts`, `src/lib/api/payloads/casos-filtros.test.ts`
- Test: `apps/api/src/casos/casos.controller.test.ts`, `src/lib/api/payloads/casos-filtros.test.ts`
- Modify: `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/casos/route.ts`, `src/app/api/casos/route.test.ts`, `src/app/api/casos/[id]/route.ts`, `src/app/api/casos/[id]/route.test.ts`, `src/app/api/casos/filtros/route.ts`, `src/app/api/casos/filtros/route.test.ts`, `src/app/api/casos/kanban/route.ts`, `src/app/api/casos/kanban/route.test.ts`, `src/app/api/casos/[id]/documentos/download-todos/route.ts`, `src/app/api/casos/[id]/documentos/download-todos/route.test.ts`

**Interfaces:**
- Consumes: Fase 1 e Task 2.1 (como na Task 2.3); `casoService.{obter(ctx, id), criar(ctx, DadosNovoCaso), atualizar(ctx, id, DadosEdicaoCaso), arquivar(ctx, id), listarKanban(ctx, filtros)}`, `DadosNovoCaso`, `DadosEdicaoCaso`, erros `CasoNaoEncontradoError`, `ClienteInativoError`, `ResponsavelInvalidoError` de `@/services/caso.service`; `ClienteNaoEncontradoError` de `@/services/cliente.service`; `montarListaCasos(ctx, filtros, pagina): Promise<ListaCasos>` de `@/lib/api/payloads/casos-lista`; `montarOpcoesFiltroCaso(ctx): Promise<FiltrosCasoOpcoes>` de `@/lib/api/payloads/casos-filtros`; `serializarCaso`, `serializarCasos` de `@/lib/api/serializa-caso`; `parseFiltrosCasoDaQuery`, `novoCasoSchema`, `edicaoCasoSchema` de `@/lib/api/schemas-caso`; `tratarErroDeCaso` de `@/lib/api/erros-caso`.
- Produces: `CASO_SERVICE`, `PAYLOADS_CASO` (symbols), `type PayloadsCaso = { montarListaCasos; montarOpcoesFiltroCaso }`, `CasosModule`.

Os montadores de payload entram por token (`PAYLOADS_CASO`) porque `montarListaCasos` chama o `casoService` real por dentro. Com o token, o teste de controller troca o montador inteiro, e a lógica de paginação e serialização continua coberta em `casos-lista.test.ts` e `serializa-caso.test.ts`, que já existem. O teste de forma do payload de filtros, que hoje só existe em `casos/filtros/route.test.ts`, migra para um teste de domínio em `src/lib/api/payloads/casos-filtros.test.ts`.

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/api/payloads/casos-filtros.test.ts` (é a porta do teste de payload de `src/app/api/casos/filtros/route.test.ts`. Neste momento ele **passa**, porque o código já existe; o objetivo é não perder cobertura quando a rota for removida no Step 6):

```ts
/**
 * @jest-environment node
 */
import { montarOpcoesFiltroCaso } from "./casos-filtros";
import { clienteRepository } from "@/repositories/cliente.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { statusRepository } from "@/repositories/status.repository";
import { tipoStatusRepository } from "@/repositories/tipo-status.repository";
import { tipoProcessoRepository } from "@/repositories/tipo-processo.repository";

jest.mock("@/repositories/cliente.repository", () => ({ clienteRepository: { listar: jest.fn() } }));
jest.mock("@/repositories/membro.repository", () => ({
  membroRepository: { listarComUsuarioPorEscritorio: jest.fn() },
}));
jest.mock("@/repositories/status.repository", () => ({ statusRepository: { listar: jest.fn() } }));
jest.mock("@/repositories/tipo-status.repository", () => ({ tipoStatusRepository: { listar: jest.fn() } }));
jest.mock("@/repositories/tipo-processo.repository", () => ({
  tipoProcessoRepository: { listar: jest.fn() },
}));
jest.mock("@/services/usuario.service", () => ({ usuarioService: { assinarUrlAvatar: jest.fn() } }));

const clientes = clienteRepository as jest.Mocked<typeof clienteRepository>;
const membros = membroRepository as jest.Mocked<typeof membroRepository>;
const status = statusRepository as jest.Mocked<typeof statusRepository>;
const tipos = tipoStatusRepository as jest.Mocked<typeof tipoStatusRepository>;
const tiposProcesso = tipoProcessoRepository as jest.Mocked<typeof tipoProcessoRepository>;
const { usuarioService } = jest.requireMock("@/services/usuario.service");

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };

beforeEach(() => jest.clearAllMocks());

describe("montarOpcoesFiltroCaso", () => {
  it("monta o payload único de opções de filtro, escopado ao escritório e com avatar assinado", async () => {
    clientes.listar.mockResolvedValue([{ id: "cliente-1", nome: "Maria", cpf: "52998224725" }] as never);
    membros.listarComUsuarioPorEscritorio.mockResolvedValue([
      { id: "membro-1", usuario: { nome: "Advogado", avatarUrl: "development/avatares/user-1/foto.png" } },
    ] as never);
    status.listar.mockResolvedValue([{ id: "status-1", nome: "Novo", cor: "#000" }] as never);
    tipos.listar.mockResolvedValue([{ id: "tipo-1", nome: "Lead", chave: "lead", cor: "#111" }] as never);
    tiposProcesso.listar.mockResolvedValue([
      { id: "tipo-processo-1", nome: "Ação de cobrança", cor: "#222", icone: "Briefcase" },
    ] as never);
    usuarioService.assinarUrlAvatar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");

    const payload = JSON.parse(JSON.stringify(await montarOpcoesFiltroCaso(ctx)));

    expect(payload).toEqual({
      clientes: [{ id: "cliente-1", nome: "Maria", cpf: "52998224725" }],
      membros: [{ id: "membro-1", nome: "Advogado", avatarUrl: "https://bucket.s3.amazonaws.com/signed-get" }],
      status: [{ id: "status-1", nome: "Novo", cor: "#000" }],
      tipos: [{ id: "tipo-1", nome: "Lead", chave: "lead", cor: "#111" }],
      tiposProcesso: [{ id: "tipo-processo-1", nome: "Ação de cobrança", cor: "#222", icone: "Briefcase" }],
    });
    expect(clientes.listar).toHaveBeenCalledWith("esc-1");
    expect(status.listar).toHaveBeenCalledWith("esc-1");
    expect(tiposProcesso.listar).toHaveBeenCalledWith("esc-1");
    expect(usuarioService.assinarUrlAvatar).toHaveBeenCalledWith("development/avatares/user-1/foto.png");
  });
});
```

O `JSON.parse(JSON.stringify(...))` reproduz a serialização da resposta HTTP, que descarta os campos `descricao: undefined` que vêm dos mocks.

`apps/api/src/casos/casos.controller.test.ts`:

```ts
import { Readable } from "node:stream";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { CasosModule } from "./casos.module";
import { CASO_SERVICE, PAYLOADS_CASO } from "./tokens";
import { DOCUMENTO_SERVICE, ZIP_DOCUMENTOS } from "../comum/tokens-documentos";
import {
  CasoNaoEncontradoError,
  ClienteInativoError,
  ResponsavelInvalidoError,
} from "@/services/caso.service";
import { ClienteNaoEncontradoError } from "@/services/cliente.service";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

// serializarCaso (chamado de verdade pelo controller) assina o avatar via usuarioService:
// o mock deixa verificar que o senhaHash não vaza e o avatar sai assinado.
jest.mock("@/services/usuario.service", () => ({
  usuarioService: { assinarUrlAvatar: jest.fn() },
}));
const { usuarioService } = jest.requireMock("@/services/usuario.service");

const CLIENTE_ID = "11111111-1111-4111-8111-111111111111";
const STATUS_ID = "22222222-2222-4222-8222-222222222222";
const TIPO_PROCESSO_ID = "44444444-4444-4444-8444-444444444444";
const CORPO_NOVO = { tipoProcessoId: TIPO_PROCESSO_ID, clienteId: CLIENTE_ID, statusId: STATUS_ID };

const RESPONSAVEL_COM_HASH = {
  id: "membro-1",
  usuario: {
    id: "user-1",
    nome: "Fulano",
    email: "fulano@teste.com",
    senhaHash: "hash-nunca-deveria-sair",
    avatarUrl: "development/avatares/user-1/foto.png",
  },
};

const service = {
  obter: jest.fn(),
  criar: jest.fn(),
  atualizar: jest.fn(),
  arquivar: jest.fn(),
  listarKanban: jest.fn(),
};
const payloads = { montarListaCasos: jest.fn(), montarOpcoesFiltroCaso: jest.fn() };
const documentos = { listarPorEscopo: jest.fn() };
const montarZip = jest.fn();

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [CasosModule],
    ctx,
    overrides: [
      [CASO_SERVICE, service],
      [PAYLOADS_CASO, payloads],
      [DOCUMENTO_SERVICE, documentos],
      [ZIP_DOCUMENTOS, montarZip],
    ],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  await app?.close();
});

describe("GET /api/casos", () => {
  it("monta a lista com os filtros da query e a página", async () => {
    payloads.montarListaCasos.mockResolvedValue({ casos: [], total: 0, pagina: 2, porPagina: 20 });

    await request(await subir())
      .get(`/api/casos?busca=cobran%C3%A7a&statusId=${STATUS_ID}&pagina=2`)
      .expect(200, { casos: [], total: 0, pagina: 2, porPagina: 20 });
    expect(payloads.montarListaCasos).toHaveBeenCalledWith(
      CTX_OWNER,
      expect.objectContaining({ busca: "cobrança", statusIds: [STATUS_ID], arquivado: false }),
      2
    );
  });

  it("repassa listas separadas por vírgula, sem-responsavel e arquivado", async () => {
    payloads.montarListaCasos.mockResolvedValue({ casos: [], total: 0, pagina: 1, porPagina: 20 });

    await request(await subir())
      .get("/api/casos?clienteId=a,b&responsavelId=sem-responsavel&arquivado=true&dataInicio=2026-01-01")
      .expect(200);
    expect(payloads.montarListaCasos).toHaveBeenCalledWith(
      CTX_OWNER,
      expect.objectContaining({
        clienteIds: ["a", "b"],
        responsavelIds: ["sem-responsavel"],
        arquivado: true,
        dataInicio: new Date("2026-01-01"),
      }),
      1
    );
  });

  it("normaliza página inválida para 1", async () => {
    payloads.montarListaCasos.mockResolvedValue({ casos: [], total: 0, pagina: 1, porPagina: 20 });

    await request(await subir()).get("/api/casos?pagina=-3").expect(200);
    expect(payloads.montarListaCasos).toHaveBeenCalledWith(CTX_OWNER, expect.any(Object), 1);
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/casos").expect(401);
    expect(payloads.montarListaCasos).not.toHaveBeenCalled();
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    payloads.montarListaCasos.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir())
      .get("/api/casos")
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("POST /api/casos", () => {
  it("cria o caso e responde 201 com o registro", async () => {
    service.criar.mockResolvedValue({ id: "caso-1" });

    await request(await subir()).post("/api/casos").send(CORPO_NOVO).expect(201, { caso: { id: "caso-1" } });
    expect(service.criar).toHaveBeenCalledWith(CTX_OWNER, expect.objectContaining(CORPO_NOVO));
  });

  it("responde 400 quando o body não é JSON", async () => {
    await request(await subir())
      .post("/api/casos")
      .set("content-type", "application/json")
      .send("nao-e-json")
      .expect(400, { error: "Dados inválidos" });
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 400 com detalhes quando falta o tipo de processo (RN22)", async () => {
    const res = await request(await subir())
      .post("/api/casos")
      .send({ clienteId: CLIENTE_ID, statusId: STATUS_ID })
      .expect(400);
    expect(res.body.detalhes.tipoProcessoId).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 404 quando o cliente não é do tenant (RN06)", async () => {
    service.criar.mockRejectedValue(new ClienteNaoEncontradoError());

    await request(await subir()).post("/api/casos").send(CORPO_NOVO).expect(404, {
      error: "Cliente não encontrado.",
    });
  });

  it("responde 400 quando o cliente está inativo", async () => {
    service.criar.mockRejectedValue(new ClienteInativoError());

    await request(await subir()).post("/api/casos").send(CORPO_NOVO).expect(400, {
      error: "Este cliente está inativo e não pode ser vinculado a um processo.",
    });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).post("/api/casos").send(CORPO_NOVO).expect(401);
  });
});

describe("GET /api/casos/filtros", () => {
  it("devolve o payload de opções sem cair na rota :id", async () => {
    const opcoes = { clientes: [], membros: [], status: [], tipos: [], tiposProcesso: [] };
    payloads.montarOpcoesFiltroCaso.mockResolvedValue(opcoes);

    await request(await subir()).get("/api/casos/filtros").expect(200, opcoes);
    expect(payloads.montarOpcoesFiltroCaso).toHaveBeenCalledWith(CTX_OWNER);
    expect(service.obter).not.toHaveBeenCalled();
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/casos/filtros").expect(401);
  });
});

describe("GET /api/casos/kanban", () => {
  it("devolve as colunas montadas pelo service, sem cair na rota :id", async () => {
    const colunas = [{ status: { id: "status-1" }, total: 2, casos: [] }];
    service.listarKanban.mockResolvedValue(colunas);

    await request(await subir()).get("/api/casos/kanban?busca=cobran%C3%A7a").expect(200, { colunas });
    expect(service.listarKanban).toHaveBeenCalledWith(CTX_OWNER, expect.objectContaining({ busca: "cobrança" }));
    expect(service.obter).not.toHaveBeenCalled();
  });

  it("serializa os casos de cada coluna, sem vazar senhaHash e assinando o avatar", async () => {
    usuarioService.assinarUrlAvatar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");
    service.listarKanban.mockResolvedValue([
      { status: { id: "status-1" }, total: 1, casos: [{ id: "caso-1", responsavel: RESPONSAVEL_COM_HASH }] },
    ]);

    const res = await request(await subir()).get("/api/casos/kanban").expect(200);

    expect(JSON.stringify(res.body)).not.toContain("hash-nunca-deveria-sair");
    expect(res.body.colunas[0].casos[0].responsavel.usuario.avatarUrl).toBe(
      "https://bucket.s3.amazonaws.com/signed-get"
    );
  });

  it("repassa statusId da query — o kanban oculta colunas não selecionadas", async () => {
    service.listarKanban.mockResolvedValue([]);

    await request(await subir()).get("/api/casos/kanban?statusId=algum-id").expect(200, { colunas: [] });
    expect(service.listarKanban.mock.calls[0][1]).toEqual(expect.objectContaining({ statusIds: ["algum-id"] }));
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/casos/kanban").expect(401);
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.listarKanban.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir())
      .get("/api/casos/kanban")
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("GET /api/casos/:id", () => {
  it("devolve o caso", async () => {
    service.obter.mockResolvedValue({ id: "caso-1", responsavel: null });

    await request(await subir()).get("/api/casos/caso-1").expect(200, { caso: { id: "caso-1", responsavel: null } });
    expect(service.obter).toHaveBeenCalledWith(CTX_OWNER, "caso-1");
  });

  it("responde 404 quando o caso não é do tenant", async () => {
    service.obter.mockRejectedValue(new CasoNaoEncontradoError());

    await request(await subir()).get("/api/casos/caso-1").expect(404, { error: "Processo não encontrado." });
  });

  it("não vaza o senhaHash do responsável e assina o avatar", async () => {
    usuarioService.assinarUrlAvatar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");
    service.obter.mockResolvedValue({ id: "caso-1", responsavel: RESPONSAVEL_COM_HASH });

    const res = await request(await subir()).get("/api/casos/caso-1").expect(200);

    expect(JSON.stringify(res.body)).not.toContain("hash-nunca-deveria-sair");
    expect(res.body.caso.responsavel.usuario.avatarUrl).toBe("https://bucket.s3.amazonaws.com/signed-get");
  });
});

describe("PATCH /api/casos/:id", () => {
  it("atualiza o caso (inclusive troca de status via drag-and-drop)", async () => {
    service.atualizar.mockResolvedValue({ id: "caso-1", responsavel: null });

    await request(await subir()).patch("/api/casos/caso-1").send({ statusId: STATUS_ID }).expect(200);
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "caso-1", { statusId: STATUS_ID });
  });

  // A UI repinta o sheet e a tabela com o retorno do PATCH: precisa das relações.
  it("responde o caso com as relações serializadas, não o registro cru", async () => {
    service.atualizar.mockResolvedValue({
      id: "caso-1",
      tipoProcessoId: "tipo-processo-1",
      cliente: { id: "cli-1", nome: "Maria" },
      status: { id: "status-1", nome: "Em análise" },
      tipoProcesso: { id: "tipo-processo-1", nome: "Ação de cobrança" },
      responsavel: null,
    });

    const res = await request(await subir())
      .patch("/api/casos/caso-1")
      .send({ descricao: "Nova descrição" })
      .expect(200);

    expect(res.body.caso.tipoProcesso).toEqual({ id: "tipo-processo-1", nome: "Ação de cobrança" });
    expect(res.body.caso.cliente).toBeDefined();
    expect(res.body.caso.status).toBeDefined();
  });

  it("responde 400 para payload inválido", async () => {
    await request(await subir()).patch("/api/casos/caso-1").send({ tipoProcessoId: "nao-e-uuid" }).expect(400);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("responde 400 quando o responsável é inválido", async () => {
    service.atualizar.mockRejectedValue(new ResponsavelInvalidoError());

    await request(await subir())
      .patch("/api/casos/caso-1")
      .send({ responsavelMembroId: "33333333-3333-4333-8333-333333333333" })
      .expect(400, { error: "Responsável inválido para este escritório." });
  });

  it("responde 404 quando o caso não é do tenant", async () => {
    service.atualizar.mockRejectedValue(new CasoNaoEncontradoError());

    await request(await subir()).patch("/api/casos/caso-1").send({ descricao: "x" }).expect(404);
  });
});

describe("DELETE /api/casos/:id", () => {
  it("arquiva (soft) e responde 200 com o caso serializado (RN08)", async () => {
    service.arquivar.mockResolvedValue({
      id: "caso-1",
      arquivado: true,
      tipoProcesso: { id: "tipo-processo-1", nome: "Ação de cobrança" },
      responsavel: null,
    });

    const res = await request(await subir()).delete("/api/casos/caso-1").expect(200);

    expect(res.body.caso.tipoProcesso.nome).toBe("Ação de cobrança");
    expect(service.arquivar).toHaveBeenCalledWith(CTX_OWNER, "caso-1");
  });

  it("responde 404 quando o caso não é do tenant", async () => {
    service.arquivar.mockRejectedValue(new CasoNaoEncontradoError());

    await request(await subir()).delete("/api/casos/caso-1").expect(404);
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).delete("/api/casos/caso-1").expect(401);
    expect(service.arquivar).not.toHaveBeenCalled();
  });
});

describe("GET /api/casos/:id/documentos/download-todos", () => {
  it("devolve um stream zip com o tipo de processo no filename", async () => {
    service.obter.mockResolvedValue({ id: "caso-1", tipoProcesso: { nome: "Ação de Cobrança" } });
    documentos.listarPorEscopo.mockResolvedValue([{ id: "doc-1" }]);
    montarZip.mockReturnValue(Readable.from([Buffer.from("PK\x03\x04")]));

    const res = await request(await subir())
      .get("/api/casos/caso-1/documentos/download-todos")
      .responseType("blob")
      .expect(200);

    expect(res.headers["content-type"]).toBe("application/zip");
    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="documentos-caso-Ação de Cobrança.zip"'
    );
    expect(documentos.listarPorEscopo).toHaveBeenCalledWith(CTX_OWNER, "caso", "caso-1");
  });

  it("mapeia CasoNaoEncontradoError para 404", async () => {
    service.obter.mockRejectedValue(new CasoNaoEncontradoError());

    await request(await subir()).get("/api/casos/caso-alheio/documentos/download-todos").expect(404);
    expect(montarZip).not.toHaveBeenCalled();
  });

  it("responde 502 em erro inesperado antes do stream", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.obter.mockResolvedValue({ id: "caso-1", tipoProcesso: { nome: "X" } });
    documentos.listarPorEscopo.mockRejectedValue(new Error("timeout"));

    await request(await subir())
      .get("/api/casos/caso-1/documentos/download-todos")
      .expect(502, { error: "Não foi possível gerar o arquivo zip." });
  });

  it("registra listener de erro no stream do zip", async () => {
    service.obter.mockResolvedValue({ id: "caso-1", tipoProcesso: { nome: "X" } });
    documentos.listarPorEscopo.mockResolvedValue([]);
    const zip = Readable.from([Buffer.from("PK\x03\x04")]);
    const espiaOn = jest.spyOn(zip, "on");
    montarZip.mockReturnValue(zip);

    await request(await subir()).get("/api/casos/caso-1/documentos/download-todos").expect(200);
    expect(espiaOn).toHaveBeenCalledWith("error", expect.any(Function));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/api/payloads/casos-filtros.test.ts`
Expected: PASS (teste de caracterização do código que já existe).

Run: `npm run api:test -- casos`
Expected: FAIL — `Cannot find module './casos.module'`.

- [ ] **Step 3: Implementar**

`apps/api/src/casos/tokens.ts`:

```ts
import type { montarListaCasos } from "@/lib/api/payloads/casos-lista";
import type { montarOpcoesFiltroCaso } from "@/lib/api/payloads/casos-filtros";

export const CASO_SERVICE = Symbol("CASO_SERVICE");

// Montadores de payload compartilhados com o prefetch dos Server Components do Next:
// a rota e o prefetch precisam produzir o mesmo DTO. Entram por token para o teste de
// controller trocá-los sem mockar o casoService que eles usam por dentro.
export const PAYLOADS_CASO = Symbol("PAYLOADS_CASO");

export interface PayloadsCaso {
  montarListaCasos: typeof montarListaCasos;
  montarOpcoesFiltroCaso: typeof montarOpcoesFiltroCaso;
}
```

`apps/api/src/casos/casos.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response as ExpressResponse } from "express";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { paginaDaQuery, searchParamsDaRequisicao } from "../comum/query";
import { erroAoGerarZip, responderZip } from "../comum/resposta-zip";
import { DOCUMENTO_SERVICE, ZIP_DOCUMENTOS } from "../comum/tokens-documentos";
import { CASO_SERVICE, PAYLOADS_CASO, type PayloadsCaso } from "./tokens";
import { novoCasoSchema, edicaoCasoSchema, parseFiltrosCasoDaQuery } from "@/lib/api/schemas-caso";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { serializarCaso, serializarCasos } from "@/lib/api/serializa-caso";
import type { casoService, DadosNovoCaso, DadosEdicaoCaso } from "@/services/caso.service";
import type { documentoService } from "@/services/documento.service";
import type { montarZipDocumentos } from "@/lib/documentos/zip";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Processos do escritório (RN06–RN09). Toda resposta com caso passa por serializarCaso
// (tira o senhaHash do responsável e assina o avatar), exceto o POST, que devolve o
// registro criado cru — o mesmo contrato da rota Next.
//
// Ordem dos métodos importa: "filtros" e "kanban" vêm antes de ":id", porque o Express
// casa as rotas na ordem de registro.
@Controller("casos")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeCaso]))
export class CasosController {
  constructor(
    @Inject(CASO_SERVICE) private readonly service: typeof casoService,
    @Inject(PAYLOADS_CASO) private readonly payloads: PayloadsCaso,
    @Inject(DOCUMENTO_SERVICE)
    private readonly documentos: Pick<typeof documentoService, "listarPorEscopo">,
    @Inject(ZIP_DOCUMENTOS) private readonly montarZip: typeof montarZipDocumentos
  ) {}

  // Payload único com as opções dos dropdowns de filtro (clientes, membros, status,
  // tipos de status e tipos de processo).
  @Get("filtros")
  filtros(@Tenant() ctx: TenantContext) {
    return this.payloads.montarOpcoesFiltroCaso(ctx);
  }

  @Get("kanban")
  async kanban(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const filtros = parseFiltrosCasoDaQuery(searchParamsDaRequisicao(req));
    const colunas = await this.service.listarKanban(ctx, filtros);
    return {
      colunas: await Promise.all(
        colunas.map(async (coluna) => ({ ...coluna, casos: await serializarCasos(coluna.casos) }))
      ),
    };
  }

  @Get()
  listar(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const params = searchParamsDaRequisicao(req);
    return this.payloads.montarListaCasos(ctx, parseFiltrosCasoDaQuery(params), paginaDaQuery(params));
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novoCasoSchema)) dados: DadosNovoCaso
  ) {
    return { caso: await this.service.criar(ctx, dados) };
  }

  @Get(":id")
  async obter(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    return { caso: await serializarCaso(await this.service.obter(ctx, id)) };
  }

  @Patch(":id")
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(edicaoCasoSchema)) dados: DadosEdicaoCaso
  ) {
    return { caso: await serializarCaso(await this.service.atualizar(ctx, id, dados)) };
  }

  // Não é exclusão: caso nunca é apagado, só arquivado (RN08/RN09). DELETE é a semântica
  // REST que o client usa para "remover da visão ativa".
  @Delete(":id")
  @HttpCode(200)
  async arquivar(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    return { caso: await serializarCaso(await this.service.arquivar(ctx, id)) };
  }

  @Get(":id/documentos/download-todos")
  @UseFilters(new ErrosHttpFilter([tratarErroDeCaso, erroAoGerarZip]))
  async baixarTodos(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Res() res: ExpressResponse
  ) {
    const caso = await this.service.obter(ctx, id);
    const documentos = await this.documentos.listarPorEscopo(ctx, "caso", id);
    responderZip(res, this.montarZip(documentos), `documentos-caso-${caso.tipoProcesso.nome}.zip`);
  }
}
```

`apps/api/src/casos/casos.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { CasosController } from "./casos.controller";
import { CASO_SERVICE, PAYLOADS_CASO, type PayloadsCaso } from "./tokens";
import { DOCUMENTO_SERVICE, ZIP_DOCUMENTOS } from "../comum/tokens-documentos";
import { casoService } from "@/services/caso.service";
import { documentoService } from "@/services/documento.service";
import { montarZipDocumentos } from "@/lib/documentos/zip";
import { montarListaCasos } from "@/lib/api/payloads/casos-lista";
import { montarOpcoesFiltroCaso } from "@/lib/api/payloads/casos-filtros";

const payloads: PayloadsCaso = { montarListaCasos, montarOpcoesFiltroCaso };

@Module({
  controllers: [CasosController],
  providers: [
    { provide: CASO_SERVICE, useValue: casoService },
    { provide: PAYLOADS_CASO, useValue: payloads },
    { provide: DOCUMENTO_SERVICE, useValue: documentoService },
    { provide: ZIP_DOCUMENTOS, useValue: montarZipDocumentos },
  ],
})
export class CasosModule {}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run api:test -- casos && npm run api:typecheck`
Expected: PASS em `casos.controller.test.ts`; typecheck sem erros. Se o typecheck reclamar que `{ id: "caso-1", ... }` não é `CasoComRelacoes`, o problema está só nos mocks (eles são `jest.fn()` sem tipo, então não deveria acontecer); o controller usa os tipos reais do service.

- [ ] **Step 5: Registrar o módulo e encaminhar o prefixo**

`apps/api/src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { SaudeController } from "./saude/saude.controller";
import { TenantModule } from "./comum/tenant/tenant.module";
import { StatusModule } from "./status/status.module";
import { TiposProcessoModule } from "./tipos-processo/tipos-processo.module";
import { ClientesModule } from "./clientes/clientes.module";
import { CasosModule } from "./casos/casos.module";

@Module({
  imports: [TenantModule, StatusModule, TiposProcessoModule, ClientesModule, CasosModule],
  controllers: [SaudeController],
})
export class AppModule {}
```

Em `next.config.ts`:

```ts
const ROTAS_NA_API_NEST = ["status", "tipos-status", "tipos-processo", "clientes", "casos"];
```

Verificação manual, com `npm run api:dev` e `npm run dev` de pé:
1. **Dashboard/kanban**: filtrar por status, tipo de processo, responsável e "sem responsável"; arrastar um card de coluna (PATCH `statusId`); rolar até a paginação carregar a próxima página (`GET /api/casos?pagina=2`).
2. **Tabela de processos**: buscar e alternar "arquivados".
3. Abrir um processo, editar o responsável, arquivar e clicar em **Baixar todos** os documentos do processo.

Expected: os avatares dos responsáveis aparecem (URL assinada), o zip baixa como `documentos-caso-<tipo>.zip`, e o terminal da API não mostra nenhum `[api] erro em ...`.

- [ ] **Step 6: Remover as rotas Next substituídas**

```bash
git rm -r src/app/api/casos
grep -rn "app/api/casos" src
```
Expected do grep: nenhuma saída. `src/app/(dashboard)/page.tsx` continua importando `montarListaCasos`/`montarOpcoesFiltroCaso` de `src/lib/api/payloads`, que não mudam.

- [ ] **Step 7: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS, incluindo o novo `src/lib/api/payloads/casos-filtros.test.ts` e os testes de componente que mockam `fetch` para `/api/casos*`, que continuam iguais.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/casos apps/api/src/app.module.ts src/lib/api/payloads/casos-filtros.test.ts next.config.ts
git commit -m "feat(api): módulo casos no NestJS com kanban, filtros e download de documentos"
```

---

### Task 2.5: Módulo `comentarios`

Contrato a reproduzir (`src/app/api/comentarios/**`):

| Rota | Sucesso | Erros |
|---|---|---|
| `GET /api/comentarios?escopo=cliente\|caso&escopoId=<uuid>` | 200 `{ comentarios }`, com `autor.avatarUrl` **assinado** | 400 query inválida (com `detalhes`), 404 alvo de outro tenant (cliente/caso) ou comentário |
| `POST /api/comentarios` | 201 `{ comentario }` | 400 zod/conteúdo vazio, 404 alvo de outro tenant (RN21) |
| `PATCH /api/comentarios/:id` | 200 `{ comentario }` | 400, 403 não é o autor, 404 |
| `DELETE /api/comentarios/:id` | 200 `{ ok: true }` (soft delete) | 403 sem permissão de moderar, 404 |

Regras de handler reproduzidas: validação da query (`escopo` enum + `escopoId` uuid) e assinatura do avatar de cada autor via `usuarioService.assinarUrlAvatar`. Os schemas, hoje inline nas rotas, passam para `src/lib/api/schemas-comentario.ts`.

**Files:**
- Create: `src/lib/api/schemas-comentario.ts`, `apps/api/src/comentarios/tokens.ts`, `apps/api/src/comentarios/comentarios.controller.ts`, `apps/api/src/comentarios/comentarios.module.ts`
- Test: `src/lib/api/schemas-comentario.test.ts`, `apps/api/src/comentarios/comentarios.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/comentarios/route.ts`, `src/app/api/comentarios/route.test.ts`, `src/app/api/comentarios/[id]/route.ts`, `src/app/api/comentarios/[id]/route.test.ts`

**Interfaces:**
- Consumes: Fase 1 (`criarAppDeTeste`, `CTX_OWNER`, `TenantGuard`, `Tenant`, `ErrosHttpFilter`, `ValidacaoZodPipe`, `DadosInvalidosError`); Task 2.1 (`searchParamsDaRequisicao`); `comentarioService.{listar(ctx, escopo, escopoId), criar(ctx, escopo, escopoId, conteudo), atualizar(ctx, id, conteudo), excluir(ctx, id)}` e erros `ComentarioNaoEncontradoError`, `PermissaoComentarioError`, `ConteudoVazioError` de `@/services/comentario.service`; `usuarioService.assinarUrlAvatar(storageKey: string | null): Promise<string | null>`; `tratarErroDeCliente`, `tratarErroDeCaso`, `tratarErroDeComentario`.
- Produces: `escopoComentarioSchema`, `filtroComentariosSchema`, `novoComentarioSchema`, `edicaoComentarioSchema`, `type NovoComentario`, `type EdicaoComentario` (em `@/lib/api/schemas-comentario`); `COMENTARIO_SERVICE`, `USUARIO_SERVICE` (symbols, em `apps/api/src/comentarios/tokens.ts`); `ComentariosModule`.

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/api/schemas-comentario.test.ts`:

```ts
import {
  filtroComentariosSchema,
  novoComentarioSchema,
  edicaoComentarioSchema,
} from "./schemas-comentario";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("schemas de comentário", () => {
  it("aceita escopo cliente/caso com uuid", () => {
    expect(filtroComentariosSchema.safeParse({ escopo: "caso", escopoId: UUID }).success).toBe(true);
  });

  it("recusa escopo desconhecido e escopoId ausente (null vindo da query)", () => {
    expect(filtroComentariosSchema.safeParse({ escopo: "processo", escopoId: UUID }).success).toBe(false);
    expect(filtroComentariosSchema.safeParse({ escopo: "cliente", escopoId: null }).success).toBe(false);
  });

  it("apara o conteúdo e recusa comentário só com espaços", () => {
    expect(novoComentarioSchema.parse({ escopo: "cliente", escopoId: UUID, conteudo: "  oi  " }).conteudo).toBe("oi");
    const vazio = novoComentarioSchema.safeParse({ escopo: "cliente", escopoId: UUID, conteudo: "   " });
    expect(vazio.success).toBe(false);
    expect(vazio.error?.flatten().fieldErrors.conteudo).toEqual(["Escreva algo antes de comentar."]);
  });

  it("limita o conteúdo a 5000 caracteres na edição", () => {
    expect(edicaoComentarioSchema.safeParse({ conteudo: "a".repeat(5001) }).success).toBe(false);
    expect(edicaoComentarioSchema.safeParse({ conteudo: "  " }).error?.flatten().fieldErrors.conteudo).toEqual([
      "Escreva algo antes de salvar.",
    ]);
  });
});
```

`apps/api/src/comentarios/comentarios.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { ComentariosModule } from "./comentarios.module";
import { COMENTARIO_SERVICE, USUARIO_SERVICE } from "./tokens";
import {
  ComentarioNaoEncontradoError,
  PermissaoComentarioError,
} from "@/services/comentario.service";
import { ClienteNaoEncontradoError } from "@/services/cliente.service";
import { CasoNaoEncontradoError } from "@/services/caso.service";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const CLIENTE_ID = "11111111-1111-4111-8111-111111111111";
const QUERY = `escopo=cliente&escopoId=${CLIENTE_ID}`;

const service = { listar: jest.fn(), criar: jest.fn(), atualizar: jest.fn(), excluir: jest.fn() };
const usuarios = { assinarUrlAvatar: jest.fn() };

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [ComentariosModule],
    ctx,
    overrides: [
      [COMENTARIO_SERVICE, service],
      [USUARIO_SERVICE, usuarios],
    ],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  await app?.close();
});

describe("GET /api/comentarios", () => {
  it("lista os comentários do escopo pedido", async () => {
    service.listar.mockResolvedValue([]);

    await request(await subir()).get(`/api/comentarios?${QUERY}`).expect(200, { comentarios: [] });
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER, "cliente", CLIENTE_ID);
  });

  it("assina o avatarUrl do autor de cada comentário", async () => {
    usuarios.assinarUrlAvatar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");
    service.listar.mockResolvedValue([
      {
        id: "com-1",
        conteudo: "Olá",
        autor: { id: "user-1", nome: "Fulano", email: "fulano@teste.com", avatarUrl: "development/avatares/user-1/foto.png" },
      },
    ]);

    const res = await request(await subir()).get(`/api/comentarios?${QUERY}`).expect(200);

    expect(usuarios.assinarUrlAvatar).toHaveBeenCalledWith("development/avatares/user-1/foto.png");
    expect(res.body.comentarios[0]).toEqual({
      id: "com-1",
      conteudo: "Olá",
      autor: {
        id: "user-1",
        nome: "Fulano",
        email: "fulano@teste.com",
        avatarUrl: "https://bucket.s3.amazonaws.com/signed-get",
      },
    });
  });

  it("recusa escopo desconhecido com 400 e detalhes", async () => {
    const res = await request(await subir())
      .get(`/api/comentarios?escopo=processo&escopoId=${CLIENTE_ID}`)
      .expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(res.body.detalhes.escopo).toBeDefined();
    expect(service.listar).not.toHaveBeenCalled();
  });

  it("recusa requisição sem escopoId", async () => {
    const res = await request(await subir()).get("/api/comentarios?escopo=cliente").expect(400);
    expect(res.body.detalhes.escopoId).toBeDefined();
  });

  // O alvo é validado pelo service contra o tenant (RN21); a rota traduz para 404.
  it("responde 404 quando o cliente alvo não é do escritório", async () => {
    service.listar.mockRejectedValue(new ClienteNaoEncontradoError());

    await request(await subir()).get(`/api/comentarios?${QUERY}`).expect(404, { error: "Cliente não encontrado." });
  });

  it("responde 404 quando o caso alvo não é do escritório", async () => {
    service.listar.mockRejectedValue(new CasoNaoEncontradoError());

    await request(await subir())
      .get(`/api/comentarios?escopo=caso&escopoId=${CLIENTE_ID}`)
      .expect(404, { error: "Processo não encontrado." });
  });

  it("responde 404 quando o service não encontra o comentário", async () => {
    service.listar.mockRejectedValue(new ComentarioNaoEncontradoError());

    await request(await subir()).get(`/api/comentarios?${QUERY}`).expect(404);
  });

  it("responde 401 sem sessão e não valida a query antes do tenant", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/comentarios").expect(401);
  });
});

describe("POST /api/comentarios", () => {
  it("responde 400 quando o body não é JSON", async () => {
    await request(await subir())
      .post("/api/comentarios")
      .set("content-type", "application/json")
      .send("nao-e-json")
      .expect(400, { error: "Dados inválidos" });
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 404 quando o cliente alvo não é do escritório", async () => {
    service.criar.mockRejectedValue(new ClienteNaoEncontradoError());

    await request(await subir())
      .post("/api/comentarios")
      .send({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "oi" })
      .expect(404);
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.criar.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir())
      .post("/api/comentarios")
      .send({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "oi" })
      .expect(500, { error: "Não foi possível concluir a operação." });
  });

  it("cria o comentário (conteúdo aparado) e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "com-1" });

    await request(await subir())
      .post("/api/comentarios")
      .send({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "  Primeiro contato feito.  " })
      .expect(201, { comentario: { id: "com-1" } });
    expect(service.criar).toHaveBeenCalledWith(CTX_OWNER, "cliente", CLIENTE_ID, "Primeiro contato feito.");
  });

  it("recusa comentário vazio", async () => {
    await request(await subir())
      .post("/api/comentarios")
      .send({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "   " })
      .expect(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .post("/api/comentarios")
      .send({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "oi" })
      .expect(401);
  });
});

describe("PATCH /api/comentarios/:id", () => {
  it("edita o conteúdo", async () => {
    service.atualizar.mockResolvedValue({ id: "com-1" });

    await request(await subir())
      .patch("/api/comentarios/com-1")
      .send({ conteudo: "Texto novo" })
      .expect(200, { comentario: { id: "com-1" } });
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "com-1", "Texto novo");
  });

  it("recusa conteúdo vazio", async () => {
    await request(await subir()).patch("/api/comentarios/com-1").send({ conteudo: "  " }).expect(400);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("responde 403 quando quem edita não é o autor (RN21)", async () => {
    service.atualizar.mockRejectedValue(new PermissaoComentarioError());

    await request(await subir()).patch("/api/comentarios/com-1").send({ conteudo: "Texto novo" }).expect(403, {
      error: "Você não tem permissão para alterar este comentário.",
    });
  });

  it("responde 404 para comentário de outro escritório", async () => {
    service.atualizar.mockRejectedValue(new ComentarioNaoEncontradoError());

    await request(await subir()).patch("/api/comentarios/com-1").send({ conteudo: "Texto novo" }).expect(404, {
      error: "Comentário não encontrado.",
    });
  });
});

describe("DELETE /api/comentarios/:id", () => {
  it("exclui (soft) o comentário", async () => {
    service.excluir.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/comentarios/com-1").expect(200, { ok: true });
    expect(service.excluir).toHaveBeenCalledWith(CTX_OWNER, "com-1");
  });

  it("responde 403 quando não há permissão de moderar", async () => {
    service.excluir.mockRejectedValue(new PermissaoComentarioError());

    await request(await subir()).delete("/api/comentarios/com-1").expect(403);
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).delete("/api/comentarios/com-1").expect(401);
    expect(service.excluir).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/api/schemas-comentario.test.ts`
Expected: FAIL — `Cannot find module './schemas-comentario'`.

Run: `npm run api:test -- comentarios`
Expected: FAIL — `Cannot find module './comentarios.module'`.

- [ ] **Step 3: Extrair os schemas para o domínio**

`src/lib/api/schemas-comentario.ts` (os mesmos schemas que hoje são inline em `src/app/api/comentarios/route.ts` e `[id]/route.ts`):

```ts
import { z } from "zod";

// Comentários ancorados por escopo + escopoId (RN21). Hoje só cliente e caso.
export const escopoComentarioSchema = z.enum(["cliente", "caso"]);

// Query de GET /api/comentarios. Os valores vêm de URLSearchParams.get(), então
// parâmetro ausente chega como null e é recusado aqui.
export const filtroComentariosSchema = z.object({
  escopo: escopoComentarioSchema,
  escopoId: z.uuid(),
});

export const novoComentarioSchema = z.object({
  escopo: escopoComentarioSchema,
  escopoId: z.uuid(),
  conteudo: z.string().trim().min(1, "Escreva algo antes de comentar.").max(5000),
});

export const edicaoComentarioSchema = z.object({
  conteudo: z.string().trim().min(1, "Escreva algo antes de salvar.").max(5000),
});

export type NovoComentario = z.infer<typeof novoComentarioSchema>;
export type EdicaoComentario = z.infer<typeof edicaoComentarioSchema>;
```

Run: `npx jest src/lib/api/schemas-comentario.test.ts`
Expected: PASS.

- [ ] **Step 4: Implementar o módulo**

`apps/api/src/comentarios/tokens.ts`:

```ts
export const COMENTARIO_SERVICE = Symbol("COMENTARIO_SERVICE");
// Só para assinar o avatar do autor na listagem.
export const USUARIO_SERVICE = Symbol("USUARIO_SERVICE");
```

`apps/api/src/comentarios/comentarios.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { DadosInvalidosError, ValidacaoZodPipe } from "../comum/validacao.pipe";
import { searchParamsDaRequisicao } from "../comum/query";
import { COMENTARIO_SERVICE, USUARIO_SERVICE } from "./tokens";
import {
  filtroComentariosSchema,
  novoComentarioSchema,
  edicaoComentarioSchema,
  type NovoComentario,
  type EdicaoComentario,
} from "@/lib/api/schemas-comentario";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { tratarErroDeComentario } from "@/lib/api/erros-comentario";
import type { comentarioService } from "@/services/comentario.service";
import type { usuarioService } from "@/services/usuario.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Comentários de cliente e caso (RN21). O service valida o alvo contra o tenant e lança
// ClienteNaoEncontradoError/CasoNaoEncontradoError (404) quando o alvo é de outro
// escritório, por isso os tradutores de cliente e caso também entram aqui.
@Controller("comentarios")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeCliente, tratarErroDeCaso, tratarErroDeComentario]))
export class ComentariosController {
  constructor(
    @Inject(COMENTARIO_SERVICE) private readonly service: typeof comentarioService,
    @Inject(USUARIO_SERVICE)
    private readonly usuarios: Pick<typeof usuarioService, "assinarUrlAvatar">
  ) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const params = searchParamsDaRequisicao(req);
    const parsed = filtroComentariosSchema.safeParse({
      escopo: params.get("escopo"),
      escopoId: params.get("escopoId"),
    });
    if (!parsed.success) throw new DadosInvalidosError(parsed.error);

    const comentarios = await this.service.listar(ctx, parsed.data.escopo, parsed.data.escopoId);
    return {
      comentarios: await Promise.all(
        comentarios.map(async (comentario) => ({
          ...comentario,
          autor: {
            ...comentario.autor,
            avatarUrl: await this.usuarios.assinarUrlAvatar(comentario.autor.avatarUrl),
          },
        }))
      ),
    };
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novoComentarioSchema)) { escopo, escopoId, conteudo }: NovoComentario
  ) {
    return { comentario: await this.service.criar(ctx, escopo, escopoId, conteudo) };
  }

  @Patch(":id")
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(edicaoComentarioSchema)) { conteudo }: EdicaoComentario
  ) {
    return { comentario: await this.service.atualizar(ctx, id, conteudo) };
  }

  // Soft delete; cabe ao autor, owner ou admin (regra no service → 403).
  @Delete(":id")
  @HttpCode(200)
  async excluir(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.excluir(ctx, id);
    return { ok: true };
  }
}
```

`apps/api/src/comentarios/comentarios.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { ComentariosController } from "./comentarios.controller";
import { COMENTARIO_SERVICE, USUARIO_SERVICE } from "./tokens";
import { comentarioService } from "@/services/comentario.service";
import { usuarioService } from "@/services/usuario.service";

@Module({
  controllers: [ComentariosController],
  providers: [
    { provide: COMENTARIO_SERVICE, useValue: comentarioService },
    { provide: USUARIO_SERVICE, useValue: usuarioService },
  ],
})
export class ComentariosModule {}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm run api:test -- comentarios && npm run api:typecheck`
Expected: PASS; typecheck sem erros. O tipo de `escopo` (`"cliente" | "caso"`) é compatível com o `EscopoComentario` do Prisma que o service recebe.

- [ ] **Step 6: Registrar o módulo, encaminhar o prefixo e remover as rotas Next**

`apps/api/src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { SaudeController } from "./saude/saude.controller";
import { TenantModule } from "./comum/tenant/tenant.module";
import { StatusModule } from "./status/status.module";
import { TiposProcessoModule } from "./tipos-processo/tipos-processo.module";
import { ClientesModule } from "./clientes/clientes.module";
import { CasosModule } from "./casos/casos.module";
import { ComentariosModule } from "./comentarios/comentarios.module";

@Module({
  imports: [
    TenantModule,
    StatusModule,
    TiposProcessoModule,
    ClientesModule,
    CasosModule,
    ComentariosModule,
  ],
  controllers: [SaudeController],
})
export class AppModule {}
```

Em `next.config.ts`:

```ts
const ROTAS_NA_API_NEST = [
  "status",
  "tipos-status",
  "tipos-processo",
  "clientes",
  "casos",
  "comentarios",
];
```

Verificação manual, com API e Next de pé: abrir um cliente e um processo, comentar, editar o próprio comentário e excluí-lo. Logado como `padrao`, tentar editar o comentário de outro membro deve mostrar o erro 403.
Expected: avatares dos autores carregam e o terminal da API não mostra nenhum `[api] erro em ...`.

```bash
git rm -r src/app/api/comentarios
grep -rn "app/api/comentarios" src
```
Expected do grep: nenhuma saída.

- [ ] **Step 7: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS.

Run (com API e Next de pé): `npm run e2e`
Expected: PASS nos specs de clientes, casos/kanban e comentários. Este é o fechamento da parte A.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/comentarios apps/api/src/app.module.ts src/lib/api/schemas-comentario.ts src/lib/api/schemas-comentario.test.ts next.config.ts
git commit -m "feat(api): módulo comentarios no NestJS e schemas de comentário no domínio"
```

---

## Fase 2 — Demais módulos da API (parte B)

Esta parte porta para o Nest os grupos de rota de **usuário e equipe** (`perfil`, `escritorios/atual`, `membros`, `convites`), o **dashboard** e os módulos de **agenda** (`eventos`) e **documentos**. Antes deles, a Task 2.20 cria a "sessão de usuário sem tenant" (`UsuarioGuard` + `@UsuarioId()`), necessária porque as rotas de perfil exigem login mas **não** escritório ativo (onboarding). Tudo segue as convenções da Fase 1: services do domínio entram por token (`useValue` + `@Inject`), `TenantGuard`/`@Tenant()` em toda rota de tenant, `ErrosHttpFilter([tradutores])` por controller (ou por método quando o código de fallback muda), `ValidacaoZodPipe(schema)` no corpo, testes com `criarAppDeTeste` + supertest. Ao final de cada task o módulo entra no `AppModule`, os prefixos vão para `ROTAS_NA_API_NEST` e as rotas Next substituídas são removidas.

**Fora desta parte (vão para a Fase 3):** `POST /api/escritorios` (raiz) chama `unstable_update()` do NextAuth para trocar o escritório ativo no cookie de sessão — só pode sair do Next quando a sessão for do Nest. Por isso esta parte migra **só** `escritorios/atual` e o rewrite usa o prefixo `"escritorios/atual"` (não `"escritorios"`). Nenhuma rota de `perfil` usa `unstable_update` (todas só leem a sessão com `auth()`), então o grupo inteiro migra aqui.

**Diferenças de contrato conscientes (herdadas das decisões da Fase 1):**
- Erro inesperado (500) responde `{ error: "Não foi possível concluir a operação." }` em vez da mensagem por rota. Rotas cujo fallback hoje é **502** (falha do storage S3) mantêm o 502 e a mensagem original via o tradutor `falhaExterna(mensagem)` criado na Task 2.21.
- JSON malformado sem sessão: o body parser do Express roda antes do guard, então responde 400 em vez de 401 (mesmo comportamento já aceito na Fase 1).
- Rotas que usavam `auth()` reemitiam o cookie de sessão ("rolling refresh"). As versões Nest só leem o cookie; a renovação continua acontecendo nas páginas do Next que chamam `auth()`. Some na Fase 3, quando a sessão passa a ser do Nest.

**Helpers novos compartilhados nesta parte** (criados uma vez, reaproveitados nas tasks seguintes):
- `apps/api/src/comum/falha-externa.ts` → `falhaExterna(mensagem: string): TradutorDeErro` (Task 2.21).
- `apps/api/src/comum/query.ts` → `searchParamsDaRequisicao(req: Request): URLSearchParams` (criado na Task 2.1; reutilizado nas Tasks 2.25–2.27).

Se a parte A (Tasks 2.1–2.19) já tiver criado um desses arquivos com o mesmo nome e a mesma assinatura, pule o passo de criação e reaproveite-o.

---

### Task 2.20: Sessão de usuário sem tenant (`UsuarioGuard`)

Rotas do usuário (perfil) hoje chamam `auth()`/`lerUsuarioIdDaSessao()` em vez de `getTenantContext()`: exigem sessão, mas o usuário pode não ter escritório ativo. Esta task cria o equivalente Nest. A Fase 3 troca a **implementação** de `resolverUsuarioDaRequisicao` (cookie próprio do Nest) sem mudar nenhum nome.

**Files:**
- Modify: `apps/api/src/comum/tenant/ler-sessao.ts`, `apps/api/src/comum/tenant/tenant.module.ts`, `apps/api/test/utils.ts`
- Create: `apps/api/src/comum/tenant/usuario.guard.ts`, `apps/api/src/comum/tenant/usuario.decorator.ts`
- Test: `apps/api/src/comum/tenant/ler-sessao-usuario.test.ts`, `apps/api/src/comum/tenant/usuario.guard.test.ts`

**Interfaces:**
- Consumes: `lerTokenDaSessao`, `headersDaRequisicao` (Task 1.4); `NaoAutenticadoError` de `@/lib/auth/resolver-tenant`.
- Produces:
  ```ts
  // apps/api/src/comum/tenant/ler-sessao.ts
  export const RESOLVEDOR_USUARIO: unique symbol;
  export type ResolvedorUsuario = (req: Request) => Promise<string>;
  export async function resolverUsuarioDaRequisicao(req: Request): Promise<string>; // lança NaoAutenticadoError sem token/sub
  // apps/api/src/comum/tenant/usuario.guard.ts
  export type RequestComUsuario = Request & { usuarioId?: string };
  export class UsuarioGuard implements CanActivate;            // grava req.usuarioId
  // apps/api/src/comum/tenant/usuario.decorator.ts
  export const UsuarioId: () => ParameterDecorator;           // lê req.usuarioId
  // TenantModule passa a prover/exportar RESOLVEDOR_USUARIO e UsuarioGuard
  // apps/api/test/utils.ts
  criarAppDeTeste(opcoes: { ...; usuarioId?: string | Error }) // padrão "user-1"
  ```

- [ ] **Step 1: Escrever os testes que falham**

`apps/api/src/comum/tenant/ler-sessao-usuario.test.ts`:

```ts
import type { Request } from "express";
import { resolverUsuarioDaRequisicao } from "./ler-sessao";
import { lerTokenDaSessao } from "@/lib/auth/token";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

jest.mock("@/lib/auth/token", () => ({ lerTokenDaSessao: jest.fn() }));

const lerToken = lerTokenDaSessao as jest.Mock;

function req(headers: Record<string, string>) {
  return { headers } as unknown as Request;
}

describe("resolverUsuarioDaRequisicao", () => {
  afterEach(() => jest.clearAllMocks());

  it("devolve o sub do JWT, lendo o cookie da requisição", async () => {
    lerToken.mockResolvedValue({ sub: "user-1", escritorioId: "esc-1" });

    await expect(resolverUsuarioDaRequisicao(req({ cookie: "authjs.session-token=abc" }))).resolves.toBe("user-1");

    const [{ headers }] = lerToken.mock.calls[0];
    expect((headers as Headers).get("cookie")).toBe("authjs.session-token=abc");
  });

  it("não exige escritório ativo (onboarding)", async () => {
    lerToken.mockResolvedValue({ sub: "user-1", escritorioId: null });

    await expect(resolverUsuarioDaRequisicao(req({}))).resolves.toBe("user-1");
  });

  it("lança NaoAutenticadoError sem token", async () => {
    lerToken.mockResolvedValue(null);

    await expect(resolverUsuarioDaRequisicao(req({}))).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança NaoAutenticadoError com token sem sub", async () => {
    lerToken.mockResolvedValue({ escritorioId: "esc-1" });

    await expect(resolverUsuarioDaRequisicao(req({}))).rejects.toThrow(NaoAutenticadoError);
  });
});
```

`apps/api/src/comum/tenant/usuario.guard.test.ts`:

```ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../../test/utils";
import { UsuarioGuard } from "./usuario.guard";
import { UsuarioId } from "./usuario.decorator";
import { NaoAutenticadoError, SemEscritorioAtivoError } from "@/lib/auth/resolver-tenant";

@Controller("eco-usuario")
@UseGuards(UsuarioGuard)
class EcoUsuarioController {
  @Get()
  eco(@UsuarioId() usuarioId: string) {
    return { usuarioId };
  }
}

describe("UsuarioGuard", () => {
  it("injeta o id do usuário padrão do app de teste", async () => {
    const app = await criarAppDeTeste({ controllers: [EcoUsuarioController] });
    await request(app.getHttpServer()).get("/api/eco-usuario").expect(200, { usuarioId: "user-1" });
    await app.close();
  });

  it("usa o usuarioId informado no app de teste", async () => {
    const app = await criarAppDeTeste({ controllers: [EcoUsuarioController], usuarioId: "user-9" });
    await request(app.getHttpServer()).get("/api/eco-usuario").expect(200, { usuarioId: "user-9" });
    await app.close();
  });

  it("não depende do tenant: funciona sem escritório ativo", async () => {
    const app = await criarAppDeTeste({
      controllers: [EcoUsuarioController],
      ctx: new SemEscritorioAtivoError(),
    });
    await request(app.getHttpServer()).get("/api/eco-usuario").expect(200, { usuarioId: "user-1" });
    await app.close();
  });

  it("responde 401 quando o resolver lança NaoAutenticadoError", async () => {
    const app = await criarAppDeTeste({
      controllers: [EcoUsuarioController],
      usuarioId: new NaoAutenticadoError(),
    });
    await request(app.getHttpServer())
      .get("/api/eco-usuario")
      .expect(401, { error: "Sessão inválida ou expirada." });
    await app.close();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- usuario`
Expected: FAIL — `resolverUsuarioDaRequisicao is not a function` e `Cannot find module './usuario.guard'`.

- [ ] **Step 3: Implementar o resolver de usuário**

Em `apps/api/src/comum/tenant/ler-sessao.ts`, trocar o import de `@/lib/auth/resolver-tenant` por:

```ts
import {
  NaoAutenticadoError,
  resolverTenantContext,
  type TenantContext,
} from "@/lib/auth/resolver-tenant";
```

e acrescentar ao final do arquivo:

```ts
export const RESOLVEDOR_USUARIO = Symbol("RESOLVEDOR_USUARIO");
export type ResolvedorUsuario = (req: Request) => Promise<string>;

// Rotas do usuário (perfil), não do tenant: exigem sessão, mas não escritório ativo — o
// usuário pode estar no onboarding, sem nenhum escritório. Equivale ao auth() /
// lerUsuarioIdDaSessao() das rotas Next. Fase 3: passa a ler o cookie próprio da API,
// mantendo nome e assinatura.
export async function resolverUsuarioDaRequisicao(req: Request): Promise<string> {
  const token = await lerTokenDaSessao({ headers: headersDaRequisicao(req) });
  if (!token?.sub) {
    throw new NaoAutenticadoError();
  }
  return token.sub;
}
```

- [ ] **Step 4: Implementar guard e decorator**

`apps/api/src/comum/tenant/usuario.guard.ts`:

```ts
import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { RESOLVEDOR_USUARIO, type ResolvedorUsuario } from "./ler-sessao";

export type RequestComUsuario = Request & { usuarioId?: string };

// Equivalente Nest do `auth()` nas rotas de perfil: só garante que há um usuário
// autenticado. Não resolve tenant — nunca use em rota que acessa dado de escritório
// (essas usam TenantGuard, RN19).
@Injectable()
export class UsuarioGuard implements CanActivate {
  constructor(@Inject(RESOLVEDOR_USUARIO) private readonly resolver: ResolvedorUsuario) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestComUsuario>();
    req.usuarioId = await this.resolver(req);
    return true;
  }
}
```

`apps/api/src/comum/tenant/usuario.decorator.ts`:

```ts
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestComUsuario } from "./usuario.guard";

// Só é válido em handlers protegidos por UsuarioGuard — sem ele, falha alto em vez de
// devolver undefined e deixar o service operar sobre "usuário nenhum".
export const UsuarioId = createParamDecorator((_dado: unknown, context: ExecutionContext): string => {
  const usuarioId = context.switchToHttp().getRequest<RequestComUsuario>().usuarioId;
  if (!usuarioId) {
    throw new Error("@UsuarioId() usado sem UsuarioGuard.");
  }
  return usuarioId;
});
```

Substituir `apps/api/src/comum/tenant/tenant.module.ts` por:

```ts
import { Global, Module } from "@nestjs/common";
import {
  RESOLVEDOR_TENANT,
  RESOLVEDOR_USUARIO,
  resolverTenantDaRequisicao,
  resolverUsuarioDaRequisicao,
} from "./ler-sessao";
import { TenantGuard } from "./tenant.guard";
import { UsuarioGuard } from "./usuario.guard";

@Global()
@Module({
  providers: [
    { provide: RESOLVEDOR_TENANT, useValue: resolverTenantDaRequisicao },
    { provide: RESOLVEDOR_USUARIO, useValue: resolverUsuarioDaRequisicao },
    TenantGuard,
    UsuarioGuard,
  ],
  exports: [RESOLVEDOR_TENANT, RESOLVEDOR_USUARIO, TenantGuard, UsuarioGuard],
})
export class TenantModule {}
```

- [ ] **Step 5: Estender `criarAppDeTeste`**

Em `apps/api/test/utils.ts` (preservando qualquer opção que a parte A tenha acrescentado):

1. Trocar o import de `ler-sessao` por:

```ts
import { RESOLVEDOR_TENANT, RESOLVEDOR_USUARIO } from "../src/comum/tenant/ler-sessao";
```

2. Em `interface OpcoesAppDeTeste`, acrescentar:

```ts
  // Usuário que o UsuarioGuard devolve, ou o erro que ele lança. Padrão: "user-1"
  // (o mesmo usuarioId de CTX_OWNER).
  usuarioId?: string | Error;
```

3. Substituir o início de `criarAppDeTeste` (da linha `const ctx = ...` até o fim do `.useValue` do `RESOLVEDOR_TENANT`) por:

```ts
  const ctx = opcoes.ctx ?? CTX_OWNER;
  const usuarioId = opcoes.usuarioId ?? CTX_OWNER.usuarioId;
  let builder = Test.createTestingModule({
    imports: [TenantModule, ...(opcoes.imports ?? [])],
    controllers: opcoes.controllers ?? [],
  })
    .overrideProvider(RESOLVEDOR_TENANT)
    .useValue(async () => {
      if (ctx instanceof Error) throw ctx;
      return ctx;
    })
    .overrideProvider(RESOLVEDOR_USUARIO)
    .useValue(async () => {
      if (usuarioId instanceof Error) throw usuarioId;
      return usuarioId;
    });
```

- [ ] **Step 6: Rodar os testes**

Run: `npm run api:test && npm run api:typecheck`
Expected: PASS em todas as suítes (inclusive as da Fase 1 e da parte A, que não passam `usuarioId`); typecheck sem erros.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/comum/tenant apps/api/test/utils.ts
git commit -m "feat(api): UsuarioGuard para rotas de usuário sem escritório ativo"
```

---

### Task 2.21: Módulo `perfil`

Contrato a reproduzir (`src/app/api/perfil/**`). Todas exigem só sessão (`UsuarioGuard`), nunca tenant.

| Rota | Sucesso | Erros |
|---|---|---|
| `PATCH /api/perfil` | 200 `{ usuario: { id, nome, email } }` | 400 payload/JSON, 401, 409 `EmailJaCadastradoError` |
| `PATCH /api/perfil/senha` | 200 `{ ok: true }` | 400 payload/JSON, 400 `SenhaAtualIncorretaError`, 401 |
| `POST /api/perfil/avatar/upload-url` | **200** `{ uploadUrl, storageKey }` | 400 payload/`TamanhoAvatarInvalidoError`, 401, **502** `"Não foi possível iniciar o upload."` |
| `POST /api/perfil/avatar/confirmar` | **200** `{ usuario: { id, nome, email, avatarUrl } }` | 400 payload/`StorageKeyInvalidoError`, 401 |
| `GET /api/perfil/avatar/download-url` | 200 `{ downloadUrl: string \| null }` | 401, **502** `"Não foi possível gerar o link do avatar."` |

Lógica além do service a reproduzir: projeção do usuário (nunca devolver `senhaHash` etc.) em `PATCH /perfil` e `POST /avatar/confirmar`; `@HttpCode(200)` nos dois POST.

**Files:**
- Create: `src/lib/api/schemas-perfil.ts`, `apps/api/src/comum/falha-externa.ts`, `apps/api/src/perfil/tokens.ts`, `apps/api/src/perfil/erros.ts`, `apps/api/src/perfil/perfil.controller.ts`, `apps/api/src/perfil/perfil.module.ts`
- Test: `apps/api/src/perfil/perfil.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/perfil/route.ts`, `src/app/api/perfil/route.test.ts`, `src/app/api/perfil/senha/route.ts`, `src/app/api/perfil/senha/route.test.ts`, `src/app/api/perfil/avatar/upload-url/route.ts`, `src/app/api/perfil/avatar/upload-url/route.test.ts`, `src/app/api/perfil/avatar/confirmar/route.ts`, `src/app/api/perfil/avatar/confirmar/route.test.ts`, `src/app/api/perfil/avatar/download-url/route.ts`, `src/app/api/perfil/avatar/download-url/route.test.ts`

**Interfaces:**
- Consumes: `UsuarioGuard`, `UsuarioId`, `criarAppDeTeste({ usuarioId })` (Task 2.20); `ErrosHttpFilter`, `TradutorDeErro`, `ValidacaoZodPipe` (Fase 1); `usuarioService.{atualizarPerfil(usuarioId, dados), alterarSenha(usuarioId, senhaAtual, novaSenha), gerarUrlUploadAvatar(usuarioId, dados), confirmarUploadAvatar(usuarioId, storageKey), gerarUrlDownloadAvatar(usuarioId)}` e `EmailJaCadastradoError`, `SenhaAtualIncorretaError`, `TamanhoAvatarInvalidoError`, `StorageKeyInvalidoError`, `AtualizarPerfilInput`, `UploadUrlAvatarInput` de `@/services/usuario.service`; `nomeArquivoSchema` de `@/lib/api/schemas-comuns`.
- Produces: `USUARIO_SERVICE` (symbol), `PerfilModule`, `tratarErroDePerfil: TradutorDeErro`, `falhaExterna(mensagem: string): TradutorDeErro`, e em `src/lib/api/schemas-perfil.ts`: `atualizarPerfilSchema`, `alterarSenhaSchema`, `uploadUrlAvatarSchema`, `confirmarAvatarSchema`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/perfil/perfil.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../test/utils";
import { PerfilModule } from "./perfil.module";
import { USUARIO_SERVICE } from "./tokens";
import {
  EmailJaCadastradoError,
  SenhaAtualIncorretaError,
  StorageKeyInvalidoError,
  TamanhoAvatarInvalidoError,
} from "@/services/usuario.service";
import { NaoAutenticadoError, SemEscritorioAtivoError } from "@/lib/auth/resolver-tenant";

const service = {
  atualizarPerfil: jest.fn(),
  alterarSenha: jest.fn(),
  gerarUrlUploadAvatar: jest.fn(),
  confirmarUploadAvatar: jest.fn(),
  gerarUrlDownloadAvatar: jest.fn(),
};

type Opcoes = Parameters<typeof criarAppDeTeste>[0];
let app: INestApplication;

async function subir(opcoes: Pick<Opcoes, "usuarioId" | "ctx"> = {}) {
  app = await criarAppDeTeste({ imports: [PerfilModule], ...opcoes, overrides: [[USUARIO_SERVICE, service]] });
  return app.getHttpServer();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("PATCH /api/perfil", () => {
  it("atualiza e devolve só os campos públicos do usuário da sessão", async () => {
    service.atualizarPerfil.mockResolvedValue({
      id: "user-9",
      nome: "Novo Nome",
      email: "novo@teste.com",
      senhaHash: "$2b$10$nao-pode-vazar",
    });

    await request(await subir({ usuarioId: "user-9" }))
      .patch("/api/perfil")
      .send({ nome: "Novo Nome", email: "novo@teste.com" })
      .expect(200, { usuario: { id: "user-9", nome: "Novo Nome", email: "novo@teste.com" } });
    expect(service.atualizarPerfil).toHaveBeenCalledWith("user-9", {
      nome: "Novo Nome",
      email: "novo@teste.com",
    });
  });

  it("funciona sem escritório ativo (perfil é do usuário, não do tenant)", async () => {
    service.atualizarPerfil.mockResolvedValue({ id: "user-1", nome: "N", email: "n@teste.com" });

    await request(await subir({ ctx: new SemEscritorioAtivoError() }))
      .patch("/api/perfil")
      .send({ nome: "N" })
      .expect(200);
  });

  it("responde 401 sem sessão e não chama o service", async () => {
    await request(await subir({ usuarioId: new NaoAutenticadoError() }))
      .patch("/api/perfil")
      .send({ nome: "Novo Nome" })
      .expect(401, { error: "Sessão inválida ou expirada." });
    expect(service.atualizarPerfil).not.toHaveBeenCalled();
  });

  it("responde 400 para JSON malformado", async () => {
    await request(await subir())
      .patch("/api/perfil")
      .set("content-type", "application/json")
      .send("{x")
      .expect(400, { error: "Dados inválidos" });
  });

  it("responde 400 com detalhes para payload inválido", async () => {
    const res = await request(await subir()).patch("/api/perfil").send({ email: "invalido" }).expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(res.body.detalhes.email).toEqual(["E-mail inválido"]);
    expect(service.atualizarPerfil).not.toHaveBeenCalled();
  });

  it("responde 409 quando o e-mail já pertence a outro usuário", async () => {
    const erro = new EmailJaCadastradoError();
    service.atualizarPerfil.mockRejectedValue(erro);

    await request(await subir())
      .patch("/api/perfil")
      .send({ email: "ocupado@teste.com" })
      .expect(409, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.atualizarPerfil.mockRejectedValue(new Error("boom"));

    await request(await subir())
      .patch("/api/perfil")
      .send({ nome: "Novo Nome" })
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("PATCH /api/perfil/senha", () => {
  const payloadValido = { senhaAtual: "senha-atual-123", novaSenha: "senha-nova-123" };

  it("altera a senha e responde { ok: true }", async () => {
    service.alterarSenha.mockResolvedValue(undefined);

    await request(await subir()).patch("/api/perfil/senha").send(payloadValido).expect(200, { ok: true });
    expect(service.alterarSenha).toHaveBeenCalledWith("user-1", "senha-atual-123", "senha-nova-123");
  });

  it("responde 400 para nova senha curta", async () => {
    const res = await request(await subir())
      .patch("/api/perfil/senha")
      .send({ senhaAtual: "atual", novaSenha: "123" })
      .expect(400);

    expect(res.body.detalhes.novaSenha).toEqual(["A nova senha deve ter no mínimo 8 caracteres"]);
    expect(service.alterarSenha).not.toHaveBeenCalled();
  });

  it("responde 400 quando a senha atual está incorreta", async () => {
    const erro = new SenhaAtualIncorretaError();
    service.alterarSenha.mockRejectedValue(erro);

    await request(await subir()).patch("/api/perfil/senha").send(payloadValido).expect(400, { error: erro.message });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir({ usuarioId: new NaoAutenticadoError() }))
      .patch("/api/perfil/senha")
      .send(payloadValido)
      .expect(401);
    expect(service.alterarSenha).not.toHaveBeenCalled();
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.alterarSenha.mockRejectedValue(new Error("boom"));

    await request(await subir()).patch("/api/perfil/senha").send(payloadValido).expect(500);
  });
});

describe("POST /api/perfil/avatar/upload-url", () => {
  const corpo = { nomeArquivo: "foto.png", tipoArquivo: "png", tamanhoBytes: 200 };

  it("responde 200 (não 201) com uploadUrl e storageKey", async () => {
    service.gerarUrlUploadAvatar.mockResolvedValue({
      uploadUrl: "https://bucket.s3.amazonaws.com/signed-put-avatar",
      storageKey: "development/avatares/user-1/123-foto.png",
    });

    await request(await subir()).post("/api/perfil/avatar/upload-url").send(corpo).expect(200, {
      uploadUrl: "https://bucket.s3.amazonaws.com/signed-put-avatar",
      storageKey: "development/avatares/user-1/123-foto.png",
    });
    expect(service.gerarUrlUploadAvatar).toHaveBeenCalledWith("user-1", corpo);
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir({ usuarioId: new NaoAutenticadoError() }))
      .post("/api/perfil/avatar/upload-url")
      .send(corpo)
      .expect(401);
  });

  it("responde 400 para payload incompleto", async () => {
    await request(await subir()).post("/api/perfil/avatar/upload-url").send({ nomeArquivo: "foto.png" }).expect(400);
  });

  it.each([["../../../etc/passwd"], ["a/b.png"], ["..\\windows\\system32"], [".oculto.png"]])(
    "recusa nome de arquivo com travessia de caminho (%s) com 400",
    async (nomeArquivo) => {
      await request(await subir())
        .post("/api/perfil/avatar/upload-url")
        .send({ ...corpo, nomeArquivo })
        .expect(400);
      expect(service.gerarUrlUploadAvatar).not.toHaveBeenCalled();
    }
  );

  it("mapeia TamanhoAvatarInvalidoError para 400", async () => {
    const erro = new TamanhoAvatarInvalidoError();
    service.gerarUrlUploadAvatar.mockRejectedValue(erro);

    await request(await subir())
      .post("/api/perfil/avatar/upload-url")
      .send({ ...corpo, tamanhoBytes: 9999 })
      .expect(400, { error: erro.message });
  });

  it("responde 502 quando o storage falha", async () => {
    service.gerarUrlUploadAvatar.mockRejectedValue(new Error("S3 fora do ar"));

    await request(await subir())
      .post("/api/perfil/avatar/upload-url")
      .send(corpo)
      .expect(502, { error: "Não foi possível iniciar o upload." });
  });
});

describe("POST /api/perfil/avatar/confirmar", () => {
  it("confirma e devolve só os campos públicos (200)", async () => {
    service.confirmarUploadAvatar.mockResolvedValue({
      id: "user-1",
      nome: "Fulano",
      email: "fulano@teste.com",
      avatarUrl: "development/avatares/user-1/123-foto.png",
      senhaHash: "$2b$10$nao-pode-vazar",
    });

    await request(await subir())
      .post("/api/perfil/avatar/confirmar")
      .send({ storageKey: "development/avatares/user-1/123-foto.png" })
      .expect(200, {
        usuario: {
          id: "user-1",
          nome: "Fulano",
          email: "fulano@teste.com",
          avatarUrl: "development/avatares/user-1/123-foto.png",
        },
      });
    expect(service.confirmarUploadAvatar).toHaveBeenCalledWith(
      "user-1",
      "development/avatares/user-1/123-foto.png"
    );
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir({ usuarioId: new NaoAutenticadoError() }))
      .post("/api/perfil/avatar/confirmar")
      .send({ storageKey: "x" })
      .expect(401);
  });

  it("responde 400 para payload vazio", async () => {
    await request(await subir()).post("/api/perfil/avatar/confirmar").send({}).expect(400);
    expect(service.confirmarUploadAvatar).not.toHaveBeenCalled();
  });

  // Key fora de avatares/{proprio-usuario}/ é erro do cliente, não falha do servidor.
  it("mapeia StorageKeyInvalidoError para 400", async () => {
    const erro = new StorageKeyInvalidoError();
    service.confirmarUploadAvatar.mockRejectedValue(erro);

    await request(await subir())
      .post("/api/perfil/avatar/confirmar")
      .send({ storageKey: "development/avatares/user-2/222-nova.png" })
      .expect(400, { error: erro.message });
  });
});

describe("GET /api/perfil/avatar/download-url", () => {
  it("devolve a URL assinada do avatar do usuário da sessão", async () => {
    service.gerarUrlDownloadAvatar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get-avatar");

    await request(await subir())
      .get("/api/perfil/avatar/download-url")
      .expect(200, { downloadUrl: "https://bucket.s3.amazonaws.com/signed-get-avatar" });
    expect(service.gerarUrlDownloadAvatar).toHaveBeenCalledWith("user-1");
  });

  it("devolve downloadUrl null quando não há avatar", async () => {
    service.gerarUrlDownloadAvatar.mockResolvedValue(null);

    await request(await subir()).get("/api/perfil/avatar/download-url").expect(200, { downloadUrl: null });
  });

  it("responde 401 sem sessão e não chama o service", async () => {
    await request(await subir({ usuarioId: new NaoAutenticadoError() }))
      .get("/api/perfil/avatar/download-url")
      .expect(401);
    expect(service.gerarUrlDownloadAvatar).not.toHaveBeenCalled();
  });

  it("responde 502 quando o storage falha", async () => {
    service.gerarUrlDownloadAvatar.mockRejectedValue(new Error("S3 fora do ar"));

    await request(await subir())
      .get("/api/perfil/avatar/download-url")
      .expect(502, { error: "Não foi possível gerar o link do avatar." });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- perfil`
Expected: FAIL — `Cannot find module './perfil.module'`.

- [ ] **Step 3: Extrair os schemas das rotas Next**

`src/lib/api/schemas-perfil.ts` (mesmos schemas que hoje vivem inline nas rotas de `src/app/api/perfil/**`):

```ts
import { z } from "zod";
import { nomeArquivoSchema } from "@/lib/api/schemas-comuns";

// Perfil é do usuário, não do tenant (o usuário pode estar no onboarding).
export const atualizarPerfilSchema = z.object({
  nome: z.string().min(1, "Informe seu nome").optional(),
  email: z.string().email("E-mail inválido").optional(),
});

export const alterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres"),
});

export const uploadUrlAvatarSchema = z.object({
  nomeArquivo: nomeArquivoSchema,
  tipoArquivo: z.enum(["jpeg", "png", "webp"]),
  tamanhoBytes: z.number().int().positive(),
});

export const confirmarAvatarSchema = z.object({
  storageKey: z.string().min(1).max(500),
});
```

- [ ] **Step 4: Criar o tradutor de falha externa (502)**

`apps/api/src/comum/falha-externa.ts`:

```ts
import { HttpException } from "@nestjs/common";
import type { TradutorDeErro } from "./erros-http.filter";

// Rotas que dependem do storage (URL assinada do S3) respondem 502 — não 500 — quando o
// provedor externo falha, com a mensagem própria da rota. Este tradutor é sempre o
// ÚLTIMO da lista de um @UseFilters por método: o ErrosHttpFilter já tratou antes
// DadosInvalidosError, JSON malformado e erros de tenant, e os tradutores de domínio
// anteriores pegam os erros de regra. O que sobra é falha de infraestrutura.
export function falhaExterna(mensagem: string): TradutorDeErro {
  return (error) => {
    if (error instanceof HttpException) {
      return null;
    }
    console.error(`[api] falha em serviço externo: ${mensagem}`, error);
    return Response.json({ error: mensagem }, { status: 502 });
  };
}
```

- [ ] **Step 5: Implementar o módulo**

`apps/api/src/perfil/tokens.ts`:

```ts
export const USUARIO_SERVICE = Symbol("USUARIO_SERVICE");
```

`apps/api/src/perfil/erros.ts`:

```ts
import type { TradutorDeErro } from "../comum/erros-http.filter";
import {
  EmailJaCadastradoError,
  SenhaAtualIncorretaError,
  StorageKeyInvalidoError,
  TamanhoAvatarInvalidoError,
} from "@/services/usuario.service";

// Mesmos códigos das rotas Next de /api/perfil/**.
export const tratarErroDePerfil: TradutorDeErro = (error) => {
  if (error instanceof EmailJaCadastradoError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (
    error instanceof SenhaAtualIncorretaError ||
    error instanceof TamanhoAvatarInvalidoError ||
    error instanceof StorageKeyInvalidoError
  ) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return null;
};
```

`apps/api/src/perfil/perfil.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { UsuarioGuard } from "../comum/tenant/usuario.guard";
import { UsuarioId } from "../comum/tenant/usuario.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { falhaExterna } from "../comum/falha-externa";
import { USUARIO_SERVICE } from "./tokens";
import { tratarErroDePerfil } from "./erros";
import {
  atualizarPerfilSchema,
  alterarSenhaSchema,
  uploadUrlAvatarSchema,
  confirmarAvatarSchema,
} from "@/lib/api/schemas-perfil";
import type {
  usuarioService,
  AtualizarPerfilInput,
  UploadUrlAvatarInput,
} from "@/services/usuario.service";

// Perfil é do usuário, não do tenant: UsuarioGuard (sessão), nunca TenantGuard — o
// usuário pode estar no meio do onboarding, sem nenhum escritório ainda.
@Controller("perfil")
@UseGuards(UsuarioGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDePerfil]))
export class PerfilController {
  constructor(@Inject(USUARIO_SERVICE) private readonly service: typeof usuarioService) {}

  @Patch()
  async atualizar(
    @UsuarioId() usuarioId: string,
    @Body(new ValidacaoZodPipe(atualizarPerfilSchema)) dados: AtualizarPerfilInput
  ) {
    const usuario = await this.service.atualizarPerfil(usuarioId, dados);
    return { usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } };
  }

  @Patch("senha")
  async alterarSenha(
    @UsuarioId() usuarioId: string,
    @Body(new ValidacaoZodPipe(alterarSenhaSchema)) dados: { senhaAtual: string; novaSenha: string }
  ) {
    await this.service.alterarSenha(usuarioId, dados.senhaAtual, dados.novaSenha);
    return { ok: true };
  }

  @Post("avatar/upload-url")
  @HttpCode(200)
  @UseFilters(
    new ErrosHttpFilter([tratarErroDePerfil, falhaExterna("Não foi possível iniciar o upload.")])
  )
  async gerarUrlUploadAvatar(
    @UsuarioId() usuarioId: string,
    @Body(new ValidacaoZodPipe(uploadUrlAvatarSchema)) dados: UploadUrlAvatarInput
  ) {
    return this.service.gerarUrlUploadAvatar(usuarioId, dados);
  }

  @Post("avatar/confirmar")
  @HttpCode(200)
  async confirmarAvatar(
    @UsuarioId() usuarioId: string,
    @Body(new ValidacaoZodPipe(confirmarAvatarSchema)) dados: { storageKey: string }
  ) {
    const usuario = await this.service.confirmarUploadAvatar(usuarioId, dados.storageKey);
    return {
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        avatarUrl: usuario.avatarUrl,
      },
    };
  }

  @Get("avatar/download-url")
  @UseFilters(new ErrosHttpFilter([falhaExterna("Não foi possível gerar o link do avatar.")]))
  async gerarUrlDownloadAvatar(@UsuarioId() usuarioId: string) {
    return { downloadUrl: await this.service.gerarUrlDownloadAvatar(usuarioId) };
  }
}
```

`apps/api/src/perfil/perfil.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { PerfilController } from "./perfil.controller";
import { USUARIO_SERVICE } from "./tokens";
import { usuarioService } from "@/services/usuario.service";

@Module({
  controllers: [PerfilController],
  providers: [{ provide: USUARIO_SERVICE, useValue: usuarioService }],
})
export class PerfilModule {}
```

- [ ] **Step 6: Rodar os testes do módulo**

Run: `npm run api:test -- perfil && npm run api:typecheck`
Expected: PASS; typecheck sem erros.

- [ ] **Step 7: Registrar no AppModule e no rewrite**

Em `apps/api/src/app.module.ts`, acrescentar junto aos demais imports:

```ts
import { PerfilModule } from "./perfil/perfil.module";
```

e acrescentar `PerfilModule` ao **final** do array `imports` do `@Module({...})`.

Em `next.config.ts`, acrescentar ao final do array `ROTAS_NA_API_NEST`:

```ts
  "perfil",
```

- [ ] **Step 8: Verificar ponta a ponta**

Terminal 1: `npm run api:dev`; terminal 2: `npm run dev`. Logar, abrir a tela de perfil, trocar o nome, trocar a senha e enviar uma foto de avatar.
Expected: tudo funciona; o avatar aparece no header após recarregar; nenhuma linha `[api] erro em ...` no terminal da API.

- [ ] **Step 9: Remover as rotas Next substituídas**

```bash
git rm -r src/app/api/perfil
```

- [ ] **Step 10: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS.

- [ ] **Step 11: Commit**

```bash
git add src/lib/api/schemas-perfil.ts apps/api/src/comum/falha-externa.ts apps/api/src/perfil apps/api/src/app.module.ts next.config.ts
git commit -m "feat(api): módulo perfil no NestJS com o mesmo contrato HTTP"
```

---

### Task 2.22: Módulo `escritorios/atual`

Só `GET`/`PATCH /api/escritorios/atual`. `POST /api/escritorios` (raiz) **não** migra: chama `unstable_update()` para gravar o escritório recém-criado no cookie de sessão e fica para a Fase 3. Como o prefixo `escritorios` não pode ir inteiro para o rewrite, o item em `ROTAS_NA_API_NEST` é `"escritorios/atual"`. Os schemas, hoje em `src/app/api/escritorios/schemas.ts` (compartilhados pela raiz e por `atual`), vão para `src/lib/api/` para que a remoção de `atual` não deixe o Nest importando de dentro de `src/app`.

| Rota | Sucesso | Erros |
|---|---|---|
| `GET /api/escritorios/atual` | 200 `{ escritorio }` | 401/409/403 tenant, 404 `EscritorioNaoEncontradoError` |
| `PATCH /api/escritorios/atual` | 200 `{ escritorio }` | 400 payload/JSON, 401/409/403 tenant, 403 `PermissaoNegadaError` |

**Files:**
- Move: `src/app/api/escritorios/schemas.ts` → `src/lib/api/schemas-escritorio.ts` (`git mv`, conteúdo inalterado)
- Modify: `src/app/api/escritorios/route.ts` (import do schema), `apps/api/src/app.module.ts`, `next.config.ts`
- Create: `apps/api/src/escritorios/tokens.ts`, `apps/api/src/escritorios/erros.ts`, `apps/api/src/escritorios/escritorio-atual.controller.ts`, `apps/api/src/escritorios/escritorios.module.ts`
- Test: `apps/api/src/escritorios/escritorio-atual.controller.test.ts`
- Delete: `src/app/api/escritorios/atual/route.ts`, `src/app/api/escritorios/atual/route.test.ts`

**Interfaces:**
- Consumes: `TenantGuard`, `Tenant`, `criarAppDeTeste`, `CTX_OWNER`, `ErrosHttpFilter`, `ValidacaoZodPipe` (Fase 1); `escritorioService.{obterEscritorioAtivo(ctx), atualizarEscritorio(ctx, dados)}`, `EscritorioNaoEncontradoError`, `PermissaoNegadaError`, `AtualizarEscritorioInput` de `@/services/escritorio.service`.
- Produces: `ESCRITORIO_SERVICE` (symbol), `EscritoriosModule` (a Fase 3 acrescenta nele o `POST /api/escritorios`), `tratarErroDeEscritorio: TradutorDeErro`; `src/lib/api/schemas-escritorio.ts` exporta `nomeEscritorioSchema`, `oabResponsavelSchema`, `telefoneWhatsappSchema`, `criarEscritorioSchema`, `atualizarEscritorioSchema`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/escritorios/escritorio-atual.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { EscritoriosModule } from "./escritorios.module";
import { ESCRITORIO_SERVICE } from "./tokens";
import { EscritorioNaoEncontradoError, PermissaoNegadaError } from "@/services/escritorio.service";
import {
  AcessoNegadoError,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
} from "@/lib/auth/resolver-tenant";

const service = { obterEscritorioAtivo: jest.fn(), atualizarEscritorio: jest.fn() };

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({ imports: [EscritoriosModule], ctx, overrides: [[ESCRITORIO_SERVICE, service]] });
  return app.getHttpServer();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/escritorios/atual", () => {
  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("responde o erro de tenant %p com %i", async (erro, status) => {
    await request(await subir(erro)).get("/api/escritorios/atual").expect(status, { error: erro.message });
    expect(service.obterEscritorioAtivo).not.toHaveBeenCalled();
  });

  it("devolve o escritório ativo da sessão", async () => {
    service.obterEscritorioAtivo.mockResolvedValue({ id: "esc-1", nome: "Escritório" });

    await request(await subir())
      .get("/api/escritorios/atual")
      .expect(200, { escritorio: { id: "esc-1", nome: "Escritório" } });
    expect(service.obterEscritorioAtivo).toHaveBeenCalledWith(CTX_OWNER);
  });

  it("responde 404 quando o escritório não existe mais", async () => {
    const erro = new EscritorioNaoEncontradoError();
    service.obterEscritorioAtivo.mockRejectedValue(erro);

    await request(await subir()).get("/api/escritorios/atual").expect(404, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.obterEscritorioAtivo.mockRejectedValue(new Error("boom"));

    await request(await subir())
      .get("/api/escritorios/atual")
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("PATCH /api/escritorios/atual", () => {
  it("atualiza parcialmente e devolve o escritório", async () => {
    service.atualizarEscritorio.mockResolvedValue({ id: "esc-1", nome: "Novo" });

    await request(await subir())
      .patch("/api/escritorios/atual")
      .send({ nome: "  Novo  " })
      .expect(200, { escritorio: { id: "esc-1", nome: "Novo" } });
    // O schema faz trim: o service recebe o valor normalizado.
    expect(service.atualizarEscritorio).toHaveBeenCalledWith(CTX_OWNER, { nome: "Novo" });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .patch("/api/escritorios/atual")
      .send({ nome: "Novo" })
      .expect(401);
  });

  it("responde 400 para JSON malformado", async () => {
    await request(await subir())
      .patch("/api/escritorios/atual")
      .set("content-type", "application/json")
      .send("{x")
      .expect(400, { error: "Dados inválidos" });
  });

  it("responde 400 com detalhes para nome vazio", async () => {
    const res = await request(await subir()).patch("/api/escritorios/atual").send({ nome: "" }).expect(400);

    expect(res.body.detalhes.nome).toEqual(["Informe o nome do escritório"]);
    expect(service.atualizarEscritorio).not.toHaveBeenCalled();
  });

  it("responde 403 quando o service bloqueia (role padrao)", async () => {
    const erro = new PermissaoNegadaError();
    service.atualizarEscritorio.mockRejectedValue(erro);

    await request(await subir()).patch("/api/escritorios/atual").send({ nome: "Novo" }).expect(403, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.atualizarEscritorio.mockRejectedValue(new Error("boom"));

    await request(await subir()).patch("/api/escritorios/atual").send({ nome: "Novo" }).expect(500);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- escritorio`
Expected: FAIL — `Cannot find module './escritorios.module'`.

- [ ] **Step 3: Mover os schemas**

```bash
git mv src/app/api/escritorios/schemas.ts src/lib/api/schemas-escritorio.ts
```

Em `src/app/api/escritorios/route.ts`, trocar:

```ts
import { criarEscritorioSchema } from "./schemas";
```

por:

```ts
import { criarEscritorioSchema } from "@/lib/api/schemas-escritorio";
```

(`src/app/api/escritorios/atual/route.ts` também importa `../schemas`, mas é removido no Step 8; até lá, trocar o import dele para `@/lib/api/schemas-escritorio` para o `npx jest` não quebrar no meio da task.)

- [ ] **Step 4: Implementar o módulo**

`apps/api/src/escritorios/tokens.ts`:

```ts
export const ESCRITORIO_SERVICE = Symbol("ESCRITORIO_SERVICE");
```

`apps/api/src/escritorios/erros.ts`:

```ts
import type { TradutorDeErro } from "../comum/erros-http.filter";
import { EscritorioNaoEncontradoError, PermissaoNegadaError } from "@/services/escritorio.service";

export const tratarErroDeEscritorio: TradutorDeErro = (error) => {
  if (error instanceof EscritorioNaoEncontradoError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoNegadaError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  return null;
};
```

`apps/api/src/escritorios/escritorio-atual.controller.ts`:

```ts
import { Body, Controller, Get, Inject, Patch, UseFilters, UseGuards } from "@nestjs/common";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { ESCRITORIO_SERVICE } from "./tokens";
import { tratarErroDeEscritorio } from "./erros";
import { atualizarEscritorioSchema } from "@/lib/api/schemas-escritorio";
import type { escritorioService, AtualizarEscritorioInput } from "@/services/escritorio.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Escritório ativo da sessão. A criação (POST /api/escritorios) continua no Next até a
// Fase 3, porque troca o escritório ativo dentro do cookie de sessão.
@Controller("escritorios/atual")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeEscritorio]))
export class EscritorioAtualController {
  constructor(@Inject(ESCRITORIO_SERVICE) private readonly service: typeof escritorioService) {}

  @Get()
  async obter(@Tenant() ctx: TenantContext) {
    return { escritorio: await this.service.obterEscritorioAtivo(ctx) };
  }

  @Patch()
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(atualizarEscritorioSchema)) dados: AtualizarEscritorioInput
  ) {
    return { escritorio: await this.service.atualizarEscritorio(ctx, dados) };
  }
}
```

`apps/api/src/escritorios/escritorios.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { EscritorioAtualController } from "./escritorio-atual.controller";
import { ESCRITORIO_SERVICE } from "./tokens";
import { escritorioService } from "@/services/escritorio.service";

@Module({
  controllers: [EscritorioAtualController],
  providers: [{ provide: ESCRITORIO_SERVICE, useValue: escritorioService }],
})
export class EscritoriosModule {}
```

- [ ] **Step 5: Rodar os testes do módulo**

Run: `npm run api:test -- escritorio && npm run api:typecheck`
Expected: PASS; typecheck sem erros.

- [ ] **Step 6: Registrar no AppModule e no rewrite**

Em `apps/api/src/app.module.ts`:

```ts
import { EscritoriosModule } from "./escritorios/escritorios.module";
```

e `EscritoriosModule` ao final do array `imports`.

Em `next.config.ts`, ao final de `ROTAS_NA_API_NEST`:

```ts
  "escritorios/atual",
```

(nunca `"escritorios"`: o `POST /api/escritorios` precisa continuar no Next até a Fase 3.)

- [ ] **Step 7: Verificar ponta a ponta**

Com `npm run api:dev` e `npm run dev`: abrir **Configurações → Escritório**, alterar nome/OAB/telefone e salvar; depois criar um **novo escritório** pelo seletor de escritórios.
Expected: a edição funciona e é atendida pelo Nest (com a API parada, salvar falha); a criação continua sendo atendida pelo Next e o novo escritório vira o ativo da sessão.

- [ ] **Step 8: Remover a rota Next substituída**

```bash
git rm -r src/app/api/escritorios/atual
```

- [ ] **Step 9: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS (inclusive `src/app/api/escritorios/route.test.ts`, que continua no Next).

- [ ] **Step 10: Commit**

```bash
git add src/lib/api/schemas-escritorio.ts src/app/api/escritorios apps/api/src/escritorios apps/api/src/app.module.ts next.config.ts
git commit -m "feat(api): escritório ativo (escritorios/atual) servido pelo NestJS"
```

---

### Task 2.23: Módulo `membros`

| Rota | Sucesso | Erros |
|---|---|---|
| `GET /api/membros` | 200 `{ membros }` | 401/409/403 tenant |
| `PATCH /api/membros/:id` | 200 `{ membro }` | 400 role inválido/JSON, 404 `MembroNaoEncontradoError`, 403 `PermissaoNegadaError`, 409 `UltimoOwnerError` |
| `DELETE /api/membros/:id` | 200 `{ ok: true }` | 404, 403, 409 |

**Files:**
- Create: `src/lib/api/schemas-membro.ts`, `apps/api/src/membros/tokens.ts`, `apps/api/src/membros/erros.ts`, `apps/api/src/membros/membros.controller.ts`, `apps/api/src/membros/membros.module.ts`
- Test: `apps/api/src/membros/membros.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/membros/route.ts`, `src/app/api/membros/route.test.ts`, `src/app/api/membros/[id]/route.ts`, `src/app/api/membros/[id]/route.test.ts`

**Interfaces:**
- Consumes: Fase 1 (`TenantGuard`, `Tenant`, `ErrosHttpFilter`, `ValidacaoZodPipe`, `criarAppDeTeste`, `CTX_OWNER`); `membroService.{listarMembros(ctx), alterarRole(ctx, membroId, role), remover(ctx, membroId)}`, `MembroNaoEncontradoError`, `PermissaoNegadaError`, `UltimoOwnerError` de `@/services/membro.service`.
- Produces: `MEMBRO_SERVICE` (symbol), `MembrosModule`, `tratarErroDeMembro: TradutorDeErro`, `alterarRoleSchema` em `src/lib/api/schemas-membro.ts`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/membros/membros.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { MembrosModule } from "./membros.module";
import { MEMBRO_SERVICE } from "./tokens";
import {
  MembroNaoEncontradoError,
  PermissaoNegadaError,
  UltimoOwnerError,
} from "@/services/membro.service";
import {
  AcessoNegadoError,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
} from "@/lib/auth/resolver-tenant";

const service = { listarMembros: jest.fn(), alterarRole: jest.fn(), remover: jest.fn() };

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({ imports: [MembrosModule], ctx, overrides: [[MEMBRO_SERVICE, service]] });
  return app.getHttpServer();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/membros", () => {
  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("responde o erro de tenant %p com %i", async (erro, status) => {
    await request(await subir(erro)).get("/api/membros").expect(status);
    expect(service.listarMembros).not.toHaveBeenCalled();
  });

  it("lista os membros do escritório da sessão", async () => {
    service.listarMembros.mockResolvedValue([{ id: "membro-1" }]);

    await request(await subir()).get("/api/membros").expect(200, { membros: [{ id: "membro-1" }] });
    expect(service.listarMembros).toHaveBeenCalledWith(CTX_OWNER);
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.listarMembros.mockRejectedValue(new Error("boom"));

    await request(await subir())
      .get("/api/membros")
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("PATCH /api/membros/:id", () => {
  it("altera o papel e devolve o membro", async () => {
    service.alterarRole.mockResolvedValue({ id: "membro-1", role: "admin" });

    await request(await subir())
      .patch("/api/membros/membro-1")
      .send({ role: "admin" })
      .expect(200, { membro: { id: "membro-1", role: "admin" } });
    expect(service.alterarRole).toHaveBeenCalledWith(CTX_OWNER, "membro-1", "admin");
  });

  it("responde 400 para role inválido", async () => {
    await request(await subir()).patch("/api/membros/membro-1").send({ role: "invalido" }).expect(400);
    expect(service.alterarRole).not.toHaveBeenCalled();
  });

  it.each([
    [new MembroNaoEncontradoError(), 404],
    [new PermissaoNegadaError(), 403],
    [new UltimoOwnerError(), 409],
  ])("mapeia %p para %i", async (erro, status) => {
    service.alterarRole.mockRejectedValue(erro);

    await request(await subir())
      .patch("/api/membros/membro-1")
      .send({ role: "admin" })
      .expect(status, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.alterarRole.mockRejectedValue(new Error("boom"));

    await request(await subir()).patch("/api/membros/membro-1").send({ role: "admin" }).expect(500);
  });
});

describe("DELETE /api/membros/:id", () => {
  it("remove e responde { ok: true }", async () => {
    service.remover.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/membros/membro-1").expect(200, { ok: true });
    expect(service.remover).toHaveBeenCalledWith(CTX_OWNER, "membro-1");
  });

  it.each([
    [new MembroNaoEncontradoError(), 404],
    [new UltimoOwnerError(), 409],
  ])("mapeia %p para %i", async (erro, status) => {
    service.remover.mockRejectedValue(erro);

    await request(await subir()).delete("/api/membros/membro-1").expect(status, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.remover.mockRejectedValue(new Error("boom"));

    await request(await subir()).delete("/api/membros/membro-1").expect(500);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- membros`
Expected: FAIL — `Cannot find module './membros.module'`.

- [ ] **Step 3: Implementar**

`src/lib/api/schemas-membro.ts`:

```ts
import { z } from "zod";

// Promoção/rebaixamento de papel dentro do escritório (RN02a).
export const alterarRoleSchema = z.object({
  role: z.enum(["owner", "admin", "padrao"]),
});
```

`apps/api/src/membros/tokens.ts`:

```ts
export const MEMBRO_SERVICE = Symbol("MEMBRO_SERVICE");
```

`apps/api/src/membros/erros.ts`:

```ts
import type { TradutorDeErro } from "../comum/erros-http.filter";
import {
  MembroNaoEncontradoError,
  PermissaoNegadaError,
  UltimoOwnerError,
} from "@/services/membro.service";

export const tratarErroDeMembro: TradutorDeErro = (error) => {
  if (error instanceof MembroNaoEncontradoError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoNegadaError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof UltimoOwnerError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return null;
};
```

`apps/api/src/membros/membros.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { RoleMembro } from "@prisma/client";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { MEMBRO_SERVICE } from "./tokens";
import { tratarErroDeMembro } from "./erros";
import { alterarRoleSchema } from "@/lib/api/schemas-membro";
import type { membroService } from "@/services/membro.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Gestão de usuários do escritório (RN02a): as regras de quem pode promover/remover
// ficam no membroService.
@Controller("membros")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeMembro]))
export class MembrosController {
  constructor(@Inject(MEMBRO_SERVICE) private readonly service: typeof membroService) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { membros: await this.service.listarMembros(ctx) };
  }

  @Patch(":id")
  async alterarRole(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(alterarRoleSchema)) dados: { role: RoleMembro }
  ) {
    return { membro: await this.service.alterarRole(ctx, id, dados.role) };
  }

  @Delete(":id")
  @HttpCode(200)
  async remover(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.remover(ctx, id);
    return { ok: true };
  }
}
```

`apps/api/src/membros/membros.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { MembrosController } from "./membros.controller";
import { MEMBRO_SERVICE } from "./tokens";
import { membroService } from "@/services/membro.service";

@Module({
  controllers: [MembrosController],
  providers: [{ provide: MEMBRO_SERVICE, useValue: membroService }],
})
export class MembrosModule {}
```

- [ ] **Step 4: Rodar os testes do módulo**

Run: `npm run api:test -- membros && npm run api:typecheck`
Expected: PASS; typecheck sem erros.

- [ ] **Step 5: Registrar no AppModule e no rewrite**

Em `apps/api/src/app.module.ts`:

```ts
import { MembrosModule } from "./membros/membros.module";
```

e `MembrosModule` ao final do array `imports`. Em `next.config.ts`, ao final de `ROTAS_NA_API_NEST`:

```ts
  "membros",
```

- [ ] **Step 6: Verificar ponta a ponta**

Com API e Next de pé, como owner: **Configurações → Equipe**, promover um colaborador a admin, rebaixá-lo e removê-lo; tentar rebaixar o único owner.
Expected: as três operações funcionam; a última mostra a mensagem de "último owner" (409).

- [ ] **Step 7: Remover as rotas Next substituídas**

```bash
git rm -r src/app/api/membros
```

- [ ] **Step 8: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/api/schemas-membro.ts apps/api/src/membros apps/api/src/app.module.ts next.config.ts
git commit -m "feat(api): módulo membros no NestJS com o mesmo contrato HTTP"
```

---

### Task 2.24: Módulo `convites`

| Rota | Sucesso | Erros |
|---|---|---|
| `GET /api/convites` | 200 `{ convites }` | 401/409/403 tenant, 403 `PermissaoNegadaError` |
| `POST /api/convites` | **201** com o retorno do service como corpo (`{ tipo: "membro", membro }` ou `{ tipo: "convite", convite }`) | 400 payload/JSON, 403, 409 `ConviteJaExisteError`/`JaEhMembroError` |
| `DELETE /api/convites/:id` | 200 `{ ok: true }` | 404 `ConviteNaoEncontradoError`, 403 |

**Files:**
- Create: `src/lib/api/schemas-convite.ts`, `apps/api/src/convites/tokens.ts`, `apps/api/src/convites/erros.ts`, `apps/api/src/convites/convites.controller.ts`, `apps/api/src/convites/convites.module.ts`
- Test: `apps/api/src/convites/convites.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/convites/route.ts`, `src/app/api/convites/route.test.ts`, `src/app/api/convites/[id]/route.ts`, `src/app/api/convites/[id]/route.test.ts`

**Interfaces:**
- Consumes: Fase 1; `conviteService.{listarPendentes(ctx), convidar(ctx, dados: ConvidarInput), cancelar(ctx, conviteId)}`, `PermissaoNegadaError`, `ConviteJaExisteError`, `JaEhMembroError`, `ConviteNaoEncontradoError`, `ConvidarInput` de `@/services/convite.service`.
- Produces: `CONVITE_SERVICE` (symbol), `ConvitesModule`, `tratarErroDeConvite: TradutorDeErro`, `convidarSchema` em `src/lib/api/schemas-convite.ts`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/convites/convites.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { ConvitesModule } from "./convites.module";
import { CONVITE_SERVICE } from "./tokens";
import {
  ConviteJaExisteError,
  ConviteNaoEncontradoError,
  JaEhMembroError,
  PermissaoNegadaError,
} from "@/services/convite.service";
import {
  AcessoNegadoError,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
} from "@/lib/auth/resolver-tenant";

const service = { listarPendentes: jest.fn(), convidar: jest.fn(), cancelar: jest.fn() };
const corpoValido = { email: "novo@teste.com", role: "padrao" };

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({ imports: [ConvitesModule], ctx, overrides: [[CONVITE_SERVICE, service]] });
  return app.getHttpServer();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/convites", () => {
  it("lista os convites pendentes", async () => {
    service.listarPendentes.mockResolvedValue([{ id: "convite-1" }]);

    await request(await subir()).get("/api/convites").expect(200, { convites: [{ id: "convite-1" }] });
    expect(service.listarPendentes).toHaveBeenCalledWith(CTX_OWNER);
  });

  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("responde o erro de tenant %p com %i", async (erro, status) => {
    await request(await subir(erro)).get("/api/convites").expect(status);
  });

  it("responde 403 quando o service bloqueia (padrao)", async () => {
    const erro = new PermissaoNegadaError();
    service.listarPendentes.mockRejectedValue(erro);

    await request(await subir()).get("/api/convites").expect(403, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.listarPendentes.mockRejectedValue(new Error("boom"));

    await request(await subir()).get("/api/convites").expect(500);
  });
});

describe("POST /api/convites", () => {
  it("responde 201 com o resultado do service como corpo", async () => {
    service.convidar.mockResolvedValue({ tipo: "convite", convite: { id: "convite-1" } });

    await request(await subir())
      .post("/api/convites")
      .send(corpoValido)
      .expect(201, { tipo: "convite", convite: { id: "convite-1" } });
    expect(service.convidar).toHaveBeenCalledWith(CTX_OWNER, corpoValido);
  });

  it("responde 400 para JSON malformado sem chamar o service", async () => {
    await request(await subir())
      .post("/api/convites")
      .set("content-type", "application/json")
      .send("{x")
      .expect(400);
    expect(service.convidar).not.toHaveBeenCalled();
  });

  it("responde 400 com detalhes para e-mail inválido", async () => {
    const res = await request(await subir()).post("/api/convites").send({ email: "invalido" }).expect(400);

    expect(res.body.detalhes.email).toEqual(["E-mail inválido"]);
    expect(service.convidar).not.toHaveBeenCalled();
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).post("/api/convites").send(corpoValido).expect(401);
  });

  it.each([
    [new PermissaoNegadaError(), 403],
    [new ConviteJaExisteError(), 409],
    [new JaEhMembroError(), 409],
  ])("mapeia %p para %i", async (erro, status) => {
    service.convidar.mockRejectedValue(erro);

    await request(await subir()).post("/api/convites").send(corpoValido).expect(status, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.convidar.mockRejectedValue(new Error("boom"));

    await request(await subir()).post("/api/convites").send(corpoValido).expect(500);
  });
});

describe("DELETE /api/convites/:id", () => {
  it("cancela e responde { ok: true }", async () => {
    service.cancelar.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/convites/convite-1").expect(200, { ok: true });
    expect(service.cancelar).toHaveBeenCalledWith(CTX_OWNER, "convite-1");
  });

  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("responde o erro de tenant %p com %i", async (erro, status) => {
    await request(await subir(erro)).delete("/api/convites/convite-1").expect(status);
  });

  it.each([
    [new ConviteNaoEncontradoError(), 404],
    [new PermissaoNegadaError(), 403],
  ])("mapeia %p para %i", async (erro, status) => {
    service.cancelar.mockRejectedValue(erro);

    await request(await subir()).delete("/api/convites/convite-1").expect(status, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.cancelar.mockRejectedValue(new Error("boom"));

    await request(await subir()).delete("/api/convites/convite-1").expect(500);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- convites`
Expected: FAIL — `Cannot find module './convites.module'`.

- [ ] **Step 3: Implementar**

`src/lib/api/schemas-convite.ts`:

```ts
import { z } from "zod";

// Convite de colaborador por e-mail (RN02a). Se o e-mail já é usuário, o service o
// adiciona direto como membro.
export const convidarSchema = z.object({
  email: z.string().email("E-mail inválido"),
  role: z.enum(["owner", "admin", "padrao"]),
});
```

`apps/api/src/convites/tokens.ts`:

```ts
export const CONVITE_SERVICE = Symbol("CONVITE_SERVICE");
```

`apps/api/src/convites/erros.ts`:

```ts
import type { TradutorDeErro } from "../comum/erros-http.filter";
import {
  ConviteJaExisteError,
  ConviteNaoEncontradoError,
  JaEhMembroError,
  PermissaoNegadaError,
} from "@/services/convite.service";

export const tratarErroDeConvite: TradutorDeErro = (error) => {
  if (error instanceof ConviteNaoEncontradoError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoNegadaError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ConviteJaExisteError || error instanceof JaEhMembroError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return null;
};
```

`apps/api/src/convites/convites.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { CONVITE_SERVICE } from "./tokens";
import { tratarErroDeConvite } from "./erros";
import { convidarSchema } from "@/lib/api/schemas-convite";
import type { conviteService, ConvidarInput } from "@/services/convite.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

@Controller("convites")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeConvite]))
export class ConvitesController {
  constructor(@Inject(CONVITE_SERVICE) private readonly service: typeof conviteService) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { convites: await this.service.listarPendentes(ctx) };
  }

  // 201 (padrão do @Post) com o ConvidarResult como corpo — igual à rota Next.
  @Post()
  async convidar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(convidarSchema)) dados: ConvidarInput
  ) {
    return this.service.convidar(ctx, dados);
  }

  @Delete(":id")
  @HttpCode(200)
  async cancelar(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.cancelar(ctx, id);
    return { ok: true };
  }
}
```

`apps/api/src/convites/convites.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { ConvitesController } from "./convites.controller";
import { CONVITE_SERVICE } from "./tokens";
import { conviteService } from "@/services/convite.service";

@Module({
  controllers: [ConvitesController],
  providers: [{ provide: CONVITE_SERVICE, useValue: conviteService }],
})
export class ConvitesModule {}
```

- [ ] **Step 4: Rodar os testes do módulo**

Run: `npm run api:test -- convites && npm run api:typecheck`
Expected: PASS; typecheck sem erros.

- [ ] **Step 5: Registrar no AppModule e no rewrite**

Em `apps/api/src/app.module.ts`:

```ts
import { ConvitesModule } from "./convites/convites.module";
```

e `ConvitesModule` ao final do array `imports`. Em `next.config.ts`, ao final de `ROTAS_NA_API_NEST`:

```ts
  "convites",
```

- [ ] **Step 6: Verificar ponta a ponta**

Com API e Next de pé, rodar o e2e do fluxo de convite: `npx playwright test e2e/convite-colaborador.spec.ts`.
Expected: PASS.

- [ ] **Step 7: Remover as rotas Next substituídas**

```bash
git rm -r src/app/api/convites
```

- [ ] **Step 8: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/api/schemas-convite.ts apps/api/src/convites apps/api/src/app.module.ts next.config.ts
git commit -m "feat(api): módulo convites no NestJS com o mesmo contrato HTTP"
```

---

### Task 2.25: Módulo `dashboard` (`GET /api/dashboard/resumo`)

| Rota | Sucesso | Erros |
|---|---|---|
| `GET /api/dashboard/resumo?clienteId=&responsavelId=&dataInicio=&dataFim=` | 200 com o `ResumoDashboard` do service como corpo | 401/409/403 tenant, 500 genérico |

Lógica além do service a reproduzir: a query é lida por `parseFiltrosCasoDaQuery(searchParams)` (listas separadas por vírgula, datas inválidas ignoradas) e **só** o subconjunto `clienteIds`/`responsavelIds`/`dataInicio`/`dataFim` vai ao service. Para usar os parsers do domínio sem reescrevê-los, o controller reconstrói um `URLSearchParams` a partir da URL original (`searchParamsDaRequisicao`) — o `req.query` do Express tem semântica diferente (arrays em chave repetida, sem `null`).

**Files:**
- Create: `apps/api/src/dashboard/tokens.ts`, `apps/api/src/dashboard/dashboard.controller.ts`, `apps/api/src/dashboard/dashboard.module.ts`
- Test: `apps/api/src/dashboard/dashboard.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/dashboard/resumo/route.ts`, `src/app/api/dashboard/resumo/route.test.ts`

**Interfaces:**
- Consumes: Fase 1; `dashboardService.resumo(ctx, filtros: FiltrosDashboard)` de `@/services/dashboard.service`; `parseFiltrosCasoDaQuery(searchParams: URLSearchParams): FiltrosCaso` de `@/lib/api/schemas-caso`.
- Consumes também: `searchParamsDaRequisicao(req: Request): URLSearchParams` de `apps/api/src/comum/query.ts` (Task 2.1).
- Produces: `DASHBOARD_SERVICE` (symbol), `DashboardModule`.

- [ ] **Step 1: Escrever os testes que falham**

**Não criar** `apps/api/src/comum/search-params.test.ts`: `searchParamsDaRequisicao` já existe em `apps/api/src/comum/query.ts` com testes (Task 2.1). Pular o bloco de código logo abaixo.

```ts
import type { Request } from "express";
import { searchParamsDaRequisicao } from "./search-params";

function req(originalUrl: string) {
  return { originalUrl } as unknown as Request;
}

describe("searchParamsDaRequisicao", () => {
  it("lê a query da URL original com a semântica de URLSearchParams", () => {
    const sp = searchParamsDaRequisicao(req("/api/dashboard/resumo?clienteId=a,b&dataInicio=2026-01-01"));

    expect(sp.get("clienteId")).toBe("a,b");
    expect(sp.get("dataInicio")).toBe("2026-01-01");
    expect(sp.get("ausente")).toBeNull();
  });

  it("devolve vazio quando não há query", () => {
    expect([...searchParamsDaRequisicao(req("/api/eventos")).keys()]).toEqual([]);
  });

  it("decodifica valores codificados", () => {
    const sp = searchParamsDaRequisicao(req("/api/eventos?inicio=2026-09-01T00%3A00%3A00.000Z"));
    expect(sp.get("inicio")).toBe("2026-09-01T00:00:00.000Z");
  });
});
```

`apps/api/src/dashboard/dashboard.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { DashboardModule } from "./dashboard.module";
import { DASHBOARD_SERVICE } from "./tokens";
import {
  AcessoNegadoError,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
} from "@/lib/auth/resolver-tenant";

const service = { resumo: jest.fn() };

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({ imports: [DashboardModule], ctx, overrides: [[DASHBOARD_SERVICE, service]] });
  return app.getHttpServer();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/dashboard/resumo", () => {
  it("devolve o resumo montado pelo service, sem filtros", async () => {
    const resumo = { porTipoStatus: [{ tipoStatus: { id: "tipo-1" }, total: 2 }] };
    service.resumo.mockResolvedValue(resumo);

    await request(await subir()).get("/api/dashboard/resumo").expect(200, resumo);
    expect(service.resumo).toHaveBeenCalledWith(CTX_OWNER, {
      clienteIds: undefined,
      responsavelIds: undefined,
      dataInicio: undefined,
      dataFim: undefined,
    });
  });

  it("repassa só cliente, responsável e período da query ao service", async () => {
    service.resumo.mockResolvedValue({ porTipoStatus: [] });

    await request(await subir())
      .get(
        "/api/dashboard/resumo?clienteId=cli-1&responsavelId=membro-1&dataInicio=2026-01-01&dataFim=2026-08-01&statusId=s1&busca=x"
      )
      .expect(200);

    expect(service.resumo).toHaveBeenCalledWith(CTX_OWNER, {
      clienteIds: ["cli-1"],
      responsavelIds: ["membro-1"],
      dataInicio: new Date("2026-01-01"),
      dataFim: new Date("2026-08-01"),
    });
  });

  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("responde o erro de tenant %p com %i", async (erro, status) => {
    await request(await subir(erro)).get("/api/dashboard/resumo").expect(status);
    expect(service.resumo).not.toHaveBeenCalled();
  });

  it("responde 500 sem vazar detalhe interno", async () => {
    service.resumo.mockRejectedValue(new Error("connection reset by peer"));

    const res = await request(await subir()).get("/api/dashboard/resumo").expect(500);
    expect(res.body.error).not.toMatch(/connection reset/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- dashboard`
Expected: FAIL — `Cannot find module './dashboard.module'`.

- [ ] **Step 3: Implementar**

**Não criar** `apps/api/src/comum/search-params.ts` (ver acima). Pular o bloco de código logo abaixo.

```ts
import type { Request } from "express";

// Os parsers de query do domínio (parseFiltrosCasoDaQuery, parseFiltrosEventosDaQuery…)
// recebem URLSearchParams, como nas rotas Next. Reconstruir a partir da URL original
// mantém exatamente a mesma semântica (get → primeiro valor ou null), em vez do
// req.query do Express (arrays em chave repetida, undefined).
export function searchParamsDaRequisicao(req: Request): URLSearchParams {
  return new URL(req.originalUrl, "http://localhost").searchParams;
}
```

`apps/api/src/dashboard/tokens.ts`:

```ts
export const DASHBOARD_SERVICE = Symbol("DASHBOARD_SERVICE");
```

`apps/api/src/dashboard/dashboard.controller.ts`:

```ts
import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { searchParamsDaRequisicao } from "../comum/query";
import { DASHBOARD_SERVICE } from "./tokens";
import { parseFiltrosCasoDaQuery } from "@/lib/api/schemas-caso";
import type { dashboardService } from "@/services/dashboard.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Sem tradutores de domínio: o resumo só falha por tenant (filtro global) ou erro
// inesperado (500 genérico).
@Controller("dashboard")
@UseGuards(TenantGuard)
export class DashboardController {
  constructor(@Inject(DASHBOARD_SERVICE) private readonly service: typeof dashboardService) {}

  @Get("resumo")
  async resumo(@Tenant() ctx: TenantContext, @Req() req: Request) {
    // Mesmo filtro do header de /casos aplicado a todo o resumo — só o subconjunto
    // cliente/responsável/período faz sentido fora da tabela.
    const { clienteIds, responsavelIds, dataInicio, dataFim } = parseFiltrosCasoDaQuery(
      searchParamsDaRequisicao(req)
    );
    return this.service.resumo(ctx, { clienteIds, responsavelIds, dataInicio, dataFim });
  }
}
```

`apps/api/src/dashboard/dashboard.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DASHBOARD_SERVICE } from "./tokens";
import { dashboardService } from "@/services/dashboard.service";

@Module({
  controllers: [DashboardController],
  providers: [{ provide: DASHBOARD_SERVICE, useValue: dashboardService }],
})
export class DashboardModule {}
```

- [ ] **Step 4: Rodar os testes do módulo**

Run: `npm run api:test -- dashboard && npm run api:typecheck`
Expected: PASS; typecheck sem erros.

- [ ] **Step 5: Registrar no AppModule e no rewrite**

Em `apps/api/src/app.module.ts`:

```ts
import { DashboardModule } from "./dashboard/dashboard.module";
```

e `DashboardModule` ao final do array `imports`. Em `next.config.ts`, ao final de `ROTAS_NA_API_NEST`:

```ts
  "dashboard",
```

- [ ] **Step 6: Verificar ponta a ponta**

Com API e Next de pé, abrir o **Dashboard**, aplicar filtro de cliente e de período.
Expected: os cards e o gráfico recarregam com os números filtrados; sem `[api] erro em ...` no terminal da API.

- [ ] **Step 7: Remover a rota Next substituída**

```bash
git rm -r src/app/api/dashboard
```

- [ ] **Step 8: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/dashboard apps/api/src/app.module.ts next.config.ts
git commit -m "feat(api): resumo do dashboard servido pelo NestJS"
```

---

### Task 2.26: Módulo `eventos` (agenda)

| Rota | Sucesso | Erros (`tratarErroDeEvento`) |
|---|---|---|
| `GET /api/eventos?inicio=&fim=` | 200 `{ eventos: EventoDTO[] }` | 400 período ausente/invertido (com `detalhes`), tenant |
| `POST /api/eventos` | **201** `{ evento: EventoDTO }` | 400 payload/JSON, 404 caso/cliente alheio, 403 permissão/membro inválido, 422 regra (período, vínculo, modalidade, participante) |
| `GET /api/eventos/:id` | 200 `{ evento }` | 404 |
| `PATCH /api/eventos/:id` | 200 `{ evento }` (recarregado) | 400, 403, 404, 422 |
| `DELETE /api/eventos/:id` | 200 `{ ok: true }` | 403, 404 |

Lógica além do service a reproduzir (RN34): toda resposta com evento é serializada por `serializarEvento(s)` com o callback `podeEditar(ctx, membroAtual.id, evento)`; `POST` recarrega o evento com `obter` após `criar`; `PATCH` chama `atualizar`, depois `obter`; `GET` lista busca `membroAtual` **antes** de `listarNoPeriodo`. Os serializadores entram por token (`SERIALIZADOR_EVENTO`) para os testes não assinarem URLs de avatar no S3.

**Files:**
- Create: `apps/api/src/eventos/tokens.ts`, `apps/api/src/eventos/eventos.controller.ts`, `apps/api/src/eventos/eventos.module.ts`
- Test: `apps/api/src/eventos/eventos.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/eventos/route.ts`, `src/app/api/eventos/route.test.ts`, `src/app/api/eventos/[id]/route.ts`, `src/app/api/eventos/[id]/route.test.ts`

**Interfaces:**
- Consumes: Fase 1 (incl. `DadosInvalidosError` de `../comum/validacao.pipe`); `searchParamsDaRequisicao` (Task 2.25); `eventoService.{membroAtual(ctx), listarNoPeriodo(ctx, { inicio: Date, fim: Date }), criar(ctx, dados), obter(ctx, id), atualizar(ctx, id, dados), excluir(ctx, id), podeEditar(ctx, membroId, evento)}`, `DadosNovoEvento`, `DadosEdicaoEvento` e as classes de erro de `@/services/evento.service`; `novoEventoSchema`, `edicaoEventoSchema`, `parseFiltrosEventosDaQuery` de `@/lib/api/schemas-evento`; `tratarErroDeEvento` de `@/lib/api/erros-evento`; `serializarEvento`, `serializarEventos` de `@/lib/api/serializa-evento`.
- Produces: `EVENTO_SERVICE`, `SERIALIZADOR_EVENTO` (symbols), `interface SerializadorEvento { serializarEvento; serializarEventos }`, `EventosModule`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/eventos/eventos.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { EventosModule } from "./eventos.module";
import { EVENTO_SERVICE, SERIALIZADOR_EVENTO } from "./tokens";
import {
  EventoNaoEncontradoError,
  ModalidadeEventoInvalidaError,
  ParticipanteInvalidoError,
  PermissaoNegadaError,
  VinculoEventoExclusivoError,
} from "@/services/evento.service";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const service = {
  membroAtual: jest.fn(),
  listarNoPeriodo: jest.fn(),
  criar: jest.fn(),
  obter: jest.fn(),
  atualizar: jest.fn(),
  excluir: jest.fn(),
  podeEditar: jest.fn(),
};

// O mock aplica o callback de permissão de verdade: é ele que leva `podeEditar` ao DTO
// (RN34), e um mock que ignora o callback esconderia o controller passando o membro errado.
const serializador = {
  serializarEventos: jest.fn(async (eventos: Record<string, unknown>[], podeEditar: (e: unknown) => boolean) =>
    eventos.map((evento) => ({ ...evento, podeEditar: podeEditar(evento) }))
  ),
  serializarEvento: jest.fn(async (evento: Record<string, unknown>, podeEditar: (e: unknown) => boolean) => ({
    ...evento,
    podeEditar: podeEditar(evento),
  })),
};

const PERIODO = "inicio=2026-09-01T00:00:00.000Z&fim=2026-09-30T23:59:59.999Z";
const VALIDO = {
  titulo: "Audiência de instrução",
  inicio: "2026-09-10T13:00:00.000Z",
  fim: "2026-09-10T14:00:00.000Z",
  modalidade: "presencial",
  local: "Fórum de Joinville",
};

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [EventosModule],
    ctx,
    overrides: [
      [EVENTO_SERVICE, service],
      [SERIALIZADOR_EVENTO, serializador],
    ],
  });
  return app.getHttpServer();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  service.membroAtual.mockResolvedValue({ id: "membro-1" });
  service.podeEditar.mockReturnValue(true);
  service.obter.mockResolvedValue({ id: "evento-1", titulo: "Audiência" });
});

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/eventos", () => {
  it("lista os eventos do período", async () => {
    service.listarNoPeriodo.mockResolvedValue([{ id: "evento-1" }]);

    await request(await subir())
      .get(`/api/eventos?${PERIODO}`)
      .expect(200, { eventos: [{ id: "evento-1", podeEditar: true }] });
    expect(service.listarNoPeriodo).toHaveBeenCalledWith(CTX_OWNER, {
      inicio: new Date("2026-09-01T00:00:00.000Z"),
      fim: new Date("2026-09-30T23:59:59.999Z"),
    });
  });

  it("responde 400 sem o período ou com período invertido", async () => {
    const server = await subir();

    const semFim = await request(server).get("/api/eventos?inicio=2026-09-01T00:00:00.000Z").expect(400);
    expect(semFim.body.error).toBe("Dados inválidos");
    expect(semFim.body.detalhes.fim).toBeDefined();

    await request(server)
      .get("/api/eventos?inicio=2026-09-30T00:00:00.000Z&fim=2026-09-01T00:00:00.000Z")
      .expect(400);
    expect(service.listarNoPeriodo).not.toHaveBeenCalled();
  });

  it("resolve podeEditar por evento com o membro da sessão (RN34)", async () => {
    service.listarNoPeriodo.mockResolvedValue([{ id: "evento-1" }]);
    service.podeEditar.mockReturnValue(false);

    const res = await request(await subir()).get(`/api/eventos?${PERIODO}`).expect(200);

    expect(res.body.eventos[0].podeEditar).toBe(false);
    expect(service.podeEditar).toHaveBeenCalledWith(CTX_OWNER, "membro-1", { id: "evento-1" });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get(`/api/eventos?${PERIODO}`).expect(401);
  });
});

describe("POST /api/eventos", () => {
  it("cria e devolve 201 com o evento recarregado", async () => {
    service.criar.mockResolvedValue({ id: "evento-1" });
    service.obter.mockResolvedValue({ id: "evento-1", titulo: VALIDO.titulo });

    await request(await subir())
      .post("/api/eventos")
      .send(VALIDO)
      .expect(201, { evento: { id: "evento-1", titulo: VALIDO.titulo, podeEditar: true } });
    // O schema de criação aplica os defaults (diaInteiro=false, participantes=[]).
    expect(service.criar).toHaveBeenCalledWith(
      CTX_OWNER,
      expect.objectContaining({ ...VALIDO, diaInteiro: false, participanteMembroIds: [] })
    );
    expect(service.obter).toHaveBeenCalledWith(CTX_OWNER, "evento-1");
  });

  it("responde 400 para corpo inválido e para JSON malformado", async () => {
    const server = await subir();

    await request(server).post("/api/eventos").send({ ...VALIDO, titulo: "" }).expect(400);
    await request(server)
      .post("/api/eventos")
      .set("content-type", "application/json")
      .send("{ nao json")
      .expect(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it.each([
    [new VinculoEventoExclusivoError()],
    [new ModalidadeEventoInvalidaError("Informe o link da reunião.")],
    [new ParticipanteInvalidoError()],
  ])("responde 422 quando %p viola a regra", async (erro) => {
    service.criar.mockRejectedValue(erro);

    await request(await subir()).post("/api/eventos").send(VALIDO).expect(422, { error: erro.message });
  });

  it("responde 403 quando a permissão é negada", async () => {
    service.criar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).post("/api/eventos").send(VALIDO).expect(403);
  });

  it("responde 500 genérico em erro inesperado", async () => {
    service.criar.mockRejectedValue(new Error("boom"));

    await request(await subir())
      .post("/api/eventos")
      .send(VALIDO)
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("GET /api/eventos/:id", () => {
  it("devolve o evento do escritório", async () => {
    await request(await subir())
      .get("/api/eventos/evento-1")
      .expect(200, { evento: { id: "evento-1", titulo: "Audiência", podeEditar: true } });
    expect(service.obter).toHaveBeenCalledWith(CTX_OWNER, "evento-1");
  });

  it("resolve podeEditar com o membro da sessão (RN34)", async () => {
    service.podeEditar.mockReturnValue(false);

    const res = await request(await subir()).get("/api/eventos/evento-1").expect(200);

    expect(res.body.evento.podeEditar).toBe(false);
    expect(service.podeEditar).toHaveBeenCalledWith(CTX_OWNER, "membro-1", {
      id: "evento-1",
      titulo: "Audiência",
    });
  });

  it("responde 404 para evento de outro escritório ou já excluído (RN19/RN34)", async () => {
    const erro = new EventoNaoEncontradoError();
    service.obter.mockRejectedValue(erro);

    await request(await subir()).get("/api/eventos/evento-1").expect(404, { error: erro.message });
  });
});

describe("PATCH /api/eventos/:id", () => {
  it("atualiza e devolve o evento recarregado", async () => {
    service.atualizar.mockResolvedValue(undefined);

    await request(await subir())
      .patch("/api/eventos/evento-1")
      .send({ titulo: "Audiência remarcada" })
      .expect(200, { evento: { id: "evento-1", titulo: "Audiência", podeEditar: true } });
    // Sem defaults no PATCH: só o que veio no corpo chega ao service.
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "evento-1", { titulo: "Audiência remarcada" });
    expect(service.obter).toHaveBeenCalledWith(CTX_OWNER, "evento-1");
  });

  it("responde 400 para corpo inválido", async () => {
    await request(await subir()).patch("/api/eventos/evento-1").send({ inicio: "ontem" }).expect(400);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("responde 403 para quem não é autor nem gestor (RN34)", async () => {
    service.atualizar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).patch("/api/eventos/evento-1").send({ titulo: "Remarcado" }).expect(403);
  });

  it("responde 422 quando a modalidade fica inconsistente (RN32)", async () => {
    service.atualizar.mockRejectedValue(new ModalidadeEventoInvalidaError("Informe o link da reunião."));

    await request(await subir()).patch("/api/eventos/evento-1").send({ modalidade: "online" }).expect(422);
  });
});

describe("DELETE /api/eventos/:id", () => {
  it("exclui e responde { ok: true }", async () => {
    service.excluir.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/eventos/evento-1").expect(200, { ok: true });
    expect(service.excluir).toHaveBeenCalledWith(CTX_OWNER, "evento-1");
  });

  it.each([
    [new PermissaoNegadaError(), 403],
    [new EventoNaoEncontradoError(), 404],
  ])("mapeia %p para %i", async (erro, status) => {
    service.excluir.mockRejectedValue(erro);

    await request(await subir()).delete("/api/eventos/evento-1").expect(status);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- eventos`
Expected: FAIL — `Cannot find module './eventos.module'`.

- [ ] **Step 3: Implementar**

`apps/api/src/eventos/tokens.ts`:

```ts
import type { serializarEvento, serializarEventos } from "@/lib/api/serializa-evento";

export const EVENTO_SERVICE = Symbol("EVENTO_SERVICE");

// Os serializadores assinam URLs de avatar no S3 (via usuarioService); entrar por
// token permite trocá-los nos testes sem jest.mock de módulo.
export const SERIALIZADOR_EVENTO = Symbol("SERIALIZADOR_EVENTO");

export interface SerializadorEvento {
  serializarEvento: typeof serializarEvento;
  serializarEventos: typeof serializarEventos;
}
```

`apps/api/src/eventos/eventos.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe, DadosInvalidosError } from "../comum/validacao.pipe";
import { searchParamsDaRequisicao } from "../comum/query";
import { EVENTO_SERVICE, SERIALIZADOR_EVENTO, type SerializadorEvento } from "./tokens";
import {
  novoEventoSchema,
  edicaoEventoSchema,
  parseFiltrosEventosDaQuery,
} from "@/lib/api/schemas-evento";
import { tratarErroDeEvento } from "@/lib/api/erros-evento";
import type {
  eventoService,
  DadosNovoEvento,
  DadosEdicaoEvento,
} from "@/services/evento.service";
import type { EventoComRelacoes } from "@/repositories/evento.repository";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Agenda compartilhada do escritório (RN31). `podeEditar` de cada evento é resolvido
// com o membro da sessão (RN34) e viaja no DTO.
@Controller("eventos")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeEvento]))
export class EventosController {
  constructor(
    @Inject(EVENTO_SERVICE) private readonly service: typeof eventoService,
    @Inject(SERIALIZADOR_EVENTO) private readonly serializador: SerializadorEvento
  ) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const filtros = parseFiltrosEventosDaQuery(searchParamsDaRequisicao(req));
    if (!filtros.success) {
      throw new DadosInvalidosError(filtros.error);
    }

    const membro = await this.service.membroAtual(ctx);
    const eventos = await this.service.listarNoPeriodo(ctx, {
      inicio: new Date(filtros.data.inicio),
      fim: new Date(filtros.data.fim),
    });

    return {
      eventos: await this.serializador.serializarEventos(eventos, (evento) =>
        this.service.podeEditar(ctx, membro.id, evento)
      ),
    };
  }

  // 201 (padrão do @Post). Recarrega com as relações: o cliente precisa do criador e dos
  // participantes hidratados para desenhar o evento sem uma segunda chamada.
  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novoEventoSchema)) dados: DadosNovoEvento
  ) {
    const criado = await this.service.criar(ctx, dados);
    const evento = await this.service.obter(ctx, criado.id);
    return { evento: await this.serializar(ctx, evento) };
  }

  @Get(":id")
  async obter(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    const evento = await this.service.obter(ctx, id);
    return { evento: await this.serializar(ctx, evento) };
  }

  @Patch(":id")
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(edicaoEventoSchema)) dados: DadosEdicaoEvento
  ) {
    await this.service.atualizar(ctx, id, dados);
    const evento = await this.service.obter(ctx, id);
    return { evento: await this.serializar(ctx, evento) };
  }

  @Delete(":id")
  @HttpCode(200)
  async excluir(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.excluir(ctx, id);
    return { ok: true };
  }

  private async serializar(ctx: TenantContext, evento: EventoComRelacoes) {
    const membro = await this.service.membroAtual(ctx);
    return this.serializador.serializarEvento(evento, (e) =>
      this.service.podeEditar(ctx, membro.id, e)
    );
  }
}
```

`apps/api/src/eventos/eventos.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { EventosController } from "./eventos.controller";
import { EVENTO_SERVICE, SERIALIZADOR_EVENTO } from "./tokens";
import { eventoService } from "@/services/evento.service";
import { serializarEvento, serializarEventos } from "@/lib/api/serializa-evento";

@Module({
  controllers: [EventosController],
  providers: [
    { provide: EVENTO_SERVICE, useValue: eventoService },
    { provide: SERIALIZADOR_EVENTO, useValue: { serializarEvento, serializarEventos } },
  ],
})
export class EventosModule {}
```

Ordem das chamadas por rota (igual à rota Next): `POST` → `criar`, `obter`, `membroAtual`; `GET :id` → `obter`, `membroAtual`; `PATCH` → `atualizar`, `obter`, `membroAtual`. Um `EventoNaoEncontradoError` em `obter` continua respondendo 404 antes de qualquer serialização.

- [ ] **Step 4: Rodar os testes do módulo**

Run: `npm run api:test -- eventos && npm run api:typecheck`
Expected: PASS; typecheck sem erros. Se o typecheck reclamar do tipo do corpo (`DadosNovoEvento` vs. saída do `novoEventoSchema`), conferir com `grep -n "eventoService.criar(ctx, parsed.data)" -r src` — a rota Next passa exatamente a saída do schema ao service, então os tipos são compatíveis; o ajuste é no tipo do parâmetro do handler, nunca no schema.

- [ ] **Step 5: Registrar no AppModule e no rewrite**

Em `apps/api/src/app.module.ts`:

```ts
import { EventosModule } from "./eventos/eventos.module";
```

e `EventosModule` ao final do array `imports`. Em `next.config.ts`, ao final de `ROTAS_NA_API_NEST`:

```ts
  "eventos",
```

- [ ] **Step 6: Verificar ponta a ponta**

Com API e Next de pé: `npx playwright test e2e/agenda.spec.ts`.
Expected: PASS (criar, editar nas visões de mês/semana/dia e excluir evento).

- [ ] **Step 7: Remover as rotas Next substituídas**

```bash
git rm -r src/app/api/eventos
```

- [ ] **Step 8: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS (os testes de `src/lib/api/schemas-evento.test.ts` continuam no jest da raiz).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/eventos apps/api/src/app.module.ts next.config.ts
git commit -m "feat(api): agenda (eventos) servida pelo NestJS"
```

---

### Task 2.27: Módulo `documentos`

| Rota | Sucesso | Erros | Tradutores (ordem da rota Next) |
|---|---|---|---|
| `GET /api/documentos?escopo=&escopoId=` | 200 `{ documentos: DocumentoPublico[] }` | 400 query, 404 escopo alheio, 500 | cliente, caso, documento |
| `POST /api/documentos/upload-url` | **200** `{ documentoId, uploadUrl, storageKey }` | 400, 404, **502** `"Não foi possível iniciar o upload."` | cliente, caso, documento, `falhaExterna` |
| `PATCH /api/documentos/:id` | 200 `{ documento: DocumentoPublico }` | 400, 403, 404, 409 | documento |
| `DELETE /api/documentos/:id` | 200 `{ ok: true }` | 403, 404 | documento |
| `POST /api/documentos/:id/confirmar` | **201** `{ documento: DocumentoPublico }` | 400, 404, 409, 500 | cliente, caso, documento |
| `GET /api/documentos/:id/download-url?modo=anexo\|inline` | 200 `{ downloadUrl }` | 400 modo, 404, **502** `"Não foi possível gerar o link de download."` | documento, `falhaExterna` |

Lógica além do service a reproduzir: toda resposta com documento passa por `documentoParaPublico` (nunca expõe `storageKey`/`autorMembroId`); `confirmar` **descarta** `storageKey` vindo do cliente (o schema não o declara, o Zod o remove); `download-url` converte `modo === "inline"` em booleano; a lista valida `escopo`/`escopoId` a partir de `searchParams.get(...)` (ausente vira `null` → 400). Os tradutores por método reproduzem exatamente os de cada rota Next (PATCH/DELETE/download-url não mapeiam erros de cliente/caso).

**Files:**
- Create: `src/lib/api/schemas-documento.ts`, `apps/api/src/documentos/tokens.ts`, `apps/api/src/documentos/documentos.controller.ts`, `apps/api/src/documentos/documentos.module.ts`
- Test: `apps/api/src/documentos/documentos.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/documentos/route.ts`, `src/app/api/documentos/route.test.ts`, `src/app/api/documentos/upload-url/route.ts`, `src/app/api/documentos/upload-url/route.test.ts`, `src/app/api/documentos/[id]/route.ts`, `src/app/api/documentos/[id]/route.test.ts`, `src/app/api/documentos/[id]/confirmar/route.ts`, `src/app/api/documentos/[id]/confirmar/route.test.ts`, `src/app/api/documentos/[id]/download-url/route.ts`, `src/app/api/documentos/[id]/download-url/route.test.ts`

**Interfaces:**
- Consumes: Fase 1; `falhaExterna` (Task 2.21); `searchParamsDaRequisicao` (Task 2.25); `documentoService.{listarPorEscopo(ctx, escopo, escopoId), gerarUrlUpload(ctx, input), renomear(ctx, id, nome), excluir(ctx, id), confirmarUpload(ctx, id, input), gerarUrlDownload(ctx, id, inline)}`, `UploadUrlInput` e as classes de erro de `@/services/documento.service`; `tratarErroDeCliente`, `tratarErroDeCaso`, `tratarErroDeDocumento` de `@/lib/api/erros-{cliente,caso,documento}`; `documentoParaPublico` de `@/lib/documentos/publico`; `nomeArquivoSchema` de `@/lib/api/schemas-comuns`.
- Produces: `DOCUMENTO_SERVICE` (symbol), `DocumentosModule`; em `src/lib/api/schemas-documento.ts`: `escopoDocumentoSchema`, `uploadDocumentoSchema`, `confirmarUploadDocumentoSchema`, `renomearDocumentoSchema`, `modoDownloadSchema`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/documentos/documentos.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { Documento } from "@prisma/client";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { DocumentosModule } from "./documentos.module";
import { DOCUMENTO_SERVICE } from "./tokens";
import {
  DocumentoNaoEncontradoError,
  PermissaoDocumentoError,
  TamanhoInvalidoError,
  TipoInvalidoError,
} from "@/services/documento.service";
import { ClienteNaoEncontradoError } from "@/services/cliente.service";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const service = {
  listarPorEscopo: jest.fn(),
  gerarUrlUpload: jest.fn(),
  renomear: jest.fn(),
  excluir: jest.fn(),
  confirmarUpload: jest.fn(),
  gerarUrlDownload: jest.fn(),
};

const ESCOPO_ID = "550e8400-e29b-41d4-a716-446655440000";
const CRIADO_EM = new Date("2026-08-20T12:00:00.000Z");
const CORPO_UPLOAD = {
  escopo: "cliente",
  escopoId: ESCOPO_ID,
  nomeArquivo: "contrato.pdf",
  tipoArquivo: "pdf",
  tamanhoBytes: 100 * 1024,
};
const TRAVESSIAS = [["../../../etc/passwd"], ["a/b.pdf"], ["..\\windows\\system32"], [".oculto.pdf"]];

function documentoFake(sobrescrever: Partial<Documento> = {}): Documento {
  return {
    id: "doc-1",
    escritorioId: "esc-1",
    escopo: "cliente",
    escopoId: ESCOPO_ID,
    autorMembroId: "membro-1",
    nomeOriginal: "contrato.pdf",
    tipoArquivo: "pdf",
    tamanhoKb: 100,
    storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    softDeletedAt: null,
    createdAt: CRIADO_EM,
    updatedAt: CRIADO_EM,
    ...sobrescrever,
  };
}

// `storageKey` e `autorMembroId` nunca saem na resposta (expõem o layout do bucket e um
// id interno de membro, e facilitam abuso do fluxo de confirmação).
const DOCUMENTO_PUBLICO = {
  id: "doc-1",
  escopo: "cliente",
  escopoId: ESCOPO_ID,
  nomeOriginal: "contrato.pdf",
  tipoArquivo: "pdf",
  tamanhoKb: 100,
  createdAt: CRIADO_EM.toISOString(),
};

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({ imports: [DocumentosModule], ctx, overrides: [[DOCUMENTO_SERVICE, service]] });
  return app.getHttpServer();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/documentos", () => {
  it("lista os documentos do escopo sem expor campos internos", async () => {
    service.listarPorEscopo.mockResolvedValue([documentoFake()]);

    await request(await subir())
      .get(`/api/documentos?escopo=cliente&escopoId=${ESCOPO_ID}`)
      .expect(200, { documentos: [DOCUMENTO_PUBLICO] });
    expect(service.listarPorEscopo).toHaveBeenCalledWith(CTX_OWNER, "cliente", ESCOPO_ID);
  });

  it("responde 400 para query incompleta", async () => {
    const res = await request(await subir()).get("/api/documentos?escopo=cliente").expect(400);

    expect(res.body.detalhes.escopoId).toBeDefined();
    expect(service.listarPorEscopo).not.toHaveBeenCalled();
  });

  it("responde 404 quando o documento/escopo não é do escritório", async () => {
    const erro = new DocumentoNaoEncontradoError();
    service.listarPorEscopo.mockRejectedValue(erro);

    await request(await subir())
      .get(`/api/documentos?escopo=cliente&escopoId=${ESCOPO_ID}`)
      .expect(404, { error: erro.message });
  });

  it("mapeia cliente de outro escritório para 404", async () => {
    service.listarPorEscopo.mockRejectedValue(new ClienteNaoEncontradoError());

    await request(await subir()).get(`/api/documentos?escopo=cliente&escopoId=${ESCOPO_ID}`).expect(404);
  });

  it("responde 500 genérico para erro não mapeado", async () => {
    service.listarPorEscopo.mockRejectedValue(new Error("falha inesperada"));

    await request(await subir())
      .get(`/api/documentos?escopo=cliente&escopoId=${ESCOPO_ID}`)
      .expect(500, { error: "Não foi possível concluir a operação." });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .get(`/api/documentos?escopo=cliente&escopoId=${ESCOPO_ID}`)
      .expect(401);
  });
});

describe("POST /api/documentos/upload-url", () => {
  it("responde 200 (não 201) com documentoId, uploadUrl e storageKey", async () => {
    const resultado = {
      documentoId: "doc-1",
      uploadUrl: "https://bucket.s3.amazonaws.com/signed-put",
      storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    };
    service.gerarUrlUpload.mockResolvedValue(resultado);

    await request(await subir()).post("/api/documentos/upload-url").send(CORPO_UPLOAD).expect(200, resultado);
    expect(service.gerarUrlUpload).toHaveBeenCalledWith(CTX_OWNER, CORPO_UPLOAD);
  });

  it("responde 400 para payload incompleto", async () => {
    await request(await subir()).post("/api/documentos/upload-url").send({ escopo: "cliente" }).expect(400);
    expect(service.gerarUrlUpload).not.toHaveBeenCalled();
  });

  // Nome de arquivo entra na key do S3 e no nome da entrada do zip de "baixar todos".
  it.each(TRAVESSIAS)("recusa nome com travessia de caminho (%s) com 400", async (nomeArquivo) => {
    await request(await subir())
      .post("/api/documentos/upload-url")
      .send({ ...CORPO_UPLOAD, nomeArquivo })
      .expect(400);
    expect(service.gerarUrlUpload).not.toHaveBeenCalled();
  });

  it("mapeia TamanhoInvalidoError para 400", async () => {
    const erro = new TamanhoInvalidoError();
    service.gerarUrlUpload.mockRejectedValue(erro);

    await request(await subir())
      .post("/api/documentos/upload-url")
      .send({ ...CORPO_UPLOAD, tamanhoBytes: 10 * 1024 * 1024 + 1 })
      .expect(400, { error: erro.message });
  });

  it("mapeia ClienteNaoEncontradoError para 404", async () => {
    service.gerarUrlUpload.mockRejectedValue(new ClienteNaoEncontradoError());

    await request(await subir()).post("/api/documentos/upload-url").send(CORPO_UPLOAD).expect(404);
  });

  it("responde 502 quando o storage falha", async () => {
    service.gerarUrlUpload.mockRejectedValue(new Error("S3 fora do ar"));

    await request(await subir())
      .post("/api/documentos/upload-url")
      .send(CORPO_UPLOAD)
      .expect(502, { error: "Não foi possível iniciar o upload." });
  });
});

describe("PATCH /api/documentos/:id", () => {
  it("renomeia e devolve os campos públicos", async () => {
    service.renomear.mockResolvedValue(documentoFake({ nomeOriginal: "novo-nome.pdf" }));

    await request(await subir())
      .patch("/api/documentos/doc-1")
      .send({ nomeArquivo: "novo-nome.pdf" })
      .expect(200, { documento: { ...DOCUMENTO_PUBLICO, nomeOriginal: "novo-nome.pdf" } });
    expect(service.renomear).toHaveBeenCalledWith(CTX_OWNER, "doc-1", "novo-nome.pdf");
  });

  it.each(TRAVESSIAS)("recusa nome com travessia de caminho (%s) com 400", async (nomeArquivo) => {
    await request(await subir()).patch("/api/documentos/doc-1").send({ nomeArquivo }).expect(400);
    expect(service.renomear).not.toHaveBeenCalled();
  });

  it("responde 400 para payload vazio", async () => {
    await request(await subir()).patch("/api/documentos/doc-1").send({}).expect(400);
  });

  it.each([
    [new TipoInvalidoError(), 400],
    [new PermissaoDocumentoError(), 403],
  ])("mapeia %p para %i", async (erro, status) => {
    service.renomear.mockRejectedValue(erro);

    await request(await subir())
      .patch("/api/documentos/doc-1")
      .send({ nomeArquivo: "novo-nome.docx" })
      .expect(status, { error: erro.message });
  });
});

describe("DELETE /api/documentos/:id", () => {
  it("exclui e responde { ok: true }", async () => {
    service.excluir.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/documentos/doc-1").expect(200, { ok: true });
    expect(service.excluir).toHaveBeenCalledWith(CTX_OWNER, "doc-1");
  });

  it("mapeia PermissaoDocumentoError para 403", async () => {
    service.excluir.mockRejectedValue(new PermissaoDocumentoError());

    await request(await subir()).delete("/api/documentos/doc-1").expect(403);
  });
});

describe("POST /api/documentos/:id/confirmar", () => {
  it("confirma (201) sem repassar storageKey e devolve só os campos públicos", async () => {
    service.confirmarUpload.mockResolvedValue(documentoFake());

    await request(await subir())
      .post("/api/documentos/doc-1/confirmar")
      .send({
        ...CORPO_UPLOAD,
        storageKey: "development/esc-alheio/documentos/cliente/cli-9/doc-9-segredo.pdf",
      })
      .expect(201, { documento: DOCUMENTO_PUBLICO });
    // A key é derivada pelo service a partir do id da URL; o que o cliente mandar é descartado.
    expect(service.confirmarUpload).toHaveBeenCalledWith(CTX_OWNER, "doc-1", CORPO_UPLOAD);
  });

  it.each(TRAVESSIAS)("recusa nome com travessia de caminho (%s) com 400", async (nomeArquivo) => {
    await request(await subir())
      .post("/api/documentos/doc-1/confirmar")
      .send({ ...CORPO_UPLOAD, nomeArquivo })
      .expect(400);
    expect(service.confirmarUpload).not.toHaveBeenCalled();
  });

  it("responde 400 para payload incompleto", async () => {
    await request(await subir()).post("/api/documentos/doc-1/confirmar").send({ escopo: "cliente" }).expect(400);
  });

  it("mapeia DocumentoNaoEncontradoError para 404", async () => {
    const erro = new DocumentoNaoEncontradoError();
    service.confirmarUpload.mockRejectedValue(erro);

    await request(await subir())
      .post("/api/documentos/doc-1/confirmar")
      .send(CORPO_UPLOAD)
      .expect(404, { error: erro.message });
  });

  it("responde 500 genérico para erro não mapeado", async () => {
    service.confirmarUpload.mockRejectedValue(new Error("falha inesperada"));

    await request(await subir())
      .post("/api/documentos/doc-1/confirmar")
      .send(CORPO_UPLOAD)
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("GET /api/documentos/:id/download-url", () => {
  const URL_ASSINADA = "https://bucket.s3.amazonaws.com/signed-get";

  it("devolve a URL assinada como anexo quando não há ?modo", async () => {
    service.gerarUrlDownload.mockResolvedValue(URL_ASSINADA);

    await request(await subir()).get("/api/documentos/doc-1/download-url").expect(200, { downloadUrl: URL_ASSINADA });
    expect(service.gerarUrlDownload).toHaveBeenCalledWith(CTX_OWNER, "doc-1", false);
  });

  it("com ?modo=inline pede disposição inline", async () => {
    service.gerarUrlDownload.mockResolvedValue(URL_ASSINADA);

    await request(await subir()).get("/api/documentos/doc-1/download-url?modo=inline").expect(200);
    expect(service.gerarUrlDownload).toHaveBeenCalledWith(CTX_OWNER, "doc-1", true);
  });

  it("recusa ?modo desconhecido com 400", async () => {
    await request(await subir()).get("/api/documentos/doc-1/download-url?modo=qualquer").expect(400);
    expect(service.gerarUrlDownload).not.toHaveBeenCalled();
  });

  it("mapeia DocumentoNaoEncontradoError para 404", async () => {
    service.gerarUrlDownload.mockRejectedValue(new DocumentoNaoEncontradoError());

    await request(await subir()).get("/api/documentos/doc-alheio/download-url").expect(404);
  });

  it("responde 502 quando o storage falha", async () => {
    service.gerarUrlDownload.mockRejectedValue(new Error("S3 fora do ar"));

    await request(await subir())
      .get("/api/documentos/doc-1/download-url")
      .expect(502, { error: "Não foi possível gerar o link de download." });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- documentos`
Expected: FAIL — `Cannot find module './documentos.module'`.

- [ ] **Step 3: Extrair os schemas das rotas Next**

`src/lib/api/schemas-documento.ts`:

```ts
import { z } from "zod";
import { nomeArquivoSchema } from "@/lib/api/schemas-comuns";

const escopoSchema = z.enum(["cliente", "caso"]);
const tipoArquivoSchema = z.enum(["pdf", "docx", "jpg", "png", "jpeg"]);

// GET /api/documentos?escopo=&escopoId= — ambos obrigatórios.
export const escopoDocumentoSchema = z.object({
  escopo: escopoSchema,
  escopoId: z.uuid(),
});

// Pedido de URL assinada de upload (RN17/RN18: tamanho e tipo são revalidados no service).
export const uploadDocumentoSchema = z.object({
  escopo: escopoSchema,
  escopoId: z.uuid(),
  nomeArquivo: nomeArquivoSchema,
  tipoArquivo: tipoArquivoSchema,
  tamanhoBytes: z.number().int().positive(),
});

// Sem `storageKey`: a key é derivada pelo service a partir do id da URL, nunca enviada
// pelo cliente (senão a linha poderia apontar para um objeto arbitrário do bucket). O
// Zod descarta a chave extra.
export const confirmarUploadDocumentoSchema = uploadDocumentoSchema;

export const renomearDocumentoSchema = z.object({
  nomeArquivo: nomeArquivoSchema,
});

export const modoDownloadSchema = z.object({ modo: z.enum(["anexo", "inline"]).optional() });
```

- [ ] **Step 4: Implementar o módulo**

`apps/api/src/documentos/tokens.ts`:

```ts
export const DOCUMENTO_SERVICE = Symbol("DOCUMENTO_SERVICE");
```

`apps/api/src/documentos/documentos.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe, DadosInvalidosError } from "../comum/validacao.pipe";
import { falhaExterna } from "../comum/falha-externa";
import { searchParamsDaRequisicao } from "../comum/query";
import { DOCUMENTO_SERVICE } from "./tokens";
import {
  escopoDocumentoSchema,
  uploadDocumentoSchema,
  confirmarUploadDocumentoSchema,
  renomearDocumentoSchema,
  modoDownloadSchema,
} from "@/lib/api/schemas-documento";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { documentoParaPublico } from "@/lib/documentos/publico";
import type { documentoService, UploadUrlInput } from "@/services/documento.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Rotas que validam o escopo (cliente/caso) também mapeiam os erros desses services —
// mesma composição das rotas Next.
const TRADUTORES_COM_ESCOPO = [tratarErroDeCliente, tratarErroDeCaso, tratarErroDeDocumento];

// Documentos de cliente/caso no S3 (RN17/RN18). Toda resposta passa por
// documentoParaPublico: storageKey e autorMembroId nunca saem da API.
@Controller("documentos")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeDocumento]))
export class DocumentosController {
  constructor(@Inject(DOCUMENTO_SERVICE) private readonly service: typeof documentoService) {}

  @Get()
  @UseFilters(new ErrosHttpFilter(TRADUTORES_COM_ESCOPO))
  async listar(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const searchParams = searchParamsDaRequisicao(req);
    const parsed = escopoDocumentoSchema.safeParse({
      escopo: searchParams.get("escopo"),
      escopoId: searchParams.get("escopoId"),
    });
    if (!parsed.success) {
      throw new DadosInvalidosError(parsed.error);
    }

    const documentos = await this.service.listarPorEscopo(ctx, parsed.data.escopo, parsed.data.escopoId);
    return { documentos: documentos.map(documentoParaPublico) };
  }

  @Post("upload-url")
  @HttpCode(200)
  @UseFilters(
    new ErrosHttpFilter([...TRADUTORES_COM_ESCOPO, falhaExterna("Não foi possível iniciar o upload.")])
  )
  async gerarUrlUpload(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(uploadDocumentoSchema)) dados: UploadUrlInput
  ) {
    return this.service.gerarUrlUpload(ctx, dados);
  }

  @Patch(":id")
  async renomear(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(renomearDocumentoSchema)) dados: { nomeArquivo: string }
  ) {
    const documento = await this.service.renomear(ctx, id, dados.nomeArquivo);
    return { documento: documentoParaPublico(documento) };
  }

  @Delete(":id")
  @HttpCode(200)
  async excluir(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.excluir(ctx, id);
    return { ok: true };
  }

  // 201 (padrão do @Post), como a rota Next.
  @Post(":id/confirmar")
  @UseFilters(new ErrosHttpFilter(TRADUTORES_COM_ESCOPO))
  async confirmar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(confirmarUploadDocumentoSchema)) dados: UploadUrlInput
  ) {
    const documento = await this.service.confirmarUpload(ctx, id, dados);
    return { documento: documentoParaPublico(documento) };
  }

  @Get(":id/download-url")
  @UseFilters(
    new ErrosHttpFilter([tratarErroDeDocumento, falhaExterna("Não foi possível gerar o link de download.")])
  )
  async gerarUrlDownload(@Tenant() ctx: TenantContext, @Param("id") id: string, @Req() req: Request) {
    const parsed = modoDownloadSchema.safeParse({
      modo: searchParamsDaRequisicao(req).get("modo") ?? undefined,
    });
    if (!parsed.success) {
      throw new DadosInvalidosError(parsed.error);
    }

    const downloadUrl = await this.service.gerarUrlDownload(ctx, id, parsed.data.modo === "inline");
    return { downloadUrl };
  }
}
```

`apps/api/src/documentos/documentos.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { DocumentosController } from "./documentos.controller";
import { DOCUMENTO_SERVICE } from "./tokens";
import { documentoService } from "@/services/documento.service";

@Module({
  controllers: [DocumentosController],
  providers: [{ provide: DOCUMENTO_SERVICE, useValue: documentoService }],
})
export class DocumentosModule {}
```

- [ ] **Step 5: Rodar os testes do módulo**

Run: `npm run api:test -- documentos && npm run api:typecheck`
Expected: PASS; typecheck sem erros.

- [ ] **Step 6: Registrar no AppModule e no rewrite**

Em `apps/api/src/app.module.ts`:

```ts
import { DocumentosModule } from "./documentos/documentos.module";
```

e `DocumentosModule` ao final do array `imports`. Em `next.config.ts`, ao final de `ROTAS_NA_API_NEST`:

```ts
  "documentos",
```

- [ ] **Step 7: Verificar ponta a ponta**

Com API e Next de pé (e o bucket do `.env.local` acessível): na ficha de um cliente, enviar um PDF, visualizar (inline), baixar (anexo), renomear e excluir; repetir o envio na ficha de um processo.
Expected: todas as operações funcionam; o upload direto para o S3 continua usando a URL assinada devolvida pela API.

- [ ] **Step 8: Remover as rotas Next substituídas**

```bash
git rm -r src/app/api/documentos
```

- [ ] **Step 9: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS (`src/lib/api/erros-documento.test.ts` continua no jest da raiz).

- [ ] **Step 10: Commit**

```bash
git add src/lib/api/schemas-documento.ts apps/api/src/documentos apps/api/src/app.module.ts next.config.ts
git commit -m "feat(api): módulo documentos no NestJS com o mesmo contrato HTTP"
```

---

### Critério de pronto da parte B

- `npx jest`, `npm run api:test`, `npm run api:typecheck`, `npm run lint` e `npx tsc --noEmit` passando.
- `ROTAS_NA_API_NEST` contém, além dos itens da Fase 1 e da parte A: `"perfil"`, `"escritorios/atual"`, `"membros"`, `"convites"`, `"dashboard"`, `"eventos"`, `"documentos"`.
- `find src/app/api/perfil src/app/api/escritorios/atual src/app/api/membros src/app/api/convites src/app/api/dashboard src/app/api/eventos src/app/api/documentos -name route.ts 2>/dev/null` → vazio; `src/app/api/escritorios/route.ts` (POST com `unstable_update`) continua no Next até a Fase 3.
- Com API e Next de pé: `npm run e2e` verde (em especial `agenda.spec.ts`, `convite-colaborador.spec.ts`, `cadastro-escritorio.spec.ts`, `troca-escritorio.spec.ts`).

---

## Fase 2 — Demais módulos da API (parte C)

Escopo: integrações com a UAZAPI — `instancias`, `campanhas` e o webhook público `webhooks/uazapi` — mais os ajustes de transporte que esses módulos exigem da API Nest (limite de corpo JSON e parser próprio do webhook) e o fechamento da Fase 2.

Pré-requisitos: Fase 1 concluída (`configurarApp`, `ErrosHttpFilter`, `ValidacaoZodPipe`, `TenantGuard`, `@Tenant()`, `criarAppDeTeste`, `CTX_OWNER`, `ROTAS_NA_API_NEST`) e as partes A e B da Fase 2 já aplicadas. Os trechos de `app.module.ts`, `next.config.ts` e `criar-app.ts` abaixo mostram **o que acrescentar**: se as partes A/B já tiverem alterado esses arquivos, preservar o que elas adicionaram e só incluir as linhas novas.

Decisões específicas desta parte:

- **Contrato de sucesso idêntico**: os `POST` que no Next respondiam `200` (`instancias/sincronizar`, `instancias/:id/desconectar`, `instancias/:id/reconectar`, `campanhas/:id/controlar`, `campanhas/:id/sincronizar`, `webhooks/uazapi`) levam `@HttpCode(200)` — o padrão do Nest para `POST` é `201`. Só `POST /api/instancias` e `POST /api/campanhas` respondem `201`.
- **500 genérico**: como decidido na Fase 1, erro inesperado responde `{ error: "Não foi possível concluir a operação." }` em vez das mensagens por rota (`"Não foi possível criar a campanha."` etc.). O front já usa a mesma frase no fallback do `apiFetch`.
- **Corpo JSON até 10 MB**: `POST /api/campanhas` manda o CSV inteiro como JSON (`linhas`, até `MAX_DESTINATARIOS = 5000` linhas — ver `src/lib/api/schemas-campanha.ts`). Com 5.000 linhas de 3–4 colunas o corpo passa de 500 KB, bem acima dos 100 KB padrão do body parser do Express. O Route Handler do Next não impunha limite (o teto real era o de 4,5 MB do Vercel), então a API passa a aceitar até `10mb` em `configurarApp` — folgado o bastante para nunca ser o gargalo; o limite de negócio continua sendo o `MAX_DESTINATARIOS` do schema. Corpo acima disso responde `413 { error: "O conteúdo enviado é maior que o permitido." }` (sem isso o `PayloadTooLargeError` do body-parser cairia no 500 genérico, porque não é `HttpException`).
- **Webhook sem body parser JSON**: a UAZAPI precisa receber 2xx sempre, mesmo com corpo vazio ou não-JSON (senão desativa o webhook). No Nest o parser JSON global roda antes do roteamento e transforma JSON malformado em `BadRequestException` → 400, antes de qualquer filtro do controller. Solução: em `configurarApp`, montar `express.text({ type: () => true })` **no caminho do webhook e antes do parser JSON global**. O text parser consome o corpo como string (qualquer `content-type`), o parser JSON vê o stream já lido e não faz nada, e o controller reproduz o `JSON.parse` tolerante da rota Next. Alternativas descartadas: `rawBody: true` (só guarda uma cópia do buffer; o parser JSON continua lançando) e um `@Catch` no controller (erros de middleware global não passam pelos filtros do controller).
- **Upload de CSV não é multipart**: o browser lê o arquivo (`papaparse` no client) e envia `linhas` já parseadas em JSON, junto do nome do arquivo (`arquivoCsvNome`). Não há `multer`/`FileInterceptor` a portar.
- **`UazapiClient` não muda**: lê `UAZAPI_SERVER_URL`/`UAZAPI_ADMIN_TOKEN` de `process.env` a cada chamada; o `main.ts` da API já carrega o mesmo `.env`/`.env.local` da raiz. Os services entram no container por `useValue`, como na Fase 1, e os testes de controller substituem o service inteiro — nenhum teste da API chama a UAZAPI.

Estrutura de arquivos desta parte:

```
apps/api/src/criar-app.ts                         (modificar: limite JSON + text parser do webhook)
apps/api/src/criar-app.test.ts                    (criar)
apps/api/src/comum/erros-http.filter.ts           (modificar: 413 para corpo grande demais)
apps/api/src/comum/erros-http.filter.test.ts      (modificar: caso 413)
apps/api/src/instancias/tokens.ts                 (criar)
apps/api/src/instancias/instancias.controller.ts  (criar, + .test.ts)
apps/api/src/instancias/instancias.module.ts      (criar)
apps/api/src/campanhas/tokens.ts                  (criar)
apps/api/src/campanhas/campanhas.controller.ts    (criar, + .test.ts)
apps/api/src/campanhas/campanhas.module.ts        (criar)
apps/api/src/webhooks/uazapi-webhook.controller.ts(criar, + .test.ts)
apps/api/src/webhooks/webhooks.module.ts          (criar)
apps/api/package.json                             (modificar: dependência explícita de express)
apps/api/src/app.module.ts                        (modificar)
next.config.ts                                    (modificar: ROTAS_NA_API_NEST)
src/app/api/instancias/**, src/app/api/campanhas/**, src/app/api/webhooks/** (remover)
docs/arquitetura/migracao-nestjs.md               (modificar no fechamento)
```

---

### Task 2.40: Módulo `instancias` (instâncias de WhatsApp)

Contrato a reproduzir (rotas `src/app/api/instancias/**`, tradutor `tratarErroDeInstanciaWhatsapp`):

| Rota | Sucesso | Erros de domínio |
|---|---|---|
| `GET /api/instancias` | 200 `{ instancias }` | 502 UAZAPI |
| `POST /api/instancias` | 201 `{ instancia, qrcode?, paircode? }` | 400 Zod/JSON, 403 permissão, 409 nome duplicado, 502 |
| `POST /api/instancias/sincronizar` | 200 `{ instancias }` | 502 |
| `DELETE /api/instancias/:id` | 200 `{ ok: true }` | 404, 403, 502 |
| `GET /api/instancias/:id/status` | 200 `{ instancia }` | 404, 502 |
| `POST /api/instancias/:id/desconectar` | 200 `{ instancia }` | 404, 403, 502 |
| `POST /api/instancias/:id/reconectar` | 200 `{ instancia, qrcode?, paircode? }` | 404, 403, 502 |

`qrcode`/`paircode` ausentes (`undefined`) somem do JSON, tanto no `NextResponse.json` quanto no `res.json` do Express — mesmo corpo.

**Files:**
- Create: `apps/api/src/instancias/tokens.ts`, `apps/api/src/instancias/instancias.controller.ts`, `apps/api/src/instancias/instancias.module.ts`
- Test: `apps/api/src/instancias/instancias.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/instancias/route.ts`, `src/app/api/instancias/route.test.ts`, `src/app/api/instancias/sincronizar/route.ts`, `src/app/api/instancias/sincronizar/route.test.ts`, `src/app/api/instancias/[id]/route.ts`, `src/app/api/instancias/[id]/route.test.ts`, `src/app/api/instancias/[id]/status/route.ts`, `src/app/api/instancias/[id]/status/route.test.ts`, `src/app/api/instancias/[id]/desconectar/route.ts`, `src/app/api/instancias/[id]/desconectar/route.test.ts`, `src/app/api/instancias/[id]/reconectar/route.ts`, `src/app/api/instancias/[id]/reconectar/route.test.ts`

**Interfaces:**
- Consumes: `criarAppDeTeste`, `CTX_OWNER` (`apps/api/test/utils.ts`); `TenantGuard`, `Tenant`; `ErrosHttpFilter`, `ValidacaoZodPipe`; `instanciaWhatsappService.{listar(ctx), criarEConectar(ctx, dados: DadosNovaInstanciaWhatsapp), sincronizarTodas(ctx), excluir(ctx, id), verificarStatus(ctx, id), desconectar(ctx, id), reconectar(ctx, id)}` e `InstanciaWhatsappNaoEncontradaError`, `NomeInstanciaDuplicadoError(excluida: boolean)`, `PermissaoNegadaError` de `@/services/instancia-whatsapp.service`; `UazapiIndisponivelError` de `@/lib/external/uazapi-client`; `novaInstanciaWhatsappSchema` de `@/lib/api/schemas-instancia-whatsapp`; `tratarErroDeInstanciaWhatsapp` de `@/lib/api/erros-instancia-whatsapp`.
- Produces: `INSTANCIAS_SERVICE: symbol`, `InstanciasController`, `InstanciasModule`; prefixo `"instancias"` em `ROTAS_NA_API_NEST`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/instancias/instancias.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { InstanciasModule } from "./instancias.module";
import { INSTANCIAS_SERVICE } from "./tokens";
import {
  InstanciaWhatsappNaoEncontradaError,
  NomeInstanciaDuplicadoError,
  PermissaoNegadaError,
} from "@/services/instancia-whatsapp.service";
import { UazapiIndisponivelError } from "@/lib/external/uazapi-client";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const ERRO_500 = { error: "Não foi possível concluir a operação." };

const service = {
  listar: jest.fn(),
  criarEConectar: jest.fn(),
  sincronizarTodas: jest.fn(),
  excluir: jest.fn(),
  verificarStatus: jest.fn(),
  desconectar: jest.fn(),
  reconectar: jest.fn(),
};

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [InstanciasModule],
    ctx,
    overrides: [[INSTANCIAS_SERVICE, service]],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await app?.close();
});

function silenciarConsoleError() {
  jest.spyOn(console, "error").mockImplementation(() => {});
}

describe("GET /api/instancias", () => {
  it("responde 401 sem sessão e não chama o service (RN19)", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/instancias").expect(401);
    expect(service.listar).not.toHaveBeenCalled();
  });

  it("lista as instâncias do escritório", async () => {
    service.listar.mockResolvedValue([{ id: "instancia-1" }]);

    await request(await subir())
      .get("/api/instancias")
      .expect(200, { instancias: [{ id: "instancia-1" }] });
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER);
  });

  // Regressão herdada da rota Next: erro da UAZAPI no GET também é 502, não 500.
  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.listar.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).get("/api/instancias").expect(502, {
      error: "Não foi possível se comunicar com o WhatsApp no momento.",
    });
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.listar.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).get("/api/instancias").expect(500, ERRO_500);
  });
});

describe("POST /api/instancias", () => {
  const payloadValido = { nome: "Instância Principal" };

  it("cria e conecta a instância, respondendo 201", async () => {
    service.criarEConectar.mockResolvedValue({
      instancia: { id: "instancia-1" },
      qrcode: "qr-base64",
      paircode: "1234",
    });

    await request(await subir()).post("/api/instancias").send(payloadValido).expect(201, {
      instancia: { id: "instancia-1" },
      qrcode: "qr-base64",
      paircode: "1234",
    });
    expect(service.criarEConectar).toHaveBeenCalledWith(CTX_OWNER, { nome: "Instância Principal" });
  });

  it("omite qrcode/paircode quando a UAZAPI não devolve", async () => {
    service.criarEConectar.mockResolvedValue({ instancia: { id: "instancia-1" } });

    await request(await subir())
      .post("/api/instancias")
      .send(payloadValido)
      .expect(201, { instancia: { id: "instancia-1" } });
  });

  it("responde 400 com detalhes de campo quando o nome é vazio", async () => {
    const res = await request(await subir()).post("/api/instancias").send({ nome: "" }).expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(res.body.detalhes.nome).toBeDefined();
    expect(service.criarEConectar).not.toHaveBeenCalled();
  });

  it("responde 400 quando o body não é JSON", async () => {
    await request(await subir())
      .post("/api/instancias")
      .set("content-type", "application/json")
      .send("nao-e-json")
      .expect(400, { error: "Dados inválidos" });
    expect(service.criarEConectar).not.toHaveBeenCalled();
  });

  it("responde 403 quando o role não tem permissão de gestão", async () => {
    service.criarEConectar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).post("/api/instancias").send(payloadValido).expect(403, {
      error: "Você não tem permissão para executar esta ação.",
    });
  });

  it("responde 409 quando o nome já existe no escritório", async () => {
    service.criarEConectar.mockRejectedValue(new NomeInstanciaDuplicadoError(false));

    await request(await subir()).post("/api/instancias").send(payloadValido).expect(409, {
      error: "Já existe uma instância de WhatsApp com este nome neste escritório.",
    });
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.criarEConectar.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).post("/api/instancias").send(payloadValido).expect(502);
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.criarEConectar.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).post("/api/instancias").send(payloadValido).expect(500, ERRO_500);
  });
});

describe("POST /api/instancias/sincronizar", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).post("/api/instancias/sincronizar").expect(401);
    expect(service.sincronizarTodas).not.toHaveBeenCalled();
  });

  it("sincroniza as instâncias do escritório e responde 200 (não 201)", async () => {
    service.sincronizarTodas.mockResolvedValue([{ id: "instancia-1", status: "connected" }]);

    await request(await subir())
      .post("/api/instancias/sincronizar")
      .expect(200, { instancias: [{ id: "instancia-1", status: "connected" }] });
    expect(service.sincronizarTodas).toHaveBeenCalledWith(CTX_OWNER);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.sincronizarTodas.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).post("/api/instancias/sincronizar").expect(502);
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.sincronizarTodas.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).post("/api/instancias/sincronizar").expect(500, ERRO_500);
  });
});

describe("DELETE /api/instancias/:id", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).delete("/api/instancias/instancia-1").expect(401);
    expect(service.excluir).not.toHaveBeenCalled();
  });

  it("exclui (soft delete, RN30) e responde { ok: true }", async () => {
    service.excluir.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/instancias/instancia-1").expect(200, { ok: true });
    expect(service.excluir).toHaveBeenCalledWith(CTX_OWNER, "instancia-1");
  });

  it("responde 404 para instância de outro escritório", async () => {
    service.excluir.mockRejectedValue(new InstanciaWhatsappNaoEncontradaError());

    await request(await subir()).delete("/api/instancias/instancia-1").expect(404, {
      error: "Instância de WhatsApp não encontrada.",
    });
  });

  it("responde 403 quando o role não tem permissão de gestão", async () => {
    service.excluir.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).delete("/api/instancias/instancia-1").expect(403);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.excluir.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).delete("/api/instancias/instancia-1").expect(502);
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.excluir.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).delete("/api/instancias/instancia-1").expect(500, ERRO_500);
  });
});

describe("GET /api/instancias/:id/status", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/instancias/instancia-1/status").expect(401);
    expect(service.verificarStatus).not.toHaveBeenCalled();
  });

  it("consulta o status da instância e responde 200", async () => {
    service.verificarStatus.mockResolvedValue({ id: "instancia-1", status: "conectado" });

    await request(await subir())
      .get("/api/instancias/instancia-1/status")
      .expect(200, { instancia: { id: "instancia-1", status: "conectado" } });
    expect(service.verificarStatus).toHaveBeenCalledWith(CTX_OWNER, "instancia-1");
  });

  it("responde 404 para instância de outro escritório", async () => {
    service.verificarStatus.mockRejectedValue(new InstanciaWhatsappNaoEncontradaError());

    await request(await subir()).get("/api/instancias/instancia-1/status").expect(404);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.verificarStatus.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).get("/api/instancias/instancia-1/status").expect(502);
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.verificarStatus.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).get("/api/instancias/instancia-1/status").expect(500, ERRO_500);
  });
});

describe("POST /api/instancias/:id/desconectar", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .post("/api/instancias/instancia-1/desconectar")
      .expect(401);
    expect(service.desconectar).not.toHaveBeenCalled();
  });

  it("desconecta e responde 200 com o estado atualizado", async () => {
    service.desconectar.mockResolvedValue({ id: "instancia-1", status: "disconnected" });

    await request(await subir())
      .post("/api/instancias/instancia-1/desconectar")
      .expect(200, { instancia: { id: "instancia-1", status: "disconnected" } });
    expect(service.desconectar).toHaveBeenCalledWith(CTX_OWNER, "instancia-1");
  });

  it("responde 404 para instância de outro escritório", async () => {
    service.desconectar.mockRejectedValue(new InstanciaWhatsappNaoEncontradaError());

    await request(await subir()).post("/api/instancias/instancia-1/desconectar").expect(404);
  });

  it("responde 403 quando o role não tem permissão de gestão", async () => {
    service.desconectar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).post("/api/instancias/instancia-1/desconectar").expect(403);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.desconectar.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).post("/api/instancias/instancia-1/desconectar").expect(502);
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.desconectar.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).post("/api/instancias/instancia-1/desconectar").expect(500, ERRO_500);
  });
});

describe("POST /api/instancias/:id/reconectar", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .post("/api/instancias/instancia-1/reconectar")
      .expect(401);
    expect(service.reconectar).not.toHaveBeenCalled();
  });

  it("reconecta e responde 200 com QR e paircode", async () => {
    service.reconectar.mockResolvedValue({
      instancia: { id: "instancia-1" },
      qrcode: "qr-base64",
      paircode: "1234",
    });

    await request(await subir()).post("/api/instancias/instancia-1/reconectar").expect(200, {
      instancia: { id: "instancia-1" },
      qrcode: "qr-base64",
      paircode: "1234",
    });
    expect(service.reconectar).toHaveBeenCalledWith(CTX_OWNER, "instancia-1");
  });

  it("responde 404 para instância de outro escritório", async () => {
    service.reconectar.mockRejectedValue(new InstanciaWhatsappNaoEncontradaError());

    await request(await subir()).post("/api/instancias/instancia-1/reconectar").expect(404);
  });

  it("responde 403 quando o role não tem permissão de gestão", async () => {
    service.reconectar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).post("/api/instancias/instancia-1/reconectar").expect(403);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.reconectar.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).post("/api/instancias/instancia-1/reconectar").expect(502);
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.reconectar.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).post("/api/instancias/instancia-1/reconectar").expect(500, ERRO_500);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- instancias`
Expected: FAIL — `Cannot find module './instancias.module'`.

- [ ] **Step 3: Implementar**

`apps/api/src/instancias/tokens.ts`:

```ts
// instanciaWhatsappService é um objeto singleton do domínio: entra no container por
// useValue e é injetado por este token (mesma convenção do módulo status).
export const INSTANCIAS_SERVICE = Symbol("INSTANCIAS_SERVICE");
```

`apps/api/src/instancias/instancias.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { INSTANCIAS_SERVICE } from "./tokens";
import { novaInstanciaWhatsappSchema } from "@/lib/api/schemas-instancia-whatsapp";
import { tratarErroDeInstanciaWhatsapp } from "@/lib/api/erros-instancia-whatsapp";
import type {
  instanciaWhatsappService,
  DadosNovaInstanciaWhatsapp,
} from "@/services/instancia-whatsapp.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Instâncias UAZAPI do escritório (RN30: excluir é soft delete, feito no service).
// Os POST de ação respondem 200 como as rotas Next — o padrão do Nest seria 201.
@Controller("instancias")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeInstanciaWhatsapp]))
export class InstanciasController {
  constructor(
    @Inject(INSTANCIAS_SERVICE) private readonly service: typeof instanciaWhatsappService
  ) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { instancias: await this.service.listar(ctx) };
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novaInstanciaWhatsappSchema)) dados: DadosNovaInstanciaWhatsapp
  ) {
    const { instancia, qrcode, paircode } = await this.service.criarEConectar(ctx, dados);
    return { instancia, qrcode, paircode };
  }

  @Post("sincronizar")
  @HttpCode(200)
  async sincronizar(@Tenant() ctx: TenantContext) {
    return { instancias: await this.service.sincronizarTodas(ctx) };
  }

  @Delete(":id")
  @HttpCode(200)
  async excluir(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.excluir(ctx, id);
    return { ok: true };
  }

  @Get(":id/status")
  async status(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    return { instancia: await this.service.verificarStatus(ctx, id) };
  }

  @Post(":id/desconectar")
  @HttpCode(200)
  async desconectar(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    return { instancia: await this.service.desconectar(ctx, id) };
  }

  @Post(":id/reconectar")
  @HttpCode(200)
  async reconectar(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    const { instancia, qrcode, paircode } = await this.service.reconectar(ctx, id);
    return { instancia, qrcode, paircode };
  }
}
```

`apps/api/src/instancias/instancias.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { InstanciasController } from "./instancias.controller";
import { INSTANCIAS_SERVICE } from "./tokens";
import { instanciaWhatsappService } from "@/services/instancia-whatsapp.service";

@Module({
  controllers: [InstanciasController],
  providers: [{ provide: INSTANCIAS_SERVICE, useValue: instanciaWhatsappService }],
})
export class InstanciasModule {}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run api:test -- instancias && npm run api:typecheck`
Expected: PASS (39 testes); typecheck sem erros.

- [ ] **Step 5: Registrar no AppModule e no rewrite**

Em `apps/api/src/app.module.ts`, acrescentar o import e o módulo ao fim de `imports` (mantendo os das partes A/B):

```ts
import { InstanciasModule } from "./instancias/instancias.module";
```

```ts
@Module({
  imports: [TenantModule, StatusModule, /* …módulos das partes A e B… */ InstanciasModule],
  controllers: [SaudeController],
})
export class AppModule {}
```

Em `next.config.ts`, acrescentar `"instancias"` ao fim de `ROTAS_NA_API_NEST`:

```ts
const ROTAS_NA_API_NEST = ["status", "tipos-status", /* …partes A e B… */ "instancias"];
```

- [ ] **Step 6: Verificar ponta a ponta (UAZAPI real)**

Terminal 1: `npm run api:dev` · Terminal 2: `npm run dev` (`.env.local` com `API_NEST_URL=http://localhost:3001`, `UAZAPI_SERVER_URL` e `UAZAPI_ADMIN_TOKEN`).
Logado como owner, abrir **/instancias**: criar uma instância (QR aparece), aguardar o polling de status, desconectar, reconectar (novo QR), clicar em sincronizar e excluir.
Expected: tudo funciona como antes; nenhum `[api] erro em ...` no terminal da API; `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3000/api/instancias/sincronizar` sem cookie devolve `401`.

- [ ] **Step 7: Remover as rotas Next substituídas**

```bash
git rm -r src/app/api/instancias
```

Run: `grep -rn "app/api/instancias" src` → vazio (os hooks usam a URL `/api/instancias`, não importam a rota).

- [ ] **Step 8: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS (inclusive `src/hooks/use-instancias-whatsapp.test.ts` e os testes de `src/app/(dashboard)/instancias/_components`, que mocam `fetch`).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/instancias apps/api/src/app.module.ts next.config.ts
git commit -m "feat(api): módulo instancias de WhatsApp no NestJS com o mesmo contrato HTTP"
```

---

### Task 2.41: Limite de corpo JSON de 10 MB e resposta 413

Pré-requisito do módulo `campanhas`: o corpo de `POST /api/campanhas` carrega o CSV inteiro e passa dos 100 KB padrão do Express.

**Files:**
- Create: `apps/api/src/criar-app.test.ts`
- Modify: `apps/api/src/criar-app.ts`, `apps/api/src/comum/erros-http.filter.ts`, `apps/api/src/comum/erros-http.filter.test.ts`

**Interfaces:**
- Consumes: `configurarApp(app)` (Fase 1), `ErrosHttpFilter`.
- Produces: `export const LIMITE_CORPO_JSON = "10mb"` em `criar-app.ts`; `ErrosHttpFilter` passa a responder `413 { error: "O conteúdo enviado é maior que o permitido." }` para erros do body-parser com `type === "entity.too.large"`.

- [ ] **Step 1: Escrever os testes que falham**

`apps/api/src/criar-app.test.ts`:

```ts
import { Body, Controller, HttpCode, Post, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configurarApp } from "./criar-app";

@Controller("eco-corpo")
class EcoCorpoController {
  @Post()
  @HttpCode(200)
  eco(@Body() corpo: { linhas?: unknown[] }) {
    return { linhas: corpo.linhas?.length ?? 0 };
  }
}

describe("configurarApp — limite do corpo JSON", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [EcoCorpoController] }).compile();
    app = configurarApp(modulo.createNestApplication());
    await app.init();
  });
  afterAll(() => app.close());

  // Campanha no teto de MAX_DESTINATARIOS (5000 linhas): ~600 KB, muito acima dos 100 KB
  // padrão do body parser do Express.
  it("aceita uma campanha com 5000 destinatários", async () => {
    const linhas = Array.from({ length: 5000 }, (_, i) => ({
      Nome: `Fulano de Tal da Silva ${i}`,
      numero: "5511999999999",
      Cidade: "Florianópolis",
      Observacao: "x".repeat(40),
    }));
    expect(JSON.stringify({ linhas }).length).toBeGreaterThan(100 * 1024);

    await request(app.getHttpServer()).post("/api/eco-corpo").send({ linhas }).expect(200, { linhas: 5000 });
  });

  it("responde 413 com mensagem amigável acima de 10 MB", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    await request(app.getHttpServer())
      .post("/api/eco-corpo")
      .send({ dado: "x".repeat(11 * 1024 * 1024) })
      .expect(413, { error: "O conteúdo enviado é maior que o permitido." });
  });
});
```

Em `apps/api/src/comum/erros-http.filter.test.ts`, dentro do `describe("ErrosHttpFilter")`, acrescentar:

```ts
  it("mapeia corpo grande demais (body-parser) para 413", async () => {
    erroALancar = Object.assign(new Error("request entity too large"), {
      type: "entity.too.large",
      status: 413,
    });
    await request(app.getHttpServer())
      .get("/api/teste")
      .expect(413, { error: "O conteúdo enviado é maior que o permitido." });
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- criar-app erros-http`
Expected: FAIL — o teste de 5000 linhas recebe 500 (`PayloadTooLargeError` do limite padrão de 100 KB, não é `HttpException`); os de 413 recebem 500.

- [ ] **Step 3: Implementar o 413 no filtro**

Em `apps/api/src/comum/erros-http.filter.ts`, acrescentar após `const MENSAGEM_ERRO_INESPERADO = ...`:

```ts
const MENSAGEM_CORPO_GRANDE_DEMAIS = "O conteúdo enviado é maior que o permitido.";

// O body-parser lança um http-error (não HttpException) com type "entity.too.large"
// quando o corpo passa do limite — o Nest o repassa sem conversão aos filtros.
function corpoGrandeDemais(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { type?: unknown }).type === "entity.too.large"
  );
}
```

e, em `traduzir`, como primeira verificação:

```ts
  private traduzir(error: unknown): Response | null {
    if (corpoGrandeDemais(error)) {
      return Response.json({ error: MENSAGEM_CORPO_GRANDE_DEMAIS }, { status: 413 });
    }
    if (error instanceof DadosInvalidosError) {
      return respostaDadosInvalidos(error.zodError);
    }
    // …restante igual à Fase 1
```

- [ ] **Step 4: Implementar o limite em `configurarApp`**

`apps/api/src/criar-app.ts` (preservando o que as partes A/B tiverem acrescentado):

```ts
import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ErrosHttpFilter } from "./comum/erros-http.filter";

// POST /api/campanhas manda o CSV inteiro como JSON (até MAX_DESTINATARIOS linhas, ver
// schemas-campanha.ts) — passa fácil dos 100 KB padrão do Express. O Route Handler do
// Next não tinha limite próprio (o teto era o de 4,5 MB do Vercel); 10 MB garante que
// a API nunca seja o gargalo. O limite de negócio continua sendo o do schema.
export const LIMITE_CORPO_JSON = "10mb";

// Configuração única usada pelo main.ts e pelos testes — o teste exercita exatamente
// o mesmo prefixo/filtros/parsers que a API real.
export function configurarApp(app: INestApplication): INestApplication {
  // Registrado antes do init: o Nest não adiciona o parser JSON padrão quando já existe um.
  (app as NestExpressApplication).useBodyParser("json", { limit: LIMITE_CORPO_JSON });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ErrosHttpFilter());
  app.enableShutdownHooks();
  return app;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm run api:test && npm run api:typecheck`
Expected: PASS em todas as suítes, inclusive `erros-http.filter.test.ts` ("devolve 400 para JSON malformado de verdade" continua verde — o parser registrado por `useBodyParser` lança o mesmo `SyntaxError` que o Nest converte em `BadRequestException`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/criar-app.ts apps/api/src/criar-app.test.ts apps/api/src/comum/erros-http.filter.ts apps/api/src/comum/erros-http.filter.test.ts
git commit -m "feat(api): aceita corpo JSON de até 10 MB e responde 413 acima disso"
```

---

### Task 2.42: Módulo `campanhas` (disparo em massa)

Contrato a reproduzir (rotas `src/app/api/campanhas/**`, tradutor `tratarErroDeCampanha`):

| Rota | Sucesso | Erros de domínio |
|---|---|---|
| `GET /api/campanhas` | 200 `{ campanhas }` | — |
| `POST /api/campanhas` | 201 `{ campanha }` | 400 Zod/JSON, 400 `VariavelSemColuna`/`DestinatariosInvalidos`, 403, 404 instância de outro tenant, 409 instância desconectada, 502 |
| `GET /api/campanhas/:id?pagina=N` | 200 `{ campanha, itens, total, pagina, porPagina }` | 404 |
| `GET /api/campanhas/:id/mensagens?pagina=N` | 200 `{ mensagens, total, truncado }` | 404, 409 sem instância, 502 |
| `POST /api/campanhas/:id/sincronizar` | 200 `{ campanha }` | 404, 409, 502 |
| `POST /api/campanhas/:id/controlar` | 200 `{ campanha }` (`null` após `delete`) | 400 ação inválida/JSON, 403, 404, 409, 502 |

Lógica do handler além de chamar o service, que precisa ser reproduzida:
- `POST /api/campanhas`: `agendadaPara` chega como string ISO e é convertida para `Date`; se ausente, a chave **não** é repassada ao service.
- `GET /:id`: chama `obter` **antes** de `listarItens` (se `obter` lança 404, `listarItens` não roda) e espalha o resultado de `listarItens` na resposta.
- `?pagina=` passa por `paginaCampanhaSchema` (`z.coerce.number().int().min(1).catch(1)`): ausente, `abc`, `0` ou negativo viram `1` — nunca 400.
- `POST /:id/controlar`: corpo validado por `acaoCampanhaSchema`; responde `{ campanha: null }` quando o service devolve `null`.

**Files:**
- Create: `apps/api/src/campanhas/tokens.ts`, `apps/api/src/campanhas/campanhas.controller.ts`, `apps/api/src/campanhas/campanhas.module.ts`
- Test: `apps/api/src/campanhas/campanhas.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/campanhas/route.ts`, `src/app/api/campanhas/route.test.ts`, `src/app/api/campanhas/[id]/route.ts`, `src/app/api/campanhas/[id]/route.test.ts`, `src/app/api/campanhas/[id]/controlar/route.ts`, `src/app/api/campanhas/[id]/controlar/route.test.ts`, `src/app/api/campanhas/[id]/mensagens/route.ts`, `src/app/api/campanhas/[id]/mensagens/route.test.ts`, `src/app/api/campanhas/[id]/sincronizar/route.ts`, `src/app/api/campanhas/[id]/sincronizar/route.test.ts`

**Interfaces:**
- Consumes: Task 2.41 (`LIMITE_CORPO_JSON`); `campanhaService.{listar(ctx), criar(ctx, dados: DadosNovaCampanha), obter(ctx, id), listarItens(ctx, id, { pagina }), listarMensagens(ctx, id, { pagina }), sincronizar(ctx, id), controlar(ctx, id, acao: "stop" | "continue" | "delete")}` e `CampanhaNaoEncontradaError()`, `CampanhaSemInstanciaError()`, `DestinatariosInvalidosError(mensagem)`, `InstanciaNaoConectadaError()`, `PermissaoNegadaError()`, `VariavelSemColunaError(variaveis: string[])` de `@/services/campanha.service`; `InstanciaWhatsappNaoEncontradaError` de `@/services/instancia-whatsapp.service`; `novaCampanhaSchema`, `acaoCampanhaSchema`, `paginaCampanhaSchema` de `@/lib/api/schemas-campanha`; `tratarErroDeCampanha` de `@/lib/api/erros-campanha`.
- Produces: `CAMPANHAS_SERVICE: symbol`, `CampanhasController`, `CampanhasModule`; prefixo `"campanhas"` em `ROTAS_NA_API_NEST`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/campanhas/campanhas.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { CampanhasModule } from "./campanhas.module";
import { CAMPANHAS_SERVICE } from "./tokens";
import {
  CampanhaNaoEncontradaError,
  CampanhaSemInstanciaError,
  DestinatariosInvalidosError,
  InstanciaNaoConectadaError,
  PermissaoNegadaError,
  VariavelSemColunaError,
} from "@/services/campanha.service";
import { InstanciaWhatsappNaoEncontradaError } from "@/services/instancia-whatsapp.service";
import { UazapiIndisponivelError } from "@/lib/external/uazapi-client";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const ERRO_500 = { error: "Não foi possível concluir a operação." };

const CORPO_VALIDO = {
  nome: "Campanha de teste",
  instanciaId: "3f2c1b7e-9a4d-4c8b-9f1e-2d3a4b5c6d7e",
  mensagemTemplate: "Olá {{nome}}",
  colunaNumero: "numero",
  mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: [] } },
  delayMin: 3,
  delayMax: 6,
  linhas: [{ Nome: "Ana", numero: "5511999999999" }],
};

const service = {
  listar: jest.fn(),
  criar: jest.fn(),
  obter: jest.fn(),
  listarItens: jest.fn(),
  listarMensagens: jest.fn(),
  sincronizar: jest.fn(),
  controlar: jest.fn(),
};

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [CampanhasModule],
    ctx,
    overrides: [[CAMPANHAS_SERVICE, service]],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/campanhas", () => {
  it("responde 401 sem sessão e não chama o service (RN19)", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/campanhas").expect(401);
    expect(service.listar).not.toHaveBeenCalled();
  });

  it("lista as campanhas do escritório da sessão", async () => {
    service.listar.mockResolvedValue([{ id: "campanha-1" }]);

    await request(await subir()).get("/api/campanhas").expect(200, { campanhas: [{ id: "campanha-1" }] });
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER);
  });

  it("responde 500 genérico quando o service quebra por motivo inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.listar.mockRejectedValue(new Error("boom"));

    await request(await subir()).get("/api/campanhas").expect(500, ERRO_500);
  });
});

describe("POST /api/campanhas", () => {
  it("cria a campanha e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "campanha-1" });

    await request(await subir()).post("/api/campanhas").send(CORPO_VALIDO).expect(201, {
      campanha: { id: "campanha-1" },
    });
    expect(service.criar).toHaveBeenCalledWith(CTX_OWNER, CORPO_VALIDO);
  });

  it("converte agendadaPara de ISO para Date antes de chamar o service", async () => {
    service.criar.mockResolvedValue({ id: "campanha-1" });
    // Relativo ao agora: o schema recusa agendamento no passado.
    const daquiADuasHoras = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await request(await subir())
      .post("/api/campanhas")
      .send({ ...CORPO_VALIDO, agendadaPara: daquiADuasHoras.toISOString() })
      .expect(201);

    expect(service.criar).toHaveBeenCalledWith(
      CTX_OWNER,
      expect.objectContaining({ agendadaPara: daquiADuasHoras })
    );
  });

  it("não repassa agendadaPara quando o corpo não traz agendamento", async () => {
    service.criar.mockResolvedValue({ id: "campanha-1" });

    await request(await subir()).post("/api/campanhas").send(CORPO_VALIDO).expect(201);

    expect(service.criar.mock.calls[0][1]).not.toHaveProperty("agendadaPara");
  });

  it("recusa agendamento no passado", async () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await request(await subir())
      .post("/api/campanhas")
      .send({ ...CORPO_VALIDO, agendadaPara: ontem.toISOString() })
      .expect(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 400 com body malformado", async () => {
    await request(await subir())
      .post("/api/campanhas")
      .set("content-type", "application/json")
      .send("{nao-e-json")
      .expect(400, { error: "Dados inválidos" });
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 400 com detalhes quando falta campo obrigatório", async () => {
    const { nome: _nome, ...semNome } = CORPO_VALIDO;

    const res = await request(await subir()).post("/api/campanhas").send(semNome).expect(400);

    expect(res.body.detalhes.nome).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 400 quando delayMax é menor que delayMin", async () => {
    const res = await request(await subir())
      .post("/api/campanhas")
      .send({ ...CORPO_VALIDO, delayMin: 10, delayMax: 2 })
      .expect(400);

    expect(res.body.detalhes.delayMax).toBeDefined();
  });

  it("responde 400 quando a lista de destinatários vem vazia", async () => {
    await request(await subir()).post("/api/campanhas").send({ ...CORPO_VALIDO, linhas: [] }).expect(400);
  });

  // Depende da Task 2.41: o CSV inteiro trafega no corpo.
  it("aceita a planilha no teto de 5000 destinatários", async () => {
    service.criar.mockResolvedValue({ id: "campanha-1" });
    const linhas = Array.from({ length: 5000 }, (_, i) => ({
      Nome: `Destinatário número ${i}`,
      numero: "5511999999999",
      Cidade: "Joinville",
    }));

    await request(await subir()).post("/api/campanhas").send({ ...CORPO_VALIDO, linhas }).expect(201);
    expect(service.criar.mock.calls[0][1].linhas).toHaveLength(5000);
  });

  it.each([
    ["403", new PermissaoNegadaError(), 403],
    ["404 instância de outro escritório", new InstanciaWhatsappNaoEncontradaError(), 404],
    ["409 instância desconectada", new InstanciaNaoConectadaError(), 409],
    ["400 variável sem coluna", new VariavelSemColunaError(["nome"]), 400],
    ["400 número inválido na planilha", new DestinatariosInvalidosError("linha 2"), 400],
    ["502 UAZAPI indisponível", new UazapiIndisponivelError(), 502],
  ])("responde %s", async (_rotulo, erro, status) => {
    service.criar.mockRejectedValue(erro);

    await request(await subir())
      .post("/api/campanhas")
      .send(CORPO_VALIDO)
      .expect(status, { error: (erro as Error).message });
  });
});

describe("GET /api/campanhas/:id", () => {
  beforeEach(() => {
    service.obter.mockResolvedValue({ id: "campanha-1" });
    service.listarItens.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 50 });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/campanhas/campanha-1").expect(401);
  });

  it("devolve a campanha junto da primeira página de itens", async () => {
    await request(await subir()).get("/api/campanhas/campanha-1").expect(200, {
      campanha: { id: "campanha-1" },
      itens: [],
      total: 0,
      pagina: 1,
      porPagina: 50,
    });
    expect(service.obter).toHaveBeenCalledWith(CTX_OWNER, "campanha-1");
    expect(service.listarItens).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", { pagina: 1 });
  });

  it("respeita ?pagina=", async () => {
    await request(await subir()).get("/api/campanhas/campanha-1?pagina=3").expect(200);

    expect(service.listarItens).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", { pagina: 3 });
  });

  it.each(["abc", "0", "-2"])("trata ?pagina=%s como primeira página", async (pagina) => {
    await request(await subir()).get(`/api/campanhas/campanha-1?pagina=${pagina}`).expect(200);

    expect(service.listarItens).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", { pagina: 1 });
  });

  it("responde 404 para campanha de outro escritório sem listar itens", async () => {
    service.obter.mockRejectedValue(new CampanhaNaoEncontradaError());

    await request(await subir()).get("/api/campanhas/campanha-1").expect(404, {
      error: "Campanha não encontrada.",
    });
    expect(service.listarItens).not.toHaveBeenCalled();
  });
});

describe("GET /api/campanhas/:id/mensagens", () => {
  beforeEach(() => {
    service.listarMensagens.mockResolvedValue({
      mensagens: [{ numero: "5511999998888", status: "enviada", erro: null, enviadaEm: new Date(0) }],
      total: 1,
      truncado: false,
    });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/campanhas/campanha-1/mensagens").expect(401);
  });

  it("devolve as mensagens com datas serializadas em ISO", async () => {
    await request(await subir()).get("/api/campanhas/campanha-1/mensagens").expect(200, {
      mensagens: [
        { numero: "5511999998888", status: "enviada", erro: null, enviadaEm: "1970-01-01T00:00:00.000Z" },
      ],
      total: 1,
      truncado: false,
    });
    expect(service.listarMensagens).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", { pagina: 1 });
  });

  it("repassa a página pedida ao service", async () => {
    await request(await subir()).get("/api/campanhas/campanha-1/mensagens?pagina=3").expect(200);

    expect(service.listarMensagens).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", { pagina: 3 });
  });

  it.each(["abc", "0", "-2"])("trata ?pagina=%s como primeira página", async (pagina) => {
    await request(await subir()).get(`/api/campanhas/campanha-1/mensagens?pagina=${pagina}`).expect(200);

    expect(service.listarMensagens).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", { pagina: 1 });
  });

  it.each([
    ["404 campanha de outro escritório", new CampanhaNaoEncontradaError(), 404],
    ["409 instância não existe mais", new CampanhaSemInstanciaError(), 409],
    ["502 UAZAPI indisponível", new UazapiIndisponivelError(), 502],
  ])("responde %s", async (_rotulo, erro, status) => {
    service.listarMensagens.mockRejectedValue(erro);

    await request(await subir()).get("/api/campanhas/campanha-1/mensagens").expect(status);
  });

  it("responde 500 genérico em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.listarMensagens.mockRejectedValue(new Error("boom"));

    await request(await subir()).get("/api/campanhas/campanha-1/mensagens").expect(500, ERRO_500);
  });
});

describe("POST /api/campanhas/:id/sincronizar", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).post("/api/campanhas/campanha-1/sincronizar").expect(401);
    expect(service.sincronizar).not.toHaveBeenCalled();
  });

  it("devolve a campanha atualizada com 200 (não 201)", async () => {
    service.sincronizar.mockResolvedValue({ id: "campanha-1", logSucesso: 7 });

    await request(await subir())
      .post("/api/campanhas/campanha-1/sincronizar")
      .expect(200, { campanha: { id: "campanha-1", logSucesso: 7 } });
    expect(service.sincronizar).toHaveBeenCalledWith(CTX_OWNER, "campanha-1");
  });

  it.each([
    ["404", new CampanhaNaoEncontradaError(), 404],
    ["502", new UazapiIndisponivelError(), 502],
  ])("responde %s", async (_rotulo, erro, status) => {
    service.sincronizar.mockRejectedValue(erro);

    await request(await subir()).post("/api/campanhas/campanha-1/sincronizar").expect(status);
  });
});

describe("POST /api/campanhas/:id/controlar", () => {
  beforeEach(() => {
    service.controlar.mockResolvedValue({ id: "campanha-1" });
  });

  it("repassa a ação ao service e responde 200", async () => {
    await request(await subir())
      .post("/api/campanhas/campanha-1/controlar")
      .send({ acao: "stop" })
      .expect(200, { campanha: { id: "campanha-1" } });
    expect(service.controlar).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", "stop");
  });

  // Depois de excluir não sobra linha local; o client usa isso para tirar a campanha da lista.
  it("devolve campanha null quando a ação foi delete", async () => {
    service.controlar.mockResolvedValue(null);

    await request(await subir())
      .post("/api/campanhas/campanha-1/controlar")
      .send({ acao: "delete" })
      .expect(200, { campanha: null });
  });

  it("responde 400 para ação desconhecida", async () => {
    const res = await request(await subir())
      .post("/api/campanhas/campanha-1/controlar")
      .send({ acao: "explodir" })
      .expect(400);

    expect(res.body.detalhes.acao).toEqual(["Ação inválida."]);
    expect(service.controlar).not.toHaveBeenCalled();
  });

  it("responde 400 com body malformado", async () => {
    await request(await subir())
      .post("/api/campanhas/campanha-1/controlar")
      .set("content-type", "application/json")
      .send("{nao-e-json")
      .expect(400, { error: "Dados inválidos" });
    expect(service.controlar).not.toHaveBeenCalled();
  });

  it.each([
    ["403 sem permissão de gestão", new PermissaoNegadaError(), 403],
    ["409 campanha perdeu a instância", new CampanhaSemInstanciaError(), 409],
    ["502 UAZAPI recusou a ação", new UazapiIndisponivelError(), 502],
  ])("responde %s", async (_rotulo, erro, status) => {
    service.controlar.mockRejectedValue(erro);

    await request(await subir())
      .post("/api/campanhas/campanha-1/controlar")
      .send({ acao: "continue" })
      .expect(status);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- campanhas`
Expected: FAIL — `Cannot find module './campanhas.module'`.

- [ ] **Step 3: Implementar**

`apps/api/src/campanhas/tokens.ts`:

```ts
// campanhaService é um objeto singleton do domínio: entra no container por useValue.
export const CAMPANHAS_SERVICE = Symbol("CAMPANHAS_SERVICE");
```

`apps/api/src/campanhas/campanhas.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { CAMPANHAS_SERVICE } from "./tokens";
import {
  novaCampanhaSchema,
  acaoCampanhaSchema,
  paginaCampanhaSchema,
} from "@/lib/api/schemas-campanha";
import { tratarErroDeCampanha } from "@/lib/api/erros-campanha";
import type { campanhaService } from "@/services/campanha.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

type CorpoNovaCampanha = z.output<typeof novaCampanhaSchema>;
type CorpoAcaoCampanha = z.output<typeof acaoCampanhaSchema>;

// Campanhas de disparo em massa via UAZAPI. O CSV chega já parseado pelo browser, como
// JSON em `linhas` (até MAX_DESTINATARIOS) — por isso o limite de 10 MB em configurarApp.
@Controller("campanhas")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeCampanha]))
export class CampanhasController {
  constructor(@Inject(CAMPANHAS_SERVICE) private readonly service: typeof campanhaService) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { campanhas: await this.service.listar(ctx) };
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novaCampanhaSchema)) dados: CorpoNovaCampanha
  ) {
    // O schema valida a string ISO (e que é futura); o service trabalha com Date. Sem
    // agendamento a chave nem é repassada — a UAZAPI enfileira para envio imediato.
    const { agendadaPara, ...resto } = dados;
    const campanha = await this.service.criar(ctx, {
      ...resto,
      ...(agendadaPara ? { agendadaPara: new Date(agendadaPara) } : {}),
    });
    return { campanha };
  }

  // Campanha + página de itens numa resposta só: a tela de detalhe precisa dos dois, e
  // obter() roda antes para confirmar o tenant antes de tocar nos itens.
  @Get(":id")
  async obter(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Query("pagina", new ValidacaoZodPipe(paginaCampanhaSchema)) pagina: number
  ) {
    const campanha = await this.service.obter(ctx, id);
    const itens = await this.service.listarItens(ctx, id, { pagina });
    return { campanha, ...itens };
  }

  // Status mensagem a mensagem, consultado ao vivo na UAZAPI. Página inválida vira 1
  // (paginaCampanhaSchema usa .catch(1)), nunca 400.
  @Get(":id/mensagens")
  async mensagens(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Query("pagina", new ValidacaoZodPipe(paginaCampanhaSchema)) pagina: number
  ) {
    const { mensagens, total, truncado } = await this.service.listarMensagens(ctx, id, { pagina });
    return { mensagens, total, truncado };
  }

  @Post(":id/sincronizar")
  @HttpCode(200)
  async sincronizar(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    return { campanha: await this.service.sincronizar(ctx, id) };
  }

  // Pausar/retomar/excluir o envio na UAZAPI. Com acao="delete" a campanha deixa de
  // existir localmente e a resposta traz `campanha: null`.
  @Post(":id/controlar")
  @HttpCode(200)
  async controlar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(acaoCampanhaSchema)) corpo: CorpoAcaoCampanha
  ) {
    return { campanha: await this.service.controlar(ctx, id, corpo.acao) };
  }
}
```

`apps/api/src/campanhas/campanhas.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { CampanhasController } from "./campanhas.controller";
import { CAMPANHAS_SERVICE } from "./tokens";
import { campanhaService } from "@/services/campanha.service";

@Module({
  controllers: [CampanhasController],
  providers: [{ provide: CAMPANHAS_SERVICE, useValue: campanhaService }],
})
export class CampanhasModule {}
```

Se o typecheck reclamar que `CorpoNovaCampanha["mapeamentoVariaveis"]` não é atribuível a `DadosNovaCampanha["mapeamentoVariaveis"]`, conferir com `grep -n "ConfigVariavel" src/lib/utils/campanha-mensagem.ts` — a rota Next faz exatamente a mesma chamada com `parsed.data`, então os tipos são compatíveis; a divergência só apareceria se a pipe estivesse tipada pelo *input* do schema (`z.input`) em vez do *output*.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run api:test -- campanhas && npm run api:typecheck`
Expected: PASS; typecheck sem erros.

- [ ] **Step 5: Registrar no AppModule e no rewrite**

`apps/api/src/app.module.ts`:

```ts
import { CampanhasModule } from "./campanhas/campanhas.module";
```

```ts
@Module({
  imports: [TenantModule, StatusModule, /* …partes A e B… */ InstanciasModule, CampanhasModule],
  controllers: [SaudeController],
})
export class AppModule {}
```

`next.config.ts`:

```ts
const ROTAS_NA_API_NEST = ["status", "tipos-status", /* …partes A e B… */ "instancias", "campanhas"];
```

- [ ] **Step 6: Verificar ponta a ponta (UAZAPI real, campanha grande)**

Com API e Next de pé e uma instância **conectada** (Task 2.40):

1. Gerar uma planilha de teste com 3.000 linhas (corpo bem acima de 100 KB), usando números de teste próprios do escritório no lugar de `NUMERO_DE_TESTE`:
   ```bash
   node -e 'const n=process.argv[1];let s="Nome,numero,Cidade\n";for(let i=0;i<3000;i++)s+=`Contato ${i},${n},Florianópolis\n`;require("fs").writeFileSync("/tmp/campanha-grande.csv",s)' NUMERO_DE_TESTE
   ```
2. Em **/campanhas/nova**, subir o CSV, mapear `{{nome}}`, **agendar para daqui a 1 dia** (para não disparar de verdade) e criar.
3. Abrir o detalhe: paginação de itens (`?pagina=2`), status das mensagens, "Sincronizar", "Pausar"/"Retomar" e, por fim, "Excluir" (a campanha some da lista).

Expected: criação responde 201 sem `413`/`500`; nenhum `[api] erro em ...` no terminal da API. Se o rewrite do Next recusar o corpo grande (erro no terminal do Next antes de chegar à API), registrar o tamanho que falhou e ver a nota de risco no fim desta seção.

- [ ] **Step 7: Remover as rotas Next substituídas**

```bash
git rm -r src/app/api/campanhas
```

Run: `grep -rn "app/api/campanhas" src` → vazio.

- [ ] **Step 8: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS (inclusive `src/hooks/use-campanhas.test.ts`, que moca `fetch`).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/campanhas apps/api/src/app.module.ts next.config.ts
git commit -m "feat(api): módulo campanhas no NestJS com o mesmo contrato HTTP"
```

---

### Task 2.43: Webhook público da UAZAPI

Contrato a reproduzir (`src/app/api/webhooks/uazapi/route.ts`): `POST /api/webhooks/uazapi` **sem sessão**, loga `console.log("[webhook uazapi]", corpo)` — objeto quando o corpo é JSON válido, string bruta quando não é, `null` quando vazio — e responde **sempre** `200 { ok: true }`, inclusive para corpo vazio, não-JSON ou JSON malformado com `content-type: application/json`.

**Files:**
- Create: `apps/api/src/webhooks/uazapi-webhook.controller.ts`, `apps/api/src/webhooks/webhooks.module.ts`
- Test: `apps/api/src/webhooks/uazapi-webhook.controller.test.ts`
- Modify: `apps/api/src/criar-app.ts`, `apps/api/package.json`, `apps/api/src/app.module.ts`, `next.config.ts`
- Delete: `src/app/api/webhooks/uazapi/route.ts`, `src/app/api/webhooks/uazapi/route.test.ts`

**Interfaces:**
- Consumes: `configurarApp` (Task 2.41), `criarAppDeTeste`.
- Produces: `export const CAMINHO_WEBHOOK_UAZAPI = "/api/webhooks/uazapi"` e `export const LIMITE_CORPO_WEBHOOK = "10mb"` em `criar-app.ts`; `UazapiWebhookController`, `WebhooksModule`; prefixo `"webhooks/uazapi"` em `ROTAS_NA_API_NEST`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/webhooks/uazapi-webhook.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../test/utils";
import { WebhooksModule } from "./webhooks.module";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

describe("POST /api/webhooks/uazapi", () => {
  let app: INestApplication;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    // Sem sessão: se o controller tivesse TenantGuard, todas as respostas seriam 401.
    app = await criarAppDeTeste({ imports: [WebhooksModule], ctx: new NaoAutenticadoError() });
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await app.close();
  });

  it("é pública: loga o payload JSON e responde 200 { ok: true }", async () => {
    const payload = { event: "messages", instance: "abc123", data: { texto: "oi" } };

    await request(app.getHttpServer()).post("/api/webhooks/uazapi").send(payload).expect(200, { ok: true });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[webhook uazapi]"),
      expect.objectContaining(payload)
    );
  });

  it("responde 200 mesmo com corpo vazio, logando null", async () => {
    await request(app.getHttpServer()).post("/api/webhooks/uazapi").expect(200, { ok: true });

    expect(logSpy).toHaveBeenCalledWith("[webhook uazapi]", null);
  });

  it("responde 200 mesmo com corpo não-JSON, logando o texto bruto", async () => {
    await request(app.getHttpServer())
      .post("/api/webhooks/uazapi")
      .set("content-type", "text/plain")
      .send("isso não é json")
      .expect(200, { ok: true });

    expect(logSpy).toHaveBeenCalledWith("[webhook uazapi]", "isso não é json");
  });

  // O caso que o parser JSON global quebraria com 400 antes de chegar ao controller.
  it("responde 200 para JSON malformado com content-type application/json", async () => {
    await request(app.getHttpServer())
      .post("/api/webhooks/uazapi")
      .set("content-type", "application/json")
      .send("{oops")
      .expect(200, { ok: true });

    expect(logSpy).toHaveBeenCalledWith("[webhook uazapi]", "{oops");
  });

  it("não afeta o parser JSON das outras rotas", async () => {
    // Rota inexistente fora do webhook: o JSON malformado continua virando 400.
    await request(app.getHttpServer())
      .post("/api/outra-rota")
      .set("content-type", "application/json")
      .send("{oops")
      .expect(400, { error: "Dados inválidos" });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- webhooks`
Expected: FAIL — `Cannot find module './webhooks.module'`.

- [ ] **Step 3: Implementar o controller e o módulo**

`apps/api/src/webhooks/uazapi-webhook.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post } from "@nestjs/common";

// Endpoint PÚBLICO (sem TenantGuard — a UAZAPI não carrega sessão nossa), por ora só
// para observar os eventos reais antes de decidir o que persistir e como correlacionar
// com instancia_whatsapp. Sempre responde 200 para a UAZAPI não desativar o webhook,
// mesmo com corpo vazio ou não-JSON. O corpo chega como string bruta: configurarApp
// monta um text parser neste caminho antes do parser JSON global (ver criar-app.ts).
@Controller("webhooks/uazapi")
export class UazapiWebhookController {
  @Post()
  @HttpCode(200)
  receber(@Body() corpo: unknown) {
    const bruto = typeof corpo === "string" ? corpo : "";
    let payload: unknown = bruto;
    try {
      payload = bruto ? JSON.parse(bruto) : null;
    } catch {
      // corpo não-JSON: loga como texto bruto mesmo assim
    }

    console.log("[webhook uazapi]", payload);

    return { ok: true };
  }
}
```

`apps/api/src/webhooks/webhooks.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { UazapiWebhookController } from "./uazapi-webhook.controller";

@Module({
  controllers: [UazapiWebhookController],
})
export class WebhooksModule {}
```

- [ ] **Step 4: Rodar e ver o caso do JSON malformado ainda falhar**

Run: `npm run api:test -- webhooks`
Expected: FAIL em três testes — "responde 200 para JSON malformado com content-type application/json" (recebe `400 { error: "Dados inválidos" }` do parser JSON global), "é pública: loga o payload JSON…" (o corpo chega já como objeto, o controller loga `null`) e "…corpo não-JSON…" (o `text/plain` chega `undefined`). Passam os de corpo vazio e de outras rotas. Confirma que o problema está no parser global, não no controller.

- [ ] **Step 5: Montar o text parser no caminho do webhook**

Declarar a dependência explícita (o `express` hoje só chega transitivamente via `@nestjs/platform-express`). Em `apps/api/package.json`, em `"dependencies"`:

```json
"express": "^5.1.0",
```

Run: `npm install` (na raiz)

`apps/api/src/criar-app.ts` (versão final, somando a Task 2.41):

```ts
import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { text } from "express";
import { ErrosHttpFilter } from "./comum/erros-http.filter";

// POST /api/campanhas manda o CSV inteiro como JSON (até MAX_DESTINATARIOS linhas, ver
// schemas-campanha.ts) — passa fácil dos 100 KB padrão do Express. O Route Handler do
// Next não tinha limite próprio (o teto era o de 4,5 MB do Vercel); 10 MB garante que
// a API nunca seja o gargalo. O limite de negócio continua sendo o do schema.
export const LIMITE_CORPO_JSON = "10mb";

// O webhook da UAZAPI precisa responder 2xx sempre. O parser JSON global transformaria
// JSON malformado em 400 antes do roteamento (filtros de controller não alcançam erro de
// middleware), então este caminho lê o corpo como texto, de qualquer content-type, e o
// controller faz o parse tolerante. Caminho absoluto: app.use não aplica o prefixo global.
export const CAMINHO_WEBHOOK_UAZAPI = "/api/webhooks/uazapi";
export const LIMITE_CORPO_WEBHOOK = "10mb";

// Configuração única usada pelo main.ts e pelos testes — o teste exercita exatamente
// o mesmo prefixo/filtros/parsers que a API real.
export function configurarApp(app: INestApplication): INestApplication {
  const express = app as NestExpressApplication;
  // A ordem importa: o text parser do webhook consome o stream primeiro, e o parser JSON
  // seguinte vê a requisição já lida (body-parser 2: onFinished.isFinished(req)) e não faz nada.
  express.use(CAMINHO_WEBHOOK_UAZAPI, text({ type: () => true, limit: LIMITE_CORPO_WEBHOOK }));
  // Registrado antes do init: o Nest não adiciona o parser JSON padrão quando já existe um.
  express.useBodyParser("json", { limit: LIMITE_CORPO_JSON });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ErrosHttpFilter());
  app.enableShutdownHooks();
  return app;
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm run api:test && npm run api:typecheck`
Expected: PASS em todas as suítes — webhook (5 testes), `criar-app.test.ts` (limite JSON intacto) e `erros-http.filter.test.ts` (JSON malformado fora do webhook continua 400).

- [ ] **Step 7: Registrar no AppModule e no rewrite**

`apps/api/src/app.module.ts`:

```ts
import { WebhooksModule } from "./webhooks/webhooks.module";
```

```ts
@Module({
  imports: [
    TenantModule,
    StatusModule,
    /* …partes A e B… */
    InstanciasModule,
    CampanhasModule,
    WebhooksModule,
  ],
  controllers: [SaudeController],
})
export class AppModule {}
```

`next.config.ts`:

```ts
const ROTAS_NA_API_NEST = [
  "status",
  "tipos-status",
  /* …partes A e B… */
  "instancias",
  "campanhas",
  "webhooks/uazapi",
];
```

O `src/proxy.ts` do Next exclui `/api/` do matcher, então o webhook continua sem passar por autenticação no Next antes do rewrite.

- [ ] **Step 8: Verificar ponta a ponta via Next**

Com API e Next de pé:

```bash
curl -s -X POST localhost:3000/api/webhooks/uazapi -H 'content-type: application/json' -d '{"event":"messages"}'
curl -s -X POST localhost:3000/api/webhooks/uazapi -H 'content-type: application/json' -d '{oops'
curl -s -X POST localhost:3000/api/webhooks/uazapi -H 'content-length: 0'
curl -s -X POST localhost:3000/api/webhooks/uazapi -H 'content-type: text/plain' -d 'isso não é json'
```

Expected: as quatro respostas são `{"ok":true}` com status 200 (conferir com `-w "%{http_code}"`), e o terminal da API mostra `[webhook uazapi] { event: 'messages' }`, `[webhook uazapi] {oops`, `[webhook uazapi] null` e `[webhook uazapi] isso não é json`.

- [ ] **Step 9: Remover a rota Next substituída**

```bash
git rm -r src/app/api/webhooks
```

- [ ] **Step 10: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck`
Expected: tudo PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/webhooks apps/api/src/criar-app.ts apps/api/package.json package-lock.json apps/api/src/app.module.ts next.config.ts
git commit -m "feat(api): webhook público da UAZAPI no NestJS, sempre 200 mesmo com corpo inválido"
```

---

### Task 2.Z: Fechamento da Fase 2

**Files:**
- Modify: `docs/arquitetura/migracao-nestjs.md`
- Test: bateria completa + Playwright (`e2e/`)

**Interfaces:**
- Consumes: todos os módulos das partes A, B e C registrados em `AppModule` e listados em `ROTAS_NA_API_NEST`.
- Produces: Fase 2 marcada como concluída no ADR; lista final das rotas que ainda vivem no Next (entrada da Fase 3).

- [ ] **Step 1: Confirmar o que sobrou no Next**

Run: `find src/app/api -name route.ts | sort`
Expected — exatamente estas rotas (as de `perfil/**` só se a parte B as tiver deixado para a Fase 3, por dependerem da sessão NextAuth):

```
src/app/api/auth/[...nextauth]/route.ts
src/app/api/cadastro/route.ts
src/app/api/escritorios/route.ts
src/app/api/sessao/escritorio-ativo/route.ts
```

e, eventualmente:

```
src/app/api/perfil/avatar/confirmar/route.ts
src/app/api/perfil/avatar/download-url/route.ts
src/app/api/perfil/avatar/upload-url/route.ts
src/app/api/perfil/route.ts
src/app/api/perfil/senha/route.ts
```

Qualquer outra rota listada é um módulo esquecido: portar antes de seguir.

- [ ] **Step 2: Confirmar que nenhum prefixo do rewrite engole uma rota que ficou no Next**

Os rewrites são `beforeFiles` e casam por prefixo (`/api/<rota>` e `/api/<rota>/:caminho*`). Um item `"escritorios"` em `ROTAS_NA_API_NEST`, por exemplo, mandaria `POST /api/escritorios` (que fica no Next até a Fase 3) para a API, que responderia 404.

Run:

```bash
node -e '
const src = require("fs").readFileSync("next.config.ts", "utf8");
const lista = src.match(/ROTAS_NA_API_NEST\s*=\s*\[([\s\S]*?)\]/)[1];
const rotas = [...lista.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const noNext = require("child_process")
  .execSync("find src/app/api -name route.ts").toString().trim().split("\n")
  .map((f) => f.replace(/^src\/app\/api\//, "").replace(/\/route\.ts$/, ""));
const conflitos = noNext.filter((r) => rotas.some((p) => r === p || r.startsWith(p + "/")));
console.log({ rotas, conflitos });
process.exit(conflitos.length ? 1 : 0);
'
```

Expected: `conflitos: []` e exit 0. (`"escritorios/atual"` na lista é válido; `"escritorios"` puro não.)

- [ ] **Step 3: Rodar a bateria unitária inteira**

Run: `npx jest && npm run api:test && npm run api:typecheck && npm run lint && npx tsc --noEmit`
Expected: tudo PASS. Nenhum arquivo restante importa rota removida:

Run: `grep -rnE "app/api/(instancias|campanhas|webhooks)" src e2e`
Expected: vazio.

- [ ] **Step 4: Rodar o e2e com API e Next de pé**

Terminal 1: `npm run api:dev` · Terminal 2: `npm run dev` (com `API_NEST_URL=http://localhost:3001` no `.env.local`).
Terminal 3: `npm run e2e`
Expected: PASS em todos os specs (`agenda`, `cadastro-escritorio`, `casos`, `clientes`, `convite-colaborador`, `status`, `tipos-processo`, `troca-escritorio`) e nenhum `[api] erro em ...` inesperado no terminal da API. Não há spec de instâncias/campanhas (dependem da UAZAPI real) — a cobertura deles é a verificação manual das Tasks 2.40 e 2.42.

Parar a API (Ctrl+C no terminal 1) e abrir `/campanhas` e `/instancias` no browser.
Expected: as listas falham — confirma que nenhum módulo da Fase 2 ainda está sendo respondido pelo Next. Subir a API de novo.

- [ ] **Step 5: Atualizar o ADR**

Em `docs/arquitetura/migracao-nestjs.md`:

```diff
-**Status:** em andamento (branch `feature/migracao-nestjs`) — Fase 1 concluída.
+**Status:** em andamento (branch `feature/migracao-nestjs`) — Fases 1 e 2 concluídas.
```

```diff
 ## Fases
 1. Fundação da API + módulo-piloto `status`/`tipos-status` ✅
-2. Demais módulos da API
+2. Demais módulos da API ✅ — toda rota de tenant e o webhook da UAZAPI são servidos
+   pelo Nest; no Next restam só `auth/[...nextauth]`, `cadastro`,
+   `sessao/escritorio-ativo` e `escritorios` (raiz), que dependem da sessão NextAuth e
+   saem na Fase 3
 3. Autenticação nativa no Nest; remoção do NextAuth
 4. Front React + Vite; remoção do Next
 5. Consolidação: domínio dentro de `apps/api`, build/deploy, CI, documentação
```

(Se rotas de `perfil/**` tiverem ficado no Next, acrescentar `perfil` à lista dessa linha.)

```diff
 ## Convenções da API
 - Services do domínio entram no container por token (`useValue` + `@Inject(TOKEN)`).
 - Toda rota de tenant: `@UseGuards(TenantGuard)` + `@Tenant() ctx`.
 - Erros: `@UseFilters(new ErrosHttpFilter([tradutoresDoModulo]))`; validação com
   `ValidacaoZodPipe(schemaExistente)`.
 - Erro inesperado responde 500 `{ error: "Não foi possível concluir a operação." }`.
+- `POST` que não cria recurso (ações como sincronizar/desconectar/controlar) leva
+  `@HttpCode(200)`, como as rotas Next; só criação responde 201.
+- Corpo JSON aceito até 10 MB (`LIMITE_CORPO_JSON` em `criar-app.ts`, por causa do CSV
+  das campanhas); acima disso, 413 `{ error: "O conteúdo enviado é maior que o permitido." }`.
+- Rotas públicas (hoje só `POST /api/webhooks/uazapi`) não usam `TenantGuard`. O webhook
+  lê o corpo como texto (parser próprio montado antes do JSON em `configurarApp`) para
+  responder 200 mesmo com corpo vazio ou malformado.
```

- [ ] **Step 6: Commit**

```bash
git add docs/arquitetura/migracao-nestjs.md
git commit -m "docs(arquitetura): marca a Fase 2 da migração para NestJS como concluída"
```

---

**Riscos desta parte (para quem executa):**

- **Corpo grande através do rewrite do Next.** O `proxyClientMaxBodySize` (10 MB) só vale quando o `proxy.ts` roda, e o matcher dele exclui `/api/`; os rewrites externos não documentam limite próprio. Mesmo assim, o Step 6 da Task 2.42 valida uma campanha de 3.000 linhas passando pelo Next. Se falhar, o caminho é reduzir o payload (ex.: o client mandar só as colunas usadas pelo mapeamento) — não aumentar limites.
- **Parser do webhook depende da ordem de registro.** `express.use(CAMINHO_WEBHOOK_UAZAPI, text(...))` precisa vir antes de `useBodyParser("json")` em `configurarApp`; o teste "responde 200 para JSON malformado com content-type application/json" é o guarda dessa ordem. Corpo do webhook acima de 10 MB responde 413 (não 2xx) — aceitável para eventos de texto; se a UAZAPI passar a mandar mídia em base64 no corpo, rever o limite.
- **`?pagina=` repetido** (`?pagina=2&pagina=3`): o Express entrega array → `paginaCampanhaSchema` cai em `1`; o Next usava o primeiro valor (`2`). O front nunca repete o parâmetro.
- **POST sem `content-type: application/json`** em `/api/instancias`: o Next respondia `400 { error }`; o Nest responde `400 { error, detalhes: {} }` (o Zod reprova o `undefined`). Mesmo status; o `apiFetch` sempre manda JSON.

---

## Fase 3 — Autenticação nativa no Nest

Ao fim da Fase 2 o Nest já responde por todas as rotas de tenant, mas a sessão ainda nasce e é renovada pelo NextAuth (`signIn`, `unstable_update`, cookie `authjs.session-token` criptografado). Esta fase troca isso por uma sessão própria: um cookie `crm_sessao` com um JWT HS256 assinado com `jose`, emitido e limpo só pela API Nest (`/api/auth/*`, `/api/sessao/escritorio-ativo`, `/api/cadastro`, `POST /api/escritorios`) e lido pelo mesmo módulo compartilhado (`src/lib/auth/sessao-jwt.ts`) em três lugares: guards do Nest, `proxy.ts` e Server Components do Next. No fim, `next-auth` sai do projeto.

**Decisões desta fase (combinadas antes do plano):**

- Cookie `crm_sessao`: `httpOnly`, `sameSite=lax`, `path=/`, `secure` quando `NODE_ENV=production`, `maxAge` de 30 dias. Conteúdo: JWT HS256 assinado com `AUTH_SECRET` (fallback `NEXTAUTH_SECRET`), payload `{ sub: usuarioId, escritorioId: string | null }`. **Sem `role` no JWT**: o papel sai sempre do banco (RN19).
- Biblioteca `jose` (a mesma que o NextAuth já usava por baixo): roda no Nest, no `proxy.ts` (runtime Node no Next 16) e em Server Components.
- **Sessões antigas do NextAuth são invalidadas.** O cookie `authjs.session-token` é ignorado e todo usuário precisa entrar de novo depois do deploy desta fase. Migrar o cookie antigo exigiria manter `next-auth/jwt` só para descriptografá-lo, e isso contraria o objetivo da fase. Para um CRM com poucos usuários por escritório, um novo login é um custo aceitável.
- Sessão de **duração fixa de 30 dias**, sem renovação deslizante: o NextAuth renovava o cookie a cada request (`updateAge`). Aqui só login, troca de escritório e criação de escritório regravam o cookie.
- Os endpoints de sessão mantêm os mesmos contratos das rotas Next (`sessao/escritorio-ativo`, `cadastro`, `escritorios`). Os de `auth` são novos, porque o NextAuth não tinha contrato próprio do produto.

**Janela de virada (Tasks 3.5 → 3.7).** As Tasks 3.1–3.4 só acrescentam código: os endpoints novos existem no Nest, mas o Next ainda não encaminha nada para eles. As Tasks 3.5, 3.6 e 3.7 fazem a troca: em cada uma, os testes unitários ficam verdes e o commit é coerente, mas **o login ponta a ponta só volta a funcionar no fim da 3.7**. Execute as três em sequência, sem merge nem deploy entre elas. O smoke test manual fica no fim da 3.7.

**Pré-requisitos vindos da Fase 2** (verificar no início da Task 3.4):

```bash
grep -rn "export class UsuarioGuard\|export const UsuarioId\|RESOLVEDOR_USUARIO\|resolverUsuarioDaRequisicao" apps/api/src/comum/tenant
grep -n "usuarioId" apps/api/test/utils.ts
grep -n "ROTAS_NA_API_NEST" -A 25 next.config.ts
```

Esperado: `UsuarioGuard` (grava `req.usuarioId`), o decorator `@UsuarioId()`, `RESOLVEDOR_USUARIO` e `resolverUsuarioDaRequisicao(req): Promise<string>` em `apps/api/src/comum/tenant/`, e `criarAppDeTeste({ usuarioId })` aceitando `string | Error`, no mesmo padrão de `ctx`. Este plano importa o guard de `../comum/tenant/usuario.guard` e o decorator de `../comum/tenant/usuario.decorator`. Se a Fase 2 usou outros nomes de arquivo, ajuste só as linhas de import.

### Estrutura de arquivos da Fase 3

```
package.json                                   (modificar: + jose; − next-auth na Task 3.8)
next.config.ts                                 (modificar: transpilePackages + ROTAS_NA_API_NEST)
jest.config.ts                                 (modificar: remove exclusões de cobertura do NextAuth)
.env.example                                   (modificar: AUTH_SECRET, remove NEXTAUTH_URL)
src/lib/auth/sessao-jwt.ts                     (criar + .test.ts)
src/lib/auth/sessao-servidor.ts                (criar + .test.ts — Server Components)
src/lib/auth/cliente-sessao.ts                 (criar + .test.ts — browser)
src/lib/auth/tenant-context.ts                 (modificar: lê crm_sessao)
src/lib/auth/tenant-context.test.ts            (reescrever)
src/lib/api/schemas-escritorio.ts              (mover de src/app/api/escritorios/schemas.ts, se a Fase 2 ainda não moveu)
src/proxy.ts                                   (reescrever + criar src/proxy.test.ts)
src/app/(dashboard)/layout.tsx, page.tsx, casos/page.tsx, clientes/page.tsx, perfil/page.tsx (+ perfil/page.test.tsx)
src/app/(onboarding)/onboarding/page.tsx
src/app/(auth)/login/page.tsx (+ .test.tsx), src/app/(auth)/cadastro/page.tsx (+ .test.tsx)
src/components/shell/nav-usuario.tsx (+ .test.tsx), app-sidebar.test.tsx, escritorio-switcher.tsx, novo-escritorio-form.tsx (comentários)
src/app/api/cadastro, src/app/api/sessao, src/app/api/escritorios, src/app/api/auth   (remover)
src/lib/auth/config.ts (+ .test.ts), src/lib/auth/token.ts (+ .test.ts), src/types/next-auth.d.ts (remover)
apps/api/jest.config.cjs                       (modificar: transformIgnorePatterns sem next-auth)
apps/api/src/comum/sessao/cookie-sessao.ts     (criar + .test.ts)
apps/api/src/comum/tenant/ler-sessao.ts        (modificar + .test.ts)
apps/api/src/sessao/tokens.ts, schemas.ts, sessao.module.ts
apps/api/src/sessao/auth.controller.ts         (+ .test.ts) — login, logout, sessão
apps/api/src/sessao/escritorio-ativo.controller.ts (+ .test.ts)
apps/api/src/sessao/cadastro.controller.ts     (+ .test.ts)
apps/api/src/sessao/criar-escritorio.controller.ts (+ .test.ts)
apps/api/src/app.module.ts                     (modificar: + SessaoModule)
apps/api/test/sessao.ts                        (criar: helpers de cookie para testes)
e2e/sessao.spec.ts                             (criar)
docs/arquitetura/migracao-nestjs.md            (modificar)
```

Tudo que **grava** o cookie fica num módulo Nest só (`SessaoModule`, em `apps/api/src/sessao/`). Assim, quem quiser saber onde uma sessão nasce ou muda olha uma pasta.

---

### Task 3.1: Módulo compartilhado de sessão JWT (`sessao-jwt.ts`)

**Files:**
- Create: `src/lib/auth/sessao-jwt.ts`
- Test: `src/lib/auth/sessao-jwt.test.ts`
- Modify: `package.json` (dependência `jose`), `next.config.ts` (`transpilePackages`)

**Interfaces:**
- Produces:
  ```ts
  export const NOME_COOKIE_SESSAO_CRM = "crm_sessao";
  export const DURACAO_SESSAO_SEGUNDOS: number;               // 30 dias
  export interface SessaoJwt { sub: string; escritorioId: string | null }
  export interface OpcoesCookieSessao { httpOnly: boolean; sameSite: "lax"; path: string; secure: boolean; maxAge: number } // maxAge em SEGUNDOS
  export async function assinarSessao(payload: SessaoJwt): Promise<string>;
  export async function verificarSessao(token: string | null | undefined): Promise<SessaoJwt | null>;
  export function opcoesCookieSessao(): OpcoesCookieSessao;
  export function extrairTokenDoCookie(cabecalhoCookie: string | null | undefined): string | null;
  ```

- [ ] **Step 1: Declarar `jose` como dependência direta**

Hoje o `jose` só chega como dependência transitiva do `next-auth` (`npm ls jose` → `next-auth > @auth/core > jose@6.2.9`). Sem declará-lo, ele some na Task 3.8.

Run: `npm install jose@^6.2.9`
Expected: `package.json` passa a ter `"jose": "^6.2.9"` em `dependencies`, e `npm ls jose` mostra `jose@6.2.9` na raiz.

O `jose` 6 é ESM puro (`"type": "module"`). O Jest da raiz (`next/jest`) só transpila de `node_modules` o que está em `transpilePackages`. Em `next.config.ts`, acrescentar `"jose"` à lista:

```ts
  transpilePackages: ["archiver", "zip-stream", "compress-commons", "crc32-stream", "is-stream", "jose"],
```

O Jest da API (`apps/api/jest.config.cjs`) já libera `jose` em `transformIgnorePatterns` desde a Fase 1.

- [ ] **Step 2: Escrever o teste que falha**

`src/lib/auth/sessao-jwt.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { SignJWT } from "jose";
import {
  NOME_COOKIE_SESSAO_CRM,
  DURACAO_SESSAO_SEGUNDOS,
  assinarSessao,
  verificarSessao,
  opcoesCookieSessao,
  extrairTokenDoCookie,
} from "./sessao-jwt";

const SEGREDO = "segredo-de-teste-com-pelo-menos-32-caracteres";
const ambienteOriginal = { ...process.env };

function chave(segredo = SEGREDO) {
  return new TextEncoder().encode(segredo);
}

describe("sessao-jwt", () => {
  beforeEach(() => {
    process.env = { ...ambienteOriginal, AUTH_SECRET: SEGREDO };
    delete process.env.NEXTAUTH_SECRET;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  describe("assinarSessao + verificarSessao", () => {
    it("faz ida e volta com usuário e escritório", async () => {
      const token = await assinarSessao({ sub: "user-1", escritorioId: "esc-1" });

      await expect(verificarSessao(token)).resolves.toEqual({ sub: "user-1", escritorioId: "esc-1" });
    });

    it("preserva escritorioId null (usuário ainda sem escritório — onboarding)", async () => {
      const token = await assinarSessao({ sub: "user-1", escritorioId: null });

      await expect(verificarSessao(token)).resolves.toEqual({ sub: "user-1", escritorioId: null });
    });

    it("não grava role no JWT (role sempre do banco — RN19)", async () => {
      const token = await assinarSessao({ sub: "user-1", escritorioId: "esc-1" });
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

      expect(payload).not.toHaveProperty("role");
      expect(payload.exp - payload.iat).toBe(DURACAO_SESSAO_SEGUNDOS);
    });

    it("usa NEXTAUTH_SECRET quando AUTH_SECRET não está definido", async () => {
      delete process.env.AUTH_SECRET;
      process.env.NEXTAUTH_SECRET = SEGREDO;

      const token = await assinarSessao({ sub: "user-1", escritorioId: null });

      await expect(verificarSessao(token)).resolves.toEqual({ sub: "user-1", escritorioId: null });
    });

    it("lança quando nenhum segredo está configurado (erro de deploy, não sessão inválida)", async () => {
      delete process.env.AUTH_SECRET;

      await expect(assinarSessao({ sub: "user-1", escritorioId: null })).rejects.toThrow(
        "AUTH_SECRET não configurado."
      );
      await expect(verificarSessao("qualquer.coisa.aqui")).rejects.toThrow("AUTH_SECRET não configurado.");
    });
  });

  describe("verificarSessao rejeita", () => {
    it.each([undefined, null, ""])("token ausente (%p)", async (token) => {
      await expect(verificarSessao(token)).resolves.toBeNull();
    });

    it("token malformado", async () => {
      await expect(verificarSessao("nao-e-um-jwt")).resolves.toBeNull();
    });

    it("token assinado com outro segredo", async () => {
      const token = await new SignJWT({ escritorioId: "esc-1" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-1")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(chave("outro-segredo-com-pelo-menos-32-caracteres"));

      await expect(verificarSessao(token)).resolves.toBeNull();
    });

    it("token expirado", async () => {
      const agora = Math.floor(Date.now() / 1000);
      const token = await new SignJWT({ escritorioId: "esc-1" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-1")
        .setIssuedAt(agora - 120)
        .setExpirationTime(agora - 60)
        .sign(chave());

      await expect(verificarSessao(token)).resolves.toBeNull();
    });

    it("token sem sub", async () => {
      const token = await new SignJWT({ escritorioId: "esc-1" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(chave());

      await expect(verificarSessao(token)).resolves.toBeNull();
    });

    it("token com payload adulterado (assinatura não confere)", async () => {
      const token = await assinarSessao({ sub: "user-1", escritorioId: "esc-1" });
      const [cabecalho, , assinatura] = token.split(".");
      const adulterado = Buffer.from(JSON.stringify({ sub: "user-1", escritorioId: "esc-de-outro-tenant" })).toString(
        "base64url"
      );

      await expect(verificarSessao(`${cabecalho}.${adulterado}.${assinatura}`)).resolves.toBeNull();
    });

    it("escritorioId que não é string vira null", async () => {
      const token = await new SignJWT({ escritorioId: 42 })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-1")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(chave());

      await expect(verificarSessao(token)).resolves.toEqual({ sub: "user-1", escritorioId: null });
    });
  });

  describe("opcoesCookieSessao", () => {
    it("httpOnly, lax, path / e 30 dias em segundos", () => {
      process.env = { ...process.env, NODE_ENV: "development" };

      expect(opcoesCookieSessao()).toEqual({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 30 * 24 * 60 * 60,
      });
    });

    it("secure em produção", () => {
      process.env = { ...process.env, NODE_ENV: "production" };

      expect(opcoesCookieSessao().secure).toBe(true);
    });
  });

  describe("extrairTokenDoCookie", () => {
    it("acha o crm_sessao entre outros cookies", () => {
      expect(extrairTokenDoCookie(`tema=escuro; ${NOME_COOKIE_SESSAO_CRM}=abc.def.ghi; outro=1`)).toBe("abc.def.ghi");
    });

    it("ignora o cookie legado do NextAuth", () => {
      expect(extrairTokenDoCookie("authjs.session-token=xyz")).toBeNull();
    });

    it.each([undefined, null, "", `${NOME_COOKIE_SESSAO_CRM}=`])("devolve null para %p", (cabecalho) => {
      expect(extrairTokenDoCookie(cabecalho)).toBeNull();
    });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest src/lib/auth/sessao-jwt.test.ts`
Expected: FAIL com `Cannot find module './sessao-jwt'`.

- [ ] **Step 4: Implementar**

`src/lib/auth/sessao-jwt.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";

// Sessão própria do CRM (Fase 3 da migração — docs/arquitetura/migracao-nestjs.md).
// Este módulo é a única fonte de verdade de como o cookie é assinado e lido, e é usado
// em três lugares: guards da API Nest, proxy.ts e Server Components do Next.
//
// O JWT só diz QUEM é o usuário e QUAL escritório está ativo. Papel e membership vêm
// sempre do banco (resolverTenantContext), nunca daqui (RN19).

export const NOME_COOKIE_SESSAO_CRM = "crm_sessao";
export const DURACAO_SESSAO_SEGUNDOS = 30 * 24 * 60 * 60;

export interface SessaoJwt {
  sub: string;
  escritorioId: string | null;
}

export interface OpcoesCookieSessao {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  secure: boolean;
  // Em SEGUNDOS (convenção do cookies() do Next). O res.cookie do Express espera
  // milissegundos: a conversão fica em apps/api/src/comum/sessao/cookie-sessao.ts.
  maxAge: number;
}

const ALGORITMO = "HS256";

// Mesmo segredo do .env que o NextAuth usava, então nenhum ambiente precisa de
// variável nova. Sem segredo é erro de configuração: lançar em vez de tratar como
// "deslogado" evita que um deploy quebrado pareça uma sessão expirada.
function chave(): Uint8Array {
  const segredo = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!segredo) {
    throw new Error("AUTH_SECRET não configurado.");
  }
  return new TextEncoder().encode(segredo);
}

export async function assinarSessao(payload: SessaoJwt): Promise<string> {
  // iat e exp calculados do mesmo instante: o JWT expira junto com o Max-Age do cookie.
  const agora = Math.floor(Date.now() / 1000);
  return new SignJWT({ escritorioId: payload.escritorioId })
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(payload.sub)
    .setIssuedAt(agora)
    .setExpirationTime(agora + DURACAO_SESSAO_SEGUNDOS)
    .sign(chave());
}

export async function verificarSessao(token: string | null | undefined): Promise<SessaoJwt | null> {
  if (!token) return null;
  const segredo = chave();

  try {
    // `algorithms` fixo: impede downgrade para "none" ou para outro algoritmo.
    const { payload } = await jwtVerify(token, segredo, { algorithms: [ALGORITMO] });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return null;
    }
    return {
      sub: payload.sub,
      escritorioId: typeof payload.escritorioId === "string" ? payload.escritorioId : null,
    };
  } catch {
    // Assinatura inválida, expirado ou malformado: para quem chama, é só "sem sessão".
    return null;
  }
}

export function opcoesCookieSessao(): OpcoesCookieSessao {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  };
}

// O Nest não usa cookie-parser: lê o header Cookie cru. Um JWT é base64url separado por
// pontos, então não há '=' nem caracteres que o Express codifique.
export function extrairTokenDoCookie(cabecalhoCookie: string | null | undefined): string | null {
  if (!cabecalhoCookie) return null;
  for (const parte of cabecalhoCookie.split(";")) {
    const separador = parte.indexOf("=");
    if (separador === -1) continue;
    if (parte.slice(0, separador).trim() === NOME_COOKIE_SESSAO_CRM) {
      return parte.slice(separador + 1).trim() || null;
    }
  }
  return null;
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npx jest src/lib/auth/sessao-jwt.test.ts`
Expected: PASS em todos os casos.

Se o Jest reclamar de `SyntaxError: Unexpected token 'export'` vindo de `node_modules/jose`, o `transpilePackages` não foi lido. Confirme que o Step 1 editou `next.config.ts` e rode `npx jest --clearCache`.

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json next.config.ts src/lib/auth/sessao-jwt.ts src/lib/auth/sessao-jwt.test.ts
git commit -m "feat(auth): módulo de sessão JWT próprio (crm_sessao) com jose"
```

---

### Task 3.2: Helpers de cookie de sessão na API Nest

**Files:**
- Create: `apps/api/src/comum/sessao/cookie-sessao.ts`, `apps/api/test/sessao.ts`
- Test: `apps/api/src/comum/sessao/cookie-sessao.test.ts`

**Interfaces:**
- Consumes: `NOME_COOKIE_SESSAO_CRM`, `assinarSessao`, `verificarSessao`, `opcoesCookieSessao`, `extrairTokenDoCookie`, `SessaoJwt` (Task 3.1).
- Produces:
  ```ts
  // apps/api/src/comum/sessao/cookie-sessao.ts
  export async function lerSessaoDaRequisicao(req: Request): Promise<SessaoJwt | null>;
  export async function gravarCookieSessao(res: Response, payload: SessaoJwt): Promise<void>;
  export function limparCookieSessao(res: Response): void;
  // apps/api/test/sessao.ts
  export const SEGREDO_DE_TESTE: string;
  export function usarSegredoDeTeste(): void;                       // registra beforeAll/afterAll
  export async function cookieDeSessao(payload: SessaoJwt): Promise<string>; // "crm_sessao=<jwt>"
  export function setCookieDaSessao(res: { headers: Record<string, unknown> }): string | undefined;
  export function tokenDoSetCookie(setCookie: string | undefined): string | null;
  ```

- [ ] **Step 1: Criar os helpers de teste**

`apps/api/test/sessao.ts`:

```ts
import { NOME_COOKIE_SESSAO_CRM, assinarSessao, type SessaoJwt } from "@/lib/auth/sessao-jwt";

// Os testes de sessão usam JWT de verdade (assinado com este segredo) em vez de mockar
// o jose: assim o teste cobre o caminho real do cookie até o controller.
export const SEGREDO_DE_TESTE = "segredo-de-teste-com-pelo-menos-32-caracteres";

export function usarSegredoDeTeste(): void {
  const anterior = process.env.AUTH_SECRET;
  beforeAll(() => {
    process.env.AUTH_SECRET = SEGREDO_DE_TESTE;
  });
  afterAll(() => {
    if (anterior === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = anterior;
  });
}

export async function cookieDeSessao(payload: SessaoJwt): Promise<string> {
  return `${NOME_COOKIE_SESSAO_CRM}=${await assinarSessao(payload)}`;
}

export function setCookieDaSessao(res: { headers: Record<string, unknown> }): string | undefined {
  const valores = ([] as string[]).concat((res.headers["set-cookie"] as string[] | string | undefined) ?? []);
  return valores.find((cookie) => cookie.startsWith(`${NOME_COOKIE_SESSAO_CRM}=`));
}

export function tokenDoSetCookie(setCookie: string | undefined): string | null {
  if (!setCookie) return null;
  const valor = setCookie.split(";")[0].slice(NOME_COOKIE_SESSAO_CRM.length + 1);
  return valor || null;
}
```

- [ ] **Step 2: Escrever o teste que falha**

`apps/api/src/comum/sessao/cookie-sessao.test.ts`:

```ts
import { Controller, Get, Post, Req, Res } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Request, Response } from "express";
import request from "supertest";
import { configurarApp } from "../../criar-app";
import { gravarCookieSessao, lerSessaoDaRequisicao, limparCookieSessao } from "./cookie-sessao";
import { verificarSessao } from "@/lib/auth/sessao-jwt";
import { cookieDeSessao, setCookieDaSessao, tokenDoSetCookie, usarSegredoDeTeste } from "../../../test/sessao";

@Controller("cookie")
class CookieController {
  @Get()
  async ler(@Req() req: Request) {
    return { sessao: await lerSessaoDaRequisicao(req) };
  }

  @Post("gravar")
  async gravar(@Res({ passthrough: true }) res: Response) {
    await gravarCookieSessao(res, { sub: "user-1", escritorioId: "esc-1" });
    return { ok: true };
  }

  @Post("limpar")
  limpar(@Res({ passthrough: true }) res: Response) {
    limparCookieSessao(res);
    return { ok: true };
  }
}

describe("cookie-sessao", () => {
  usarSegredoDeTeste();

  async function subir() {
    const modulo = await Test.createTestingModule({ controllers: [CookieController] }).compile();
    const app = configurarApp(modulo.createNestApplication());
    await app.init();
    return app;
  }

  it("lê a sessão do header Cookie", async () => {
    const app = await subir();
    const cookie = await cookieDeSessao({ sub: "user-1", escritorioId: "esc-1" });

    await request(app.getHttpServer())
      .get("/api/cookie")
      .set("Cookie", `tema=escuro; ${cookie}`)
      .expect(200, { sessao: { sub: "user-1", escritorioId: "esc-1" } });
    await app.close();
  });

  it("devolve null sem cookie ou com o cookie legado do NextAuth", async () => {
    const app = await subir();

    await request(app.getHttpServer()).get("/api/cookie").expect(200, { sessao: null });
    await request(app.getHttpServer())
      .get("/api/cookie")
      .set("Cookie", "authjs.session-token=qualquer")
      .expect(200, { sessao: null });
    await app.close();
  });

  it("grava o cookie com httpOnly, SameSite=Lax, path / e Max-Age de 30 dias (em segundos)", async () => {
    const app = await subir();

    const res = await request(app.getHttpServer()).post("/api/cookie/gravar").expect(201);
    const setCookie = setCookieDaSessao(res);

    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=2592000");
    expect(setCookie).not.toContain("Secure");
    await expect(verificarSessao(tokenDoSetCookie(setCookie))).resolves.toEqual({
      sub: "user-1",
      escritorioId: "esc-1",
    });
    await app.close();
  });

  it("limpa o cookie com expiração no passado", async () => {
    const app = await subir();

    const res = await request(app.getHttpServer()).post("/api/cookie/limpar").expect(201);
    const setCookie = setCookieDaSessao(res);

    expect(setCookie).toMatch(/^crm_sessao=;/);
    expect(setCookie).toContain("Expires=Thu, 01 Jan 1970");
    expect(setCookie).toContain("Path=/");
    await app.close();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm run api:test -- cookie-sessao`
Expected: FAIL com `Cannot find module './cookie-sessao'`.

- [ ] **Step 4: Implementar**

`apps/api/src/comum/sessao/cookie-sessao.ts`:

```ts
import type { Request, Response } from "express";
import {
  NOME_COOKIE_SESSAO_CRM,
  assinarSessao,
  extrairTokenDoCookie,
  opcoesCookieSessao,
  verificarSessao,
  type SessaoJwt,
} from "@/lib/auth/sessao-jwt";

// Ponte entre o módulo compartilhado (src/lib/auth/sessao-jwt.ts) e o Express. Só os
// controllers do SessaoModule gravam/limpam o cookie; os guards apenas leem.

export async function lerSessaoDaRequisicao(req: Request): Promise<SessaoJwt | null> {
  return verificarSessao(extrairTokenDoCookie(req.headers.cookie));
}

export async function gravarCookieSessao(res: Response, payload: SessaoJwt): Promise<void> {
  const token = await assinarSessao(payload);
  const { maxAge, ...opcoes } = opcoesCookieSessao();
  // O Express espera maxAge em milissegundos (o Next, em segundos).
  res.cookie(NOME_COOKIE_SESSAO_CRM, token, { ...opcoes, maxAge: maxAge * 1000 });
}

export function limparCookieSessao(res: Response): void {
  // clearCookie só apaga se path/sameSite/secure baterem com os da gravação.
  const { maxAge: _maxAge, ...opcoes } = opcoesCookieSessao();
  res.clearCookie(NOME_COOKIE_SESSAO_CRM, opcoes);
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run api:test -- cookie-sessao && npm run api:typecheck`
Expected: PASS nos 4 casos; typecheck sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/comum/sessao apps/api/test/sessao.ts
git commit -m "feat(api): helpers para ler, gravar e limpar o cookie crm_sessao"
```

---

### Task 3.3: Login, logout e sessão no Nest (`/api/auth/*`)

Contrato novo (substitui `/api/auth/callback/credentials`, `/api/auth/signout` e `/api/auth/session` do NextAuth):

| Rota | Sucesso | Erros |
|---|---|---|
| `POST /api/auth/login` `{ email, senha }` | 200 `{ usuario: { id, nome, email }, escritorioId }` + `Set-Cookie: crm_sessao` | 400 `Dados inválidos`; 401 `{ error: "E-mail ou senha inválidos." }` (inclui usuário inativo — RN02a) |
| `POST /api/auth/logout` | 200 `{ ok: true }` + cookie limpo | — (idempotente, sem sessão também responde 200) |
| `GET /api/auth/sessao` | 200 `{ usuario: { id, nome, email }, escritorioId, role }` | 401 `{ error: "Sessão inválida ou expirada." }` (sem cookie, cookie inválido, usuário removido ou inativo) |

Em `GET /api/auth/sessao`, `role` vem do banco. Se o escritório do cookie não tiver mais membership do usuário, a resposta traz `escritorioId: null, role: null`, porque a rota nunca devolve um tenant ao qual o usuário não tem acesso.

**Files:**
- Create: `apps/api/src/sessao/tokens.ts`, `apps/api/src/sessao/schemas.ts`, `apps/api/src/sessao/auth.controller.ts`, `apps/api/src/sessao/sessao.module.ts`
- Test: `apps/api/src/sessao/auth.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `authorizeCredentials(email, senha): Promise<UsuarioAutenticado | null>` de `@/lib/auth/authorize` (que já chama `resolverEscritorioAtivo(usuarioId, null)`, ou seja, a membership ativa mais antiga); `usuarioService.obterPerfil(id): Promise<Usuario | null>`; `membroRepository.findByUsuarioEEscritorio(usuarioId, escritorioId)`; `NaoAutenticadoError`; helpers da Task 3.2; `criarAppDeTeste` (Fase 1).
- Produces: `AUTORIZAR_CREDENCIAIS`, `USUARIO_SERVICE`, `MEMBRO_REPOSITORY`, `MEMBRO_SERVICE`, `ESCRITORIO_SERVICE` (symbols); `loginSchema`; `AuthController`; `SessaoModule`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/sessao/auth.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../test/utils";
import { cookieDeSessao, setCookieDaSessao, tokenDoSetCookie, usarSegredoDeTeste } from "../../test/sessao";
import { SessaoModule } from "./sessao.module";
import { AUTORIZAR_CREDENCIAIS, MEMBRO_REPOSITORY, USUARIO_SERVICE } from "./tokens";
import { verificarSessao } from "@/lib/auth/sessao-jwt";

const autorizar = jest.fn();
const usuarioService = { obterPerfil: jest.fn() };
const membroRepository = { findByUsuarioEEscritorio: jest.fn() };

const USUARIO = { id: "user-1", nome: "Fulana", email: "fulana@teste.com", ativo: true };

let app: INestApplication;

async function subir() {
  app = await criarAppDeTeste({
    imports: [SessaoModule],
    overrides: [
      [AUTORIZAR_CREDENCIAIS, autorizar],
      [USUARIO_SERVICE, usuarioService],
      [MEMBRO_REPOSITORY, membroRepository],
    ],
  });
  return app.getHttpServer();
}

usarSegredoDeTeste();

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("POST /api/auth/login", () => {
  it("autentica, grava crm_sessao com o escritório inicial e devolve o usuário", async () => {
    autorizar.mockResolvedValue({
      id: "user-1",
      name: "Fulana",
      email: "fulana@teste.com",
      escritorioId: "esc-1",
      role: "owner",
    });

    const res = await request(await subir())
      .post("/api/auth/login")
      .send({ email: "fulana@teste.com", senha: "senha-forte-123" })
      .expect(200, {
        usuario: { id: "user-1", nome: "Fulana", email: "fulana@teste.com" },
        escritorioId: "esc-1",
      });

    expect(autorizar).toHaveBeenCalledWith("fulana@teste.com", "senha-forte-123");
    const setCookie = setCookieDaSessao(res);
    expect(setCookie).toContain("HttpOnly");
    // Sem role no JWT (RN19): o payload só tem sub + escritorioId.
    await expect(verificarSessao(tokenDoSetCookie(setCookie))).resolves.toEqual({
      sub: "user-1",
      escritorioId: "esc-1",
    });
  });

  it("aceita usuário sem nenhum escritório (escritorioId null → onboarding)", async () => {
    autorizar.mockResolvedValue({ id: "user-1", name: "F", email: "f@t.com", escritorioId: null, role: null });

    const res = await request(await subir())
      .post("/api/auth/login")
      .send({ email: "f@t.com", senha: "x" })
      .expect(200);

    expect(res.body.escritorioId).toBeNull();
    await expect(verificarSessao(tokenDoSetCookie(setCookieDaSessao(res)))).resolves.toEqual({
      sub: "user-1",
      escritorioId: null,
    });
  });

  it("responde 401 e não grava cookie para credenciais inválidas ou usuário inativo (RN02a)", async () => {
    autorizar.mockResolvedValue(null);

    const res = await request(await subir())
      .post("/api/auth/login")
      .send({ email: "fulana@teste.com", senha: "errada" })
      .expect(401, { error: "E-mail ou senha inválidos." });

    expect(setCookieDaSessao(res)).toBeUndefined();
  });

  it("responde 400 sem chamar a autenticação quando falta senha", async () => {
    const res = await request(await subir()).post("/api/auth/login").send({ email: "fulana@teste.com" }).expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(autorizar).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/logout", () => {
  it("limpa o cookie e responde { ok: true }, mesmo sem sessão", async () => {
    const res = await request(await subir()).post("/api/auth/logout").expect(200, { ok: true });

    expect(setCookieDaSessao(res)).toMatch(/^crm_sessao=;.*Expires=Thu, 01 Jan 1970/);
  });
});

describe("GET /api/auth/sessao", () => {
  it("devolve usuário, escritório ativo e role do banco", async () => {
    usuarioService.obterPerfil.mockResolvedValue(USUARIO);
    membroRepository.findByUsuarioEEscritorio.mockResolvedValue({ escritorioId: "esc-1", role: "admin" });

    await request(await subir())
      .get("/api/auth/sessao")
      .set("Cookie", await cookieDeSessao({ sub: "user-1", escritorioId: "esc-1" }))
      .expect(200, {
        usuario: { id: "user-1", nome: "Fulana", email: "fulana@teste.com" },
        escritorioId: "esc-1",
        role: "admin",
      });
    expect(membroRepository.findByUsuarioEEscritorio).toHaveBeenCalledWith("user-1", "esc-1");
  });

  it("não devolve escritório do qual o usuário deixou de ser membro (RN19)", async () => {
    usuarioService.obterPerfil.mockResolvedValue(USUARIO);
    membroRepository.findByUsuarioEEscritorio.mockResolvedValue(null);

    const res = await request(await subir())
      .get("/api/auth/sessao")
      .set("Cookie", await cookieDeSessao({ sub: "user-1", escritorioId: "esc-removido" }))
      .expect(200);

    expect(res.body).toMatchObject({ escritorioId: null, role: null });
  });

  it("devolve escritorioId/role null sem consultar membership quando a sessão não tem escritório", async () => {
    usuarioService.obterPerfil.mockResolvedValue(USUARIO);

    const res = await request(await subir())
      .get("/api/auth/sessao")
      .set("Cookie", await cookieDeSessao({ sub: "user-1", escritorioId: null }))
      .expect(200);

    expect(res.body).toMatchObject({ escritorioId: null, role: null });
    expect(membroRepository.findByUsuarioEEscritorio).not.toHaveBeenCalled();
  });

  it("responde 401 sem cookie", async () => {
    await request(await subir())
      .get("/api/auth/sessao")
      .expect(401, { error: "Sessão inválida ou expirada." });
    expect(usuarioService.obterPerfil).not.toHaveBeenCalled();
  });

  it("responde 401 com o cookie legado do NextAuth (sessões antigas invalidadas)", async () => {
    await request(await subir())
      .get("/api/auth/sessao")
      .set("Cookie", "authjs.session-token=qualquer")
      .expect(401);
  });

  it("responde 401 quando o usuário foi desativado depois do login", async () => {
    usuarioService.obterPerfil.mockResolvedValue({ ...USUARIO, ativo: false });

    await request(await subir())
      .get("/api/auth/sessao")
      .set("Cookie", await cookieDeSessao({ sub: "user-1", escritorioId: "esc-1" }))
      .expect(401);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- auth.controller`
Expected: FAIL com `Cannot find module './sessao.module'`.

- [ ] **Step 3: Implementar**

`apps/api/src/sessao/tokens.ts`:

```ts
// Tokens de DI do SessaoModule. Os objetos do domínio são singletons (não classes), por
// isso entram por useValue — o mesmo padrão da Fase 1.
export const AUTORIZAR_CREDENCIAIS = Symbol("AUTORIZAR_CREDENCIAIS");
export const USUARIO_SERVICE = Symbol("SESSAO_USUARIO_SERVICE");
export const MEMBRO_REPOSITORY = Symbol("SESSAO_MEMBRO_REPOSITORY");
export const MEMBRO_SERVICE = Symbol("SESSAO_MEMBRO_SERVICE");
export const ESCRITORIO_SERVICE = Symbol("SESSAO_ESCRITORIO_SERVICE");
```

`apps/api/src/sessao/schemas.ts`:

```ts
import { z } from "zod";

// Login: só forma. A validação de verdade (usuário existe, ativo, bcrypt) fica em
// authorizeCredentials — erro de credencial nunca diz qual dos dois campos errou.
export const loginSchema = z.object({
  email: z.string().min(1, "Informe o e-mail"),
  senha: z.string().min(1, "Informe a senha"),
});
export type DadosLogin = z.infer<typeof loginSchema>;
```

`apps/api/src/sessao/auth.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { gravarCookieSessao, lerSessaoDaRequisicao, limparCookieSessao } from "../comum/sessao/cookie-sessao";
import { AUTORIZAR_CREDENCIAIS, MEMBRO_REPOSITORY, USUARIO_SERVICE } from "./tokens";
import { loginSchema, type DadosLogin } from "./schemas";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";
import type { authorizeCredentials } from "@/lib/auth/authorize";
import type { usuarioService } from "@/services/usuario.service";
import type { membroRepository } from "@/repositories/membro.repository";

// Substitui o NextAuth (Fase 3). Rotas públicas: não usam TenantGuard/UsuarioGuard —
// login cria a sessão, logout funciona sem ela e /sessao responde 401 por conta própria.
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AUTORIZAR_CREDENCIAIS) private readonly autorizar: typeof authorizeCredentials,
    @Inject(USUARIO_SERVICE) private readonly usuarios: Pick<typeof usuarioService, "obterPerfil">,
    @Inject(MEMBRO_REPOSITORY)
    private readonly membros: Pick<typeof membroRepository, "findByUsuarioEEscritorio">
  ) {}

  // authorizeCredentials já recusa usuário inativo (RN02a) e escolhe o escritório inicial
  // via resolverEscritorioAtivo (membership ativa mais antiga).
  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ValidacaoZodPipe(loginSchema)) dados: DadosLogin,
    @Res({ passthrough: true }) res: Response
  ) {
    const usuario = await this.autorizar(dados.email, dados.senha);
    if (!usuario) {
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }

    await gravarCookieSessao(res, { sub: usuario.id, escritorioId: usuario.escritorioId });

    return {
      usuario: { id: usuario.id, nome: usuario.name, email: usuario.email },
      escritorioId: usuario.escritorioId,
    };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    limparCookieSessao(res);
    return { ok: true };
  }

  @Get("sessao")
  async sessao(@Req() req: Request) {
    const sessao = await lerSessaoDaRequisicao(req);
    if (!sessao) {
      throw new NaoAutenticadoError();
    }

    const usuario = await this.usuarios.obterPerfil(sessao.sub);
    if (!usuario || !usuario.ativo) {
      throw new NaoAutenticadoError();
    }

    // role sempre do banco (RN19); escritório sem membership nunca é devolvido.
    const membro = sessao.escritorioId
      ? await this.membros.findByUsuarioEEscritorio(sessao.sub, sessao.escritorioId)
      : null;

    return {
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      escritorioId: membro ? sessao.escritorioId : null,
      role: membro?.role ?? null,
    };
  }
}
```

`apps/api/src/sessao/sessao.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import {
  AUTORIZAR_CREDENCIAIS,
  ESCRITORIO_SERVICE,
  MEMBRO_REPOSITORY,
  MEMBRO_SERVICE,
  USUARIO_SERVICE,
} from "./tokens";
import { authorizeCredentials } from "@/lib/auth/authorize";
import { usuarioService } from "@/services/usuario.service";
import { membroRepository } from "@/repositories/membro.repository";
import { membroService } from "@/services/membro.service";
import { escritorioService } from "@/services/escritorio.service";

// Tudo que GRAVA o cookie crm_sessao mora aqui: login/logout, troca de escritório,
// cadastro e criação de escritório. Os demais módulos só leem a sessão via guards.
@Module({
  controllers: [AuthController],
  providers: [
    { provide: AUTORIZAR_CREDENCIAIS, useValue: authorizeCredentials },
    { provide: USUARIO_SERVICE, useValue: usuarioService },
    { provide: MEMBRO_REPOSITORY, useValue: membroRepository },
    { provide: MEMBRO_SERVICE, useValue: membroService },
    { provide: ESCRITORIO_SERVICE, useValue: escritorioService },
  ],
})
export class SessaoModule {}
```

Em `apps/api/src/app.module.ts`, acrescentar `SessaoModule` ao array `imports`, sem mexer nos módulos que já estão lá, e o import:

```ts
import { SessaoModule } from "./sessao/sessao.module";
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run api:test -- sessao && npm run api:typecheck`
Expected: PASS em todos os casos de `auth.controller.test.ts`; typecheck sem erros.

Run: `npm run api:test`
Expected: suíte inteira da API verde.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/sessao apps/api/src/app.module.ts
git commit -m "feat(api): login, logout e leitura de sessão com cookie crm_sessao"
```

---

### Task 3.4: Troca de escritório, cadastro e criação de escritório no Nest

Contratos reproduzidos das rotas Next (`src/app/api/sessao/escritorio-ativo/route.ts`, `src/app/api/cadastro/route.ts`, `src/app/api/escritorios/route.ts`):

| Rota | Sessão | Sucesso | Erros |
|---|---|---|---|
| `POST /api/sessao/escritorio-ativo` `{ escritorioId }` | `UsuarioGuard` | 200 `{ escritorioId, role }` + regrava `crm_sessao` | 401, 400 `Dados inválidos` (+`detalhes`), 403 `PermissaoNegadaError` (não é membro), 500 genérico |
| `POST /api/cadastro` `{ nome, email, senha }` | pública | 201 `{ usuario: { id, nome, email }, temEscritorio }` (não loga: o front chama `/api/auth/login` em seguida, como fazia com `signIn`) | 400, 409 `EmailJaCadastradoError`, 500 genérico |
| `POST /api/escritorios` `{ nome, oabResponsavel?, telefoneWhatsapp? }` | `UsuarioGuard` (sem `TenantGuard`, porque o usuário pode não ter escritório ainda) | 201 `{ escritorio: { id, nome }, role }` + regrava `crm_sessao` com o escritório novo | 401, 400, 500 genérico |

Mudança consciente de contrato, a mesma da Fase 1: o 500 passa a responder `"Não foi possível concluir a operação."` no lugar das mensagens por rota.

**Files:**
- Create: `apps/api/src/sessao/escritorio-ativo.controller.ts`, `apps/api/src/sessao/cadastro.controller.ts`, `apps/api/src/sessao/criar-escritorio.controller.ts`
- Test: `apps/api/src/sessao/escritorio-ativo.controller.test.ts`, `apps/api/src/sessao/cadastro.controller.test.ts`, `apps/api/src/sessao/criar-escritorio.controller.test.ts`
- Modify: `apps/api/src/sessao/schemas.ts`, `apps/api/src/sessao/sessao.module.ts`
- Move (se ainda não movido pela Fase 2): `src/app/api/escritorios/schemas.ts` → `src/lib/api/schemas-escritorio.ts`

**Interfaces:**
- Consumes: `UsuarioGuard`, `@UsuarioId()` e `criarAppDeTeste({ usuarioId })` da Fase 2; `membroService.trocarEscritorioAtivo(usuarioId, escritorioId): Promise<Membro>` (lança `PermissaoNegadaError` de `@/services/membro.service`); `usuarioService.cadastrarUsuario({ nome, email, senha }): Promise<{ usuario, temEscritorio }>` (lança `EmailJaCadastradoError`); `escritorioService.criarEscritorio(usuarioId, dados): Promise<{ escritorio, membro }>`; `criarEscritorioSchema`; `ErrosHttpFilter`, `TradutorDeErro`.
- Produces: `trocarEscritorioSchema`, `cadastroSchema`, `EscritorioAtivoController`, `CadastroController`, `CriarEscritorioController`.

- [ ] **Step 1: Conferir pré-requisitos da Fase 2 e o schema de escritório**

Run os três `grep` da seção **Pré-requisitos vindos da Fase 2**. Ajuste os imports de `UsuarioGuard`/`UsuarioId` nos controllers abaixo se os arquivos tiverem outro nome.

Run: `ls src/lib/api/schemas-escritorio.ts 2>/dev/null || git mv src/app/api/escritorios/schemas.ts src/lib/api/schemas-escritorio.ts`
Depois: `grep -rn "escritorios/schemas\|from \"\./schemas\"\|from \"\.\./schemas\"" src apps`. Troque cada import que apontava para `src/app/api/escritorios/schemas.ts` por `@/lib/api/schemas-escritorio`. Esperado: no máximo `src/app/api/escritorios/route.ts`, que é removido na Task 3.5, e algum controller da Fase 2.

- [ ] **Step 2: Escrever os testes que falham**

`apps/api/src/sessao/escritorio-ativo.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../test/utils";
import { setCookieDaSessao, tokenDoSetCookie, usarSegredoDeTeste } from "../../test/sessao";
import { SessaoModule } from "./sessao.module";
import { MEMBRO_SERVICE } from "./tokens";
import { PermissaoNegadaError } from "@/services/membro.service";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";
import { verificarSessao } from "@/lib/auth/sessao-jwt";

const membroService = { trocarEscritorioAtivo: jest.fn() };
let app: INestApplication;

async function subir(usuarioId: string | Error = "user-1") {
  app = await criarAppDeTeste({ imports: [SessaoModule], usuarioId, overrides: [[MEMBRO_SERVICE, membroService]] });
  return app.getHttpServer();
}

usarSegredoDeTeste();

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("POST /api/sessao/escritorio-ativo", () => {
  it("troca o escritório ativo validando a membership e regrava o cookie", async () => {
    membroService.trocarEscritorioAtivo.mockResolvedValue({ escritorioId: "esc-2", role: "admin" });

    const res = await request(await subir())
      .post("/api/sessao/escritorio-ativo")
      .send({ escritorioId: "esc-2" })
      .expect(200, { escritorioId: "esc-2", role: "admin" });

    expect(membroService.trocarEscritorioAtivo).toHaveBeenCalledWith("user-1", "esc-2");
    await expect(verificarSessao(tokenDoSetCookie(setCookieDaSessao(res)))).resolves.toEqual({
      sub: "user-1",
      escritorioId: "esc-2",
    });
  });

  it("responde 401 sem sessão e não chama o service", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .post("/api/sessao/escritorio-ativo")
      .send({ escritorioId: "esc-2" })
      .expect(401, { error: "Sessão inválida ou expirada." });
    expect(membroService.trocarEscritorioAtivo).not.toHaveBeenCalled();
  });

  it("responde 400 para payload inválido", async () => {
    const res = await request(await subir()).post("/api/sessao/escritorio-ativo").send({}).expect(400);

    expect(res.body).toEqual({ error: "Dados inválidos", detalhes: { escritorioId: expect.any(Array) } });
    expect(membroService.trocarEscritorioAtivo).not.toHaveBeenCalled();
  });

  it("responde 403 e não regrava o cookie quando o usuário não é membro (RN19)", async () => {
    membroService.trocarEscritorioAtivo.mockRejectedValue(new PermissaoNegadaError());

    const res = await request(await subir())
      .post("/api/sessao/escritorio-ativo")
      .send({ escritorioId: "esc-de-outro-tenant" })
      .expect(403, { error: "Você não tem permissão para executar esta ação." });

    expect(setCookieDaSessao(res)).toBeUndefined();
  });

  it("responde 500 genérico para erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    membroService.trocarEscritorioAtivo.mockRejectedValue(new Error("db fora"));

    await request(await subir())
      .post("/api/sessao/escritorio-ativo")
      .send({ escritorioId: "esc-2" })
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});
```

`apps/api/src/sessao/cadastro.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../test/utils";
import { setCookieDaSessao } from "../../test/sessao";
import { SessaoModule } from "./sessao.module";
import { USUARIO_SERVICE } from "./tokens";
import { EmailJaCadastradoError } from "@/services/usuario.service";

const usuarioService = { cadastrarUsuario: jest.fn() };
const payloadValido = { nome: "Fulano de Tal", email: "fulano@teste.com", senha: "senha-forte-123" };
let app: INestApplication;

async function subir() {
  app = await criarAppDeTeste({ imports: [SessaoModule], overrides: [[USUARIO_SERVICE, usuarioService]] });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("POST /api/cadastro", () => {
  it("cria o usuário e responde 201 sem abrir sessão (o front chama /api/auth/login)", async () => {
    usuarioService.cadastrarUsuario.mockResolvedValue({
      usuario: { id: "user-1", nome: payloadValido.nome, email: payloadValido.email, senhaHash: "x" },
      temEscritorio: false,
    });

    const res = await request(await subir())
      .post("/api/cadastro")
      .send(payloadValido)
      .expect(201, {
        usuario: { id: "user-1", nome: payloadValido.nome, email: payloadValido.email },
        temEscritorio: false,
      });

    expect(usuarioService.cadastrarUsuario).toHaveBeenCalledWith(payloadValido);
    expect(setCookieDaSessao(res)).toBeUndefined();
  });

  it("responde 400 com detalhes para senha curta", async () => {
    const res = await request(await subir())
      .post("/api/cadastro")
      .send({ ...payloadValido, senha: "curta" })
      .expect(400);

    expect(res.body.detalhes.senha).toEqual(["A senha deve ter no mínimo 8 caracteres"]);
    expect(usuarioService.cadastrarUsuario).not.toHaveBeenCalled();
  });

  it("responde 409 para e-mail já cadastrado", async () => {
    usuarioService.cadastrarUsuario.mockRejectedValue(new EmailJaCadastradoError());

    await request(await subir())
      .post("/api/cadastro")
      .send(payloadValido)
      .expect(409, { error: "Este e-mail já está cadastrado." });
  });
});
```

`apps/api/src/sessao/criar-escritorio.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../test/utils";
import { setCookieDaSessao, tokenDoSetCookie, usarSegredoDeTeste } from "../../test/sessao";
import { SessaoModule } from "./sessao.module";
import { ESCRITORIO_SERVICE } from "./tokens";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";
import { verificarSessao } from "@/lib/auth/sessao-jwt";

const escritorioService = { criarEscritorio: jest.fn() };
let app: INestApplication;

async function subir(usuarioId: string | Error = "user-1") {
  app = await criarAppDeTeste({
    imports: [SessaoModule],
    usuarioId,
    overrides: [[ESCRITORIO_SERVICE, escritorioService]],
  });
  return app.getHttpServer();
}

usarSegredoDeTeste();

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("POST /api/escritorios", () => {
  it("cria o escritório com o usuário como owner e o torna o ativo da sessão", async () => {
    escritorioService.criarEscritorio.mockResolvedValue({
      escritorio: { id: "esc-novo", nome: "Escritório Teste" },
      membro: { id: "m-1", role: "owner" },
    });

    const res = await request(await subir())
      .post("/api/escritorios")
      .send({ nome: "Escritório Teste" })
      .expect(201, { escritorio: { id: "esc-novo", nome: "Escritório Teste" }, role: "owner" });

    expect(escritorioService.criarEscritorio).toHaveBeenCalledWith("user-1", { nome: "Escritório Teste" });
    await expect(verificarSessao(tokenDoSetCookie(setCookieDaSessao(res)))).resolves.toEqual({
      sub: "user-1",
      escritorioId: "esc-novo",
    });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .post("/api/escritorios")
      .send({ nome: "Escritório Teste" })
      .expect(401);
    expect(escritorioService.criarEscritorio).not.toHaveBeenCalled();
  });

  it("responde 400 para nome vazio", async () => {
    const res = await request(await subir()).post("/api/escritorios").send({ nome: "  " }).expect(400);

    expect(res.body.detalhes.nome).toEqual(["Informe o nome do escritório"]);
  });

  it("responde 500 genérico e não regrava o cookie quando a criação falha", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    escritorioService.criarEscritorio.mockRejectedValue(new Error("db fora"));

    const res = await request(await subir())
      .post("/api/escritorios")
      .send({ nome: "Escritório Teste" })
      .expect(500, { error: "Não foi possível concluir a operação." });

    expect(setCookieDaSessao(res)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm run api:test -- sessao`
Expected: os três arquivos novos FALHAM com 404 (rotas inexistentes); `auth.controller.test.ts` continua PASS.

- [ ] **Step 4: Implementar**

Em `apps/api/src/sessao/schemas.ts`, acrescentar no fim:

```ts
// Mesmas regras das rotas Next removidas (sessao/escritorio-ativo e cadastro).
export const trocarEscritorioSchema = z.object({
  escritorioId: z.string().min(1, "Informe o escritório"),
});
export type DadosTrocaEscritorio = z.infer<typeof trocarEscritorioSchema>;

export const cadastroSchema = z.object({
  nome: z.string().min(1, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
});
export type DadosCadastro = z.infer<typeof cadastroSchema>;
```

`apps/api/src/sessao/escritorio-ativo.controller.ts`:

```ts
import { Body, Controller, HttpCode, Inject, Post, Res, UseFilters, UseGuards } from "@nestjs/common";
// Alias: `Response` sem prefixo é o global do fetch, usado pelo tradutor de erro.
import type { Response as ExpressResponse } from "express";
import { ErrosHttpFilter, type TradutorDeErro } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { gravarCookieSessao } from "../comum/sessao/cookie-sessao";
import { UsuarioGuard } from "../comum/tenant/usuario.guard";
import { UsuarioId } from "../comum/tenant/usuario.decorator";
import { MEMBRO_SERVICE } from "./tokens";
import { trocarEscritorioSchema, type DadosTrocaEscritorio } from "./schemas";
import { PermissaoNegadaError, type membroService } from "@/services/membro.service";

const tratarErroDeTroca: TradutorDeErro = (error) =>
  error instanceof PermissaoNegadaError ? Response.json({ error: error.message }, { status: 403 }) : null;

// Só troca para um escritório onde o usuário é membro — o escritorioId do corpo nunca é
// gravado sem passar por trocarEscritorioAtivo, que consulta o banco (RN19).
@Controller("sessao")
@UseGuards(UsuarioGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeTroca]))
export class EscritorioAtivoController {
  constructor(@Inject(MEMBRO_SERVICE) private readonly membros: Pick<typeof membroService, "trocarEscritorioAtivo">) {}

  @Post("escritorio-ativo")
  @HttpCode(200)
  async trocar(
    @UsuarioId() usuarioId: string,
    @Body(new ValidacaoZodPipe(trocarEscritorioSchema)) dados: DadosTrocaEscritorio,
    @Res({ passthrough: true }) res: ExpressResponse
  ) {
    const membro = await this.membros.trocarEscritorioAtivo(usuarioId, dados.escritorioId);
    await gravarCookieSessao(res, { sub: usuarioId, escritorioId: membro.escritorioId });
    return { escritorioId: membro.escritorioId, role: membro.role };
  }
}
```

`apps/api/src/sessao/cadastro.controller.ts`:

```ts
import { Body, Controller, Inject, Post, UseFilters } from "@nestjs/common";
import { ErrosHttpFilter, type TradutorDeErro } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { USUARIO_SERVICE } from "./tokens";
import { cadastroSchema, type DadosCadastro } from "./schemas";
import { EmailJaCadastradoError, type usuarioService } from "@/services/usuario.service";

const tratarErroDeCadastro: TradutorDeErro = (error) =>
  error instanceof EmailJaCadastradoError ? Response.json({ error: error.message }, { status: 409 }) : null;

// Rota pública (RN02): cria só o usuário. Convites pendentes para o e-mail já viram
// membership aqui (temEscritorio); a sessão é aberta pelo front via /api/auth/login.
@Controller("cadastro")
@UseFilters(new ErrosHttpFilter([tratarErroDeCadastro]))
export class CadastroController {
  constructor(@Inject(USUARIO_SERVICE) private readonly usuarios: Pick<typeof usuarioService, "cadastrarUsuario">) {}

  @Post()
  async cadastrar(@Body(new ValidacaoZodPipe(cadastroSchema)) dados: DadosCadastro) {
    const { usuario, temEscritorio } = await this.usuarios.cadastrarUsuario(dados);
    return { usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }, temEscritorio };
  }
}
```

`apps/api/src/sessao/criar-escritorio.controller.ts`:

```ts
import { Body, Controller, Inject, Post, Res, UseGuards } from "@nestjs/common";
import type { Response as ExpressResponse } from "express";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { gravarCookieSessao } from "../comum/sessao/cookie-sessao";
import { UsuarioGuard } from "../comum/tenant/usuario.guard";
import { UsuarioId } from "../comum/tenant/usuario.decorator";
import { ESCRITORIO_SERVICE } from "./tokens";
import { criarEscritorioSchema } from "@/lib/api/schemas-escritorio";
import type { CriarEscritorioInput, escritorioService } from "@/services/escritorio.service";

// POST /api/escritorios (raiz): onboarding do primeiro escritório ou criação de outro pelo
// switcher. Exige só usuário autenticado — não passa por TenantGuard, porque o usuário
// pode ainda não ter escritório. GET/PATCH /api/escritorios/atual seguem no módulo de
// escritórios da Fase 2; os dois controllers dividem o prefixo sem conflito de rota.
@Controller("escritorios")
@UseGuards(UsuarioGuard)
export class CriarEscritorioController {
  constructor(
    @Inject(ESCRITORIO_SERVICE) private readonly escritorios: Pick<typeof escritorioService, "criarEscritorio">
  ) {}

  @Post()
  async criar(
    @UsuarioId() usuarioId: string,
    @Body(new ValidacaoZodPipe(criarEscritorioSchema)) dados: CriarEscritorioInput,
    @Res({ passthrough: true }) res: ExpressResponse
  ) {
    const { escritorio, membro } = await this.escritorios.criarEscritorio(usuarioId, dados);
    // Escritório recém-criado vira o ativo da sessão.
    await gravarCookieSessao(res, { sub: usuarioId, escritorioId: escritorio.id });
    return { escritorio: { id: escritorio.id, nome: escritorio.nome }, role: membro.role };
  }
}
```

Confirme que `CriarEscritorioInput` é exportado: `grep -n "export interface CriarEscritorioInput\|export type CriarEscritorioInput" src/services/escritorio.service.ts`. Se não for, use `z.infer<typeof criarEscritorioSchema>`. Confirme também que nenhum controller da Fase 2 declara `@Post()` na raiz de `escritorios`: `grep -rn "@Controller(\"escritorios\")" -A 30 apps/api/src | grep -n "@Post()"` deve mostrar só o `CriarEscritorioController`.

Em `apps/api/src/sessao/sessao.module.ts`, atualizar `controllers` e os imports:

```ts
import { EscritorioAtivoController } from "./escritorio-ativo.controller";
import { CadastroController } from "./cadastro.controller";
import { CriarEscritorioController } from "./criar-escritorio.controller";
// ...
  controllers: [AuthController, EscritorioAtivoController, CadastroController, CriarEscritorioController],
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run api:test && npm run api:typecheck`
Expected: PASS em toda a suíte da API; typecheck sem erros.

Run: `npx jest && npx tsc --noEmit`
Expected: Next verde (só a troca de import do schema mexeu no lado Next).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/sessao src/lib/api/schemas-escritorio.ts src/app/api/escritorios
git commit -m "feat(api): troca de escritório, cadastro e criação de escritório gravando crm_sessao"
```

---

### Task 3.5: Virada no Nest: guards leem `crm_sessao` e o Next encaminha as rotas de sessão

Início da janela de virada (ver o topo da fase). A partir daqui, uma sessão do NextAuth não abre mais nenhuma rota da API.

**Files:**
- Modify: `apps/api/src/comum/tenant/ler-sessao.ts`, `apps/api/src/comum/tenant/ler-sessao.test.ts`, `next.config.ts`
- Delete: `src/app/api/cadastro/`, `src/app/api/sessao/`, `src/app/api/escritorios/` (o que restar)

**Interfaces:**
- Consumes: `lerSessaoDaRequisicao` (Task 3.2); `resolverTenantContext`, `NaoAutenticadoError` (Fase 1).
- Produces (assinaturas inalteradas, implementação nova): `resolverTenantDaRequisicao(req): Promise<TenantContext>`, `resolverUsuarioDaRequisicao(req): Promise<string>` (lança `NaoAutenticadoError` sem sessão), `headersDaRequisicao(req): Headers` (mantido). `ROTAS_NA_API_NEST` ganha `auth`, `cadastro`, `sessao` e `escritorios`.

- [ ] **Step 1: Reescrever o teste**

Substituir `apps/api/src/comum/tenant/ler-sessao.test.ts` por:

```ts
import type { Request } from "express";
import { headersDaRequisicao, resolverTenantDaRequisicao, resolverUsuarioDaRequisicao } from "./ler-sessao";
import { resolverTenantContext, NaoAutenticadoError } from "@/lib/auth/resolver-tenant";
import { cookieDeSessao, usarSegredoDeTeste } from "../../../test/sessao";

jest.mock("@/lib/auth/resolver-tenant", () => ({
  ...jest.requireActual("@/lib/auth/resolver-tenant"),
  resolverTenantContext: jest.fn(),
}));

const resolver = resolverTenantContext as jest.Mock;

function req(headers: Record<string, string | string[] | undefined>) {
  return { headers } as unknown as Request;
}

usarSegredoDeTeste();

describe("headersDaRequisicao", () => {
  it("converte os headers do Express em Headers, preservando o cookie", () => {
    const h = headersDaRequisicao(req({ cookie: "crm_sessao=abc", "x-vazio": undefined }));
    expect(h.get("cookie")).toBe("crm_sessao=abc");
    expect(h.has("x-vazio")).toBe(false);
  });

  it("junta headers com múltiplos valores", () => {
    expect(headersDaRequisicao(req({ accept: ["a", "b"] })).get("accept")).toBe("a, b");
  });
});

describe("resolverTenantDaRequisicao", () => {
  afterEach(() => jest.clearAllMocks());

  it("passa sub e escritorioId do crm_sessao para o resolver compartilhado (role do banco)", async () => {
    resolver.mockResolvedValue({ usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" });

    const ctx = await resolverTenantDaRequisicao(
      req({ cookie: await cookieDeSessao({ sub: "user-1", escritorioId: "esc-1" }) })
    );

    expect(resolver).toHaveBeenCalledWith({ usuarioId: "user-1", escritorioId: "esc-1" });
    expect(ctx.role).toBe("padrao");
  });

  it("passa null sem cookie", async () => {
    resolver.mockRejectedValue(new NaoAutenticadoError());

    await expect(resolverTenantDaRequisicao(req({}))).rejects.toThrow(NaoAutenticadoError);
    expect(resolver).toHaveBeenCalledWith(null);
  });

  it("ignora o cookie do NextAuth (sessões antigas invalidadas)", async () => {
    resolver.mockRejectedValue(new NaoAutenticadoError());

    await expect(resolverTenantDaRequisicao(req({ cookie: "authjs.session-token=x" }))).rejects.toThrow(
      NaoAutenticadoError
    );
    expect(resolver).toHaveBeenCalledWith(null);
  });
});

describe("resolverUsuarioDaRequisicao", () => {
  it("devolve o sub do crm_sessao mesmo sem escritório ativo", async () => {
    const cookie = await cookieDeSessao({ sub: "user-1", escritorioId: null });

    await expect(resolverUsuarioDaRequisicao(req({ cookie }))).resolves.toBe("user-1");
  });

  it("lança NaoAutenticadoError sem cookie ou com cookie adulterado", async () => {
    await expect(resolverUsuarioDaRequisicao(req({}))).rejects.toThrow(NaoAutenticadoError);
    await expect(resolverUsuarioDaRequisicao(req({ cookie: "crm_sessao=a.b.c" }))).rejects.toThrow(
      NaoAutenticadoError
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- ler-sessao`
Expected: FAIL, porque `resolverTenantDaRequisicao` ainda lê `lerTokenDaSessao` (NextAuth) e não encontra o `crm_sessao`.

- [ ] **Step 3: Implementar**

Substituir `apps/api/src/comum/tenant/ler-sessao.ts` por:

```ts
import type { Request } from "express";
import { resolverTenantContext, NaoAutenticadoError, type TenantContext } from "@/lib/auth/resolver-tenant";
import { lerSessaoDaRequisicao } from "../sessao/cookie-sessao";

export const RESOLVEDOR_TENANT = Symbol("RESOLVEDOR_TENANT");
export type ResolvedorTenant = (req: Request) => Promise<TenantContext>;

export const RESOLVEDOR_USUARIO = Symbol("RESOLVEDOR_USUARIO");
export type ResolvedorUsuario = (req: Request) => Promise<string>;

// Utilitário para quem precisa da interface Headers do fetch a partir do Express.
export function headersDaRequisicao(req: Request): Headers {
  const headers = new Headers();
  for (const [nome, valor] of Object.entries(req.headers)) {
    if (valor === undefined) continue;
    headers.set(nome, Array.isArray(valor) ? valor.join(", ") : valor);
  }
  return headers;
}

// Fase 3: a sessão é o cookie crm_sessao (src/lib/auth/sessao-jwt.ts). O JWT só informa
// quem é o usuário e qual escritório está ativo; papel e membership vêm do banco via
// resolverTenantContext — a mesma regra que o getTenantContext() do Next usa (RN19).
export async function resolverTenantDaRequisicao(req: Request): Promise<TenantContext> {
  const sessao = await lerSessaoDaRequisicao(req);
  return resolverTenantContext(sessao ? { usuarioId: sessao.sub, escritorioId: sessao.escritorioId } : null);
}

// Rotas fora de tenant (perfil, criação de escritório, troca de escritório): só exigem
// um usuário autenticado.
export async function resolverUsuarioDaRequisicao(req: Request): Promise<string> {
  const sessao = await lerSessaoDaRequisicao(req);
  if (!sessao) {
    throw new NaoAutenticadoError();
  }
  return sessao.sub;
}
```

Se a Fase 2 declarou `RESOLVEDOR_USUARIO`/`ResolvedorUsuario` em outro arquivo (ver o `grep` dos pré-requisitos), remova as duas linhas daqui e mantenha a declaração onde está. Neste caso, só a implementação de `resolverUsuarioDaRequisicao` muda.

Run: `grep -rn "lib/auth/token" apps/api/src`
Expected: vazio. Se algum controller da Fase 2 ainda chama `lerTokenDaSessao`/`lerUsuarioIdDaSessao` direto, troque por `@UsuarioId()` com `UsuarioGuard`.

- [ ] **Step 4: Ler a doc de rewrites e encaminhar as rotas de sessão**

Run: `sed -n 1,140p node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/rewrites.md`
Confirme que `beforeFiles` continua tendo prioridade sobre `app/` e que o proxy externo repassa os headers de resposta (`Set-Cookie`).

Em `next.config.ts`, acrescentar ao fim de `ROTAS_NA_API_NEST` os quatro grupos, sem tocar nos itens da Fase 2. Se existir um item `"escritorios/atual"`, remova-o, porque o prefixo `escritorios` já o cobre:

```ts
  // Fase 3: sessão própria (crm_sessao) — login/logout/sessão, cadastro, troca e
  // criação de escritório. Com "auth" aqui, /api/auth/* do NextAuth fica inalcançável.
  "auth",
  "cadastro",
  "sessao",
  "escritorios",
```

- [ ] **Step 5: Remover as rotas Next substituídas**

```bash
ls src/app/api/escritorios
git rm -r src/app/api/cadastro src/app/api/sessao src/app/api/escritorios
```

O `ls` deve mostrar só `route.ts`, `route.test.ts` e, se a Fase 2 ainda não removeu, a pasta `atual/`. Se `atual/route.ts` ainda existir, a Fase 2 não migrou `escritorios/atual`. Pare e porte essa rota antes, porque o rewrite de `escritorios` a desligaria. `src/app/api/auth/[...nextauth]` fica para a Task 3.8.

- [ ] **Step 6: Rodar os testes**

Run: `npm run api:test && npm run api:typecheck && npx jest && npx tsc --noEmit`
Expected: tudo PASS. Confirme com `grep -rn "app/api/cadastro\|app/api/sessao\|app/api/escritorios" src` → vazio.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/comum/tenant next.config.ts src/app/api
git commit -m "feat(auth): guards da API leem crm_sessao e Next encaminha rotas de sessão ao Nest"
```

---

### Task 3.6: Virada no Next servidor: `proxy.ts`, `getTenantContext()` e Server Components

**Files:**
- Create: `src/lib/auth/sessao-servidor.ts`, `src/lib/auth/sessao-servidor.test.ts`, `src/proxy.test.ts`
- Modify: `src/lib/auth/tenant-context.ts`, `src/lib/auth/tenant-context.test.ts`, `src/proxy.ts`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/page.tsx`, `src/app/(dashboard)/casos/page.tsx`, `src/app/(dashboard)/clientes/page.tsx`, `src/app/(dashboard)/perfil/page.tsx`, `src/app/(dashboard)/perfil/page.test.tsx`, `src/app/(onboarding)/onboarding/page.tsx`
- Sem mudança (já delega a `getTenantContext()`): `src/app/(dashboard)/_lib/tenant-context-pagina.ts` e o teste dele. As páginas que só usam `getTenantContextOuRedirect()` (agenda, campanhas, campanhas/nova, campanhas/[id], instancias, configuracoes/*) também não mudam.

**Interfaces:**
- Consumes: `cookies()` de `next/headers` (async no Next 16); `NOME_COOKIE_SESSAO_CRM`, `verificarSessao`, `SessaoJwt` (Task 3.1); `resolverTenantContext` (Fase 1); `usuarioService.obterPerfil`.
- Produces:
  ```ts
  // src/lib/auth/sessao-servidor.ts
  export async function lerSessaoDoServidor(): Promise<SessaoJwt | null>;
  export interface UsuarioDaSessao { id: string; nome: string; email: string }
  export async function obterUsuarioDaSessao(): Promise<UsuarioDaSessao | null>; // null se sem sessão ou usuário inativo/removido
  // src/lib/auth/tenant-context.ts (mesma assinatura)
  export async function getTenantContext(): Promise<TenantContext>;
  ```

- [ ] **Step 1: Ler a doc do Next 16**

Run: `sed -n 1,80p node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`
Confirme que `cookies()` é **async** (`await cookies()`) e que Server Components só podem ler cookies, não gravar.

Run: `sed -n 1,120p node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md && sed -n 220,340p node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
Confirme três pontos: o proxy roda no runtime Node, o que permite o `jose` e `process.env`; a função pode ser `export default async function proxy(request: NextRequest)`; `request.cookies.get(nome)?.value` lê o cookie.

- [ ] **Step 2: Escrever os testes que falham**

`src/lib/auth/sessao-servidor.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { cookies } from "next/headers";
import { lerSessaoDoServidor, obterUsuarioDaSessao } from "./sessao-servidor";
import { assinarSessao } from "./sessao-jwt";
import { usuarioService } from "@/services/usuario.service";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/services/usuario.service", () => ({ usuarioService: { obterPerfil: jest.fn() } }));

const mockedCookies = cookies as jest.Mock;
const mockedObterPerfil = usuarioService.obterPerfil as jest.Mock;

function comCookie(valor: string | undefined) {
  mockedCookies.mockResolvedValue({ get: (nome: string) => (nome === "crm_sessao" && valor ? { value: valor } : undefined) });
}

describe("sessao-servidor", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "segredo-de-teste-com-pelo-menos-32-caracteres";
  });
  afterEach(() => jest.clearAllMocks());

  it("lerSessaoDoServidor devolve a sessão do cookie crm_sessao", async () => {
    comCookie(await assinarSessao({ sub: "user-1", escritorioId: "esc-1" }));

    await expect(lerSessaoDoServidor()).resolves.toEqual({ sub: "user-1", escritorioId: "esc-1" });
  });

  it("lerSessaoDoServidor devolve null sem cookie ou com cookie inválido", async () => {
    comCookie(undefined);
    await expect(lerSessaoDoServidor()).resolves.toBeNull();

    comCookie("a.b.c");
    await expect(lerSessaoDoServidor()).resolves.toBeNull();
  });

  it("obterUsuarioDaSessao lê nome/e-mail do banco (o JWT não carrega esses dados)", async () => {
    comCookie(await assinarSessao({ sub: "user-1", escritorioId: "esc-1" }));
    mockedObterPerfil.mockResolvedValue({ id: "user-1", nome: "Fulana", email: "f@t.com", ativo: true });

    await expect(obterUsuarioDaSessao()).resolves.toEqual({ id: "user-1", nome: "Fulana", email: "f@t.com" });
    expect(mockedObterPerfil).toHaveBeenCalledWith("user-1");
  });

  it("obterUsuarioDaSessao devolve null para usuário inativo ou removido", async () => {
    comCookie(await assinarSessao({ sub: "user-1", escritorioId: "esc-1" }));

    mockedObterPerfil.mockResolvedValue({ id: "user-1", nome: "F", email: "f@t.com", ativo: false });
    await expect(obterUsuarioDaSessao()).resolves.toBeNull();

    mockedObterPerfil.mockResolvedValue(null);
    await expect(obterUsuarioDaSessao()).resolves.toBeNull();
  });

  it("obterUsuarioDaSessao não consulta o banco sem sessão", async () => {
    comCookie(undefined);

    await expect(obterUsuarioDaSessao()).resolves.toBeNull();
    expect(mockedObterPerfil).not.toHaveBeenCalled();
  });
});
```

Substituir `src/lib/auth/tenant-context.test.ts` por:

```ts
import { getTenantContext, NaoAutenticadoError, SemEscritorioAtivoError, AcessoNegadoError } from "./tenant-context";
import { lerSessaoDoServidor } from "@/lib/auth/sessao-servidor";
import { membroRepository } from "@/repositories/membro.repository";

jest.mock("@/lib/auth/sessao-servidor", () => ({ lerSessaoDoServidor: jest.fn() }));
jest.mock("@/repositories/membro.repository");

const mockedLerSessao = lerSessaoDoServidor as jest.Mock;
const mockedMembroRepo = membroRepository as jest.Mocked<typeof membroRepository>;

describe("getTenantContext", () => {
  afterEach(() => jest.clearAllMocks());

  it("lança NaoAutenticadoError quando não há sessão (RN01)", async () => {
    mockedLerSessao.mockResolvedValue(null);

    await expect(getTenantContext()).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança SemEscritorioAtivoError quando a sessão não tem escritório", async () => {
    mockedLerSessao.mockResolvedValue({ sub: "user-1", escritorioId: null });

    await expect(getTenantContext()).rejects.toThrow(SemEscritorioAtivoError);
  });

  it("lança AcessoNegadoError quando o usuário não é mais membro (RN19)", async () => {
    mockedLerSessao.mockResolvedValue({ sub: "user-1", escritorioId: "esc-1" });
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue(null);

    await expect(getTenantContext()).rejects.toThrow(AcessoNegadoError);
  });

  it("devolve o contexto com o role do banco", async () => {
    mockedLerSessao.mockResolvedValue({ sub: "user-1", escritorioId: "esc-1" });
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue({ escritorioId: "esc-1", role: "admin" } as never);

    await expect(getTenantContext()).resolves.toEqual({ usuarioId: "user-1", escritorioId: "esc-1", role: "admin" });
    expect(mockedMembroRepo.findByUsuarioEEscritorio).toHaveBeenCalledWith("user-1", "esc-1");
  });
});
```

`src/proxy.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import proxy from "./proxy";
import { assinarSessao } from "@/lib/auth/sessao-jwt";

function requisicao(caminho: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${caminho}`, { headers: cookie ? { cookie } : {} });
}

describe("proxy (RN01)", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "segredo-de-teste-com-pelo-menos-32-caracteres";
  });

  it("deixa passar com crm_sessao válido", async () => {
    const token = await assinarSessao({ sub: "user-1", escritorioId: "esc-1" });

    const res = await proxy(requisicao("/casos", `crm_sessao=${token}`));

    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("redireciona para /login com callbackUrl sem sessão", async () => {
    const res = await proxy(requisicao("/casos?aba=kanban"));

    expect(res.status).toBe(307);
    const destino = new URL(res.headers.get("location")!);
    expect(destino.pathname).toBe("/login");
    expect(destino.searchParams.get("callbackUrl")).toBe("/casos?aba=kanban");
  });

  it("redireciona com o cookie legado do NextAuth (sessões antigas invalidadas)", async () => {
    const res = await proxy(requisicao("/", "authjs.session-token=qualquer"));

    expect(res.status).toBe(307);
  });

  it("redireciona com crm_sessao adulterado", async () => {
    const res = await proxy(requisicao("/", "crm_sessao=a.b.c"));

    expect(res.status).toBe(307);
  });

  it("responde 401 JSON (nunca redirect HTML) se uma rota /api chegar aqui", async () => {
    const res = await proxy(requisicao("/api/clientes"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Sessão inválida ou expirada." });
  });
});
```

Em `src/app/(dashboard)/perfil/page.test.tsx`, fazer quatro trocas:
- `import { auth } from "@/lib/auth/config";` → `import { lerSessaoDoServidor } from "@/lib/auth/sessao-servidor";`
- `jest.mock("@/lib/auth/config", () => ({ auth: jest.fn() }));` → `jest.mock("@/lib/auth/sessao-servidor", () => ({ lerSessaoDoServidor: jest.fn() }));`
- `const mockedAuth = auth as unknown as jest.Mock;` → `const mockedAuth = lerSessaoDoServidor as jest.Mock;`
- Os dois `mockedAuth.mockResolvedValue({ user: { id: "u1", ... } })` → `mockedAuth.mockResolvedValue({ sub: "u1", escritorioId: "esc-1" })`. O `mockResolvedValue(null)` do caso "manda para o login" fica igual. O título "mostra os dados do banco, não os do JWT" continua válido.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest src/lib/auth src/proxy.test.ts "src/app/(dashboard)/perfil"`
Expected: FAIL. `./sessao-servidor` não existe, `tenant-context.ts` ainda chama `auth()` e o proxy ainda é o do NextAuth.

- [ ] **Step 4: Implementar**

`src/lib/auth/sessao-servidor.ts`:

```ts
import { cookies } from "next/headers";
import { NOME_COOKIE_SESSAO_CRM, verificarSessao, type SessaoJwt } from "@/lib/auth/sessao-jwt";
import { usuarioService } from "@/services/usuario.service";

// Leitura da sessão em Server Components (substitui auth() do NextAuth). Só lê: quem
// grava o cookie é a API Nest (SessaoModule). Some na Fase 4, com os Server Components.

export async function lerSessaoDoServidor(): Promise<SessaoJwt | null> {
  const loja = await cookies();
  return verificarSessao(loja.get(NOME_COOKIE_SESSAO_CRM)?.value);
}

export interface UsuarioDaSessao {
  id: string;
  nome: string;
  email: string;
}

// Nome/e-mail saem do banco, não do JWT. Isso também corrige o nome desatualizado depois
// de editar o perfil, que o JWT do NextAuth mantinha até o próximo login.
export async function obterUsuarioDaSessao(): Promise<UsuarioDaSessao | null> {
  const sessao = await lerSessaoDoServidor();
  if (!sessao) return null;

  const usuario = await usuarioService.obterPerfil(sessao.sub);
  if (!usuario || !usuario.ativo) return null;

  return { id: usuario.id, nome: usuario.nome, email: usuario.email };
}
```

Substituir `src/lib/auth/tenant-context.ts` por:

```ts
import { lerSessaoDoServidor } from "@/lib/auth/sessao-servidor";
import { resolverTenantContext, type TenantContext } from "@/lib/auth/resolver-tenant";

export {
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
  type TenantContext,
} from "@/lib/auth/resolver-tenant";

// Server Components do Next que acessam dados de tenant passam por aqui (RN19). A regra
// mora em resolver-tenant.ts, compartilhada com o TenantGuard da API Nest; a sessão é o
// cookie crm_sessao (src/lib/auth/sessao-jwt.ts).
export async function getTenantContext(): Promise<TenantContext> {
  const sessao = await lerSessaoDoServidor();
  return resolverTenantContext(sessao ? { usuarioId: sessao.sub, escritorioId: sessao.escritorioId } : null);
}
```

Substituir `src/proxy.ts` por:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { NOME_COOKIE_SESSAO_CRM, verificarSessao } from "@/lib/auth/sessao-jwt";

// RN01: qualquer página além de login/cadastro exige sessão válida (cookie crm_sessao
// assinado — o cookie legado do NextAuth não vale mais).
//
// O redirect só vale para navegação HTML. Rotas /api ficam FORA do matcher: elas são
// respondidas pela API Nest (rewrites em next.config.ts), cujos guards devolvem
// `{ error }` 401 por conta própria. Se o proxy as cobrisse, uma sessão expirada viraria
// um 307 para a página HTML de /login, e o apiFetch não conseguiria parsear a resposta.
export default async function proxy(req: NextRequest) {
  const sessao = await verificarSessao(req.cookies.get(NOME_COOKIE_SESSAO_CRM)?.value);
  if (sessao) return NextResponse.next();

  // Defesa em profundidade: se algum dia o matcher voltar a cobrir /api, a resposta
  // ainda é um 401 JSON — nunca um redirect HTML para um consumidor de API.
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // O `.*\..*` no fim exclui qualquer caminho com extensão de arquivo (ex.:
  // /images/foo.webp em public/) — arquivos estáticos nunca precisam de sessão,
  // e a tela de login/cadastro (não autenticada) depende de poder carregá-los.
  matcher: ["/((?!api/|login|cadastro|icon|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

`src/app/(dashboard)/layout.tsx`: troque `import { auth } from "@/lib/auth/config";` por

```ts
import { lerSessaoDoServidor } from "@/lib/auth/sessao-servidor";
import { usuarioService } from "@/services/usuario.service";
```

Depois troque o comentário acima da função e o trecho do início da função até `const escritorios = ...` por:

```tsx
// Sem SessionProvider: a sessão (cookie crm_sessao) é lida só no servidor, e as mutações
// do client (ex. EscritorioSwitcher) chamam a API e disparam router.refresh().
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const sessao = await lerSessaoDoServidor();
  if (!sessao) {
    redirect("/login");
  }
  if (!sessao.escritorioId) {
    redirect("/onboarding");
  }

  // Nome/e-mail do banco: o JWT só carrega ids.
  const [usuario, escritorios] = await Promise.all([
    usuarioService.obterPerfil(sessao.sub),
    membroService.listarEscritoriosDoUsuario(sessao.sub),
  ]);
  if (!usuario || !usuario.ativo) {
    redirect("/login");
  }
```

No JSX do mesmo arquivo, faça três trocas:
- `ativoId={session.user.escritorioId}` → `ativoId={sessao.escritorioId}`
- `usuario={{ nome: session.user.name ?? "", email: session.user.email ?? "" }}` → `usuario={{ nome: usuario.nome, email: usuario.email }}`
- `<QueryProvider escritorioId={session.user.escritorioId}>` → `<QueryProvider escritorioId={sessao.escritorioId}>`

`src/app/(dashboard)/page.tsx`: troque `import { auth } from "@/lib/auth/config";` por `import { obterUsuarioDaSessao } from "@/lib/auth/sessao-servidor";` e as duas primeiras linhas de `DashboardPage` por:

```tsx
  const [ctx, usuario] = await Promise.all([getTenantContextOuRedirect(), obterUsuarioDaSessao()]);
  const atorNome = usuario?.nome ?? "";
```

`src/app/(dashboard)/casos/page.tsx` e `src/app/(dashboard)/clientes/page.tsx` recebem a mesma mudança. Troque `import { auth } from "@/lib/auth/config";` por `import { obterUsuarioDaSessao } from "@/lib/auth/sessao-servidor";`. Troque o bloco do comentário + `const session = await auth();` por:

```tsx
  // O nome do autor do comentário em rascunho sai do banco: o TenantContext e o JWT
  // carregam só ids e papel.
  const usuario = await obterUsuarioDaSessao();
```

Por fim, troque `atorNome={session?.user?.name ?? ""}` por `atorNome={usuario?.nome ?? ""}`.

`src/app/(dashboard)/perfil/page.tsx`: troque `import { auth } from "@/lib/auth/config";` por `import { lerSessaoDoServidor } from "@/lib/auth/sessao-servidor";`. No corpo, use:

```tsx
  const sessao = await lerSessaoDoServidor();
  if (!sessao) {
    redirect("/login");
  }

  // Nome/e-mail sempre do banco (o JWT só carrega ids); o router.refresh() do
  // PerfilForm re-renderiza este Server Component com o valor novo.
  const perfil = await usuarioService.obterPerfil(sessao.sub);
```

Essas linhas substituem o bloco `const session = await auth(); ... const perfil = await usuarioService.obterPerfil(session.user.id);`, incluindo o comentário antigo sobre o JWT.

`src/app/(onboarding)/onboarding/page.tsx`: troque `import { auth } from "@/lib/auth/config";` por `import { lerSessaoDoServidor } from "@/lib/auth/sessao-servidor";` e

```tsx
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
```

por

```tsx
  if (!(await lerSessaoDoServidor())) {
    redirect("/login");
  }
```

- [ ] **Step 5: Rodar os testes**

Run: `npx jest src/lib/auth src/proxy.test.ts "src/app/(dashboard)" "src/app/(onboarding)"`
Expected: PASS. Isso inclui `tenant-context-pagina.test.ts` e `configuracoes/membros/page.test.tsx`, que não mudam.

Run: `grep -rn "lib/auth/config" "src/app/(dashboard)" "src/app/(onboarding)" src/proxy.ts src/lib/auth/tenant-context.ts`
Expected: vazio.

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth src/proxy.ts src/proxy.test.ts "src/app/(dashboard)" "src/app/(onboarding)"
git commit -m "feat(auth): proxy e Server Components leem a sessão do cookie crm_sessao"
```

---

### Task 3.7: Virada no Next cliente: login, cadastro e logout chamam a API Nest

Fim da janela de virada. Esta task fecha com o smoke test manual ponta a ponta.

**Files:**
- Create: `src/lib/auth/cliente-sessao.ts`, `src/lib/auth/cliente-sessao.test.ts`
- Modify: `src/app/(auth)/login/page.tsx` (+ `page.test.tsx`), `src/app/(auth)/cadastro/page.tsx` (+ `page.test.tsx`), `src/components/shell/nav-usuario.tsx` (+ `.test.tsx`), `src/components/shell/app-sidebar.test.tsx`, `src/components/shell/escritorio-switcher.tsx` (comentário), `src/components/shell/novo-escritorio-form.tsx` (comentário)

**Interfaces:**
- Consumes: `POST /api/auth/login`, `POST /api/auth/logout` (Task 3.3, encaminhados na Task 3.5).
- Produces:
  ```ts
  // src/lib/auth/cliente-sessao.ts (browser)
  export async function entrar(email: string, senha: string): Promise<boolean>; // true = logou; false = 400/401; lança em outros erros
  export async function sair(): Promise<void>;                                   // nunca lança
  ```

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/auth/cliente-sessao.test.ts`:

```ts
import { entrar, sair } from "./cliente-sessao";

function resposta(status: number) {
  return { ok: status >= 200 && status < 300, status, json: async () => ({}) };
}

describe("cliente-sessao", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("entrar envia as credenciais para /api/auth/login e devolve true no 200", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200));

    await expect(entrar("f@t.com", "senha")).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "f@t.com", senha: "senha" }),
    });
  });

  it.each([401, 400])("entrar devolve false para %i (credenciais inválidas)", async (status) => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(status));

    await expect(entrar("f@t.com", "errada")).resolves.toBe(false);
  });

  it("entrar lança para erro de servidor (a tela mostra a mensagem genérica)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(500));

    await expect(entrar("f@t.com", "senha")).rejects.toThrow("HTTP 500");
  });

  it("sair chama /api/auth/logout", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200));

    await sair();
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });

  it("sair não lança quando a rede falha (a navegação para /login segue)", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    await expect(sair()).resolves.toBeUndefined();
  });
});
```

Em `src/app/(auth)/login/page.test.tsx`:
- Troque o import e o mock do `next-auth/react` por:
  ```ts
  import { entrar } from "@/lib/auth/cliente-sessao";
  import LoginPage from "./page";

  jest.mock("@/lib/auth/cliente-sessao", () => ({ entrar: jest.fn() }));

  const mockedEntrar = entrar as jest.Mock;
  ```
- `mockedSignIn.mockResolvedValue({ error: "CredentialsSignin", ok: false })` → `mockedEntrar.mockResolvedValue(false)`.
- Cada `mockedSignIn.mockResolvedValue({ error: undefined, ok: true })` → `mockedEntrar.mockResolvedValue(true)`.
- `mockedSignIn.mockRejectedValue(new Error("network error"))` → `mockedEntrar.mockRejectedValue(new Error("network error"))`, com o título passando a ser `"exibe erro genérico quando entrar lança uma exceção (ex.: falha de rede)"`.
- No primeiro teste, acrescentar ao final `expect(mockedEntrar).toHaveBeenCalledWith("fulano@teste.com", "senha-errada");`.
- Trocar o comentário do `beforeEach` para: `// Login com sucesso navega via window.location.href (não router.push) — ver comentário no componente sobre o Router Cache stale pós-login.`

Em `src/app/(auth)/cadastro/page.test.tsx`:
- Troque o import e o mock do `next-auth/react` por `import { entrar } from "@/lib/auth/cliente-sessao";` e `jest.mock("@/lib/auth/cliente-sessao", () => ({ entrar: jest.fn() }));`. Troque `const mockedSignIn = signIn as jest.Mock;` por `const mockedEntrar = entrar as jest.Mock;`.
- Substitua todos os `mockedSignIn` por `mockedEntrar`, e `mockResolvedValue({ error: undefined, ok: true })` por `mockResolvedValue(true)`.
- No teste "cadastra, loga automaticamente e vai para o onboarding…", acrescente `expect(mockedEntrar).toHaveBeenCalledWith("fulano@teste.com", "senha-forte-123");`. Use os mesmos valores que `preencherFormulario` digita (confira no topo do arquivo e ajuste se forem outros).
- Acrescente o caso:
  ```tsx
  it("manda para o login quando o cadastro deu certo mas a sessão não abriu", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ temEscritorio: false }) });
    mockedEntrar.mockResolvedValue(false);
    const user = userEvent.setup();

    render(<CadastroPage />);
    await preencherFormulario(user);
    await user.click(screen.getByRole("button", { name: /cadastrar/i }));

    expect(window.location.href).toBe("/login");
  });
  ```

Em `src/components/shell/nav-usuario.test.tsx`:
- Troque `import { signOut } from "next-auth/react";` e o `jest.mock("next-auth/react", …)` por:
  ```ts
  import { sair } from "@/lib/auth/cliente-sessao";

  jest.mock("@/lib/auth/cliente-sessao", () => ({ sair: jest.fn() }));
  ```
  e `const mockedSignOut = signOut as jest.Mock;` por `const mockedSair = sair as jest.Mock;`.
- Troque o último teste por:
  ```tsx
  it("encerra a sessão na API e vai para /login ao clicar em Sair", async () => {
    const originalLocation = window.location;
    Reflect.deleteProperty(window, "location");
    window.location = { href: "" } as never;
    mockedSair.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderNavUsuario();

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("menuitem", { name: /sair/i }));

    expect(mockedSair).toHaveBeenCalled();
    await waitFor(() => expect(window.location.href).toBe("/login"));
    window.location = originalLocation as never;
  });
  ```

Em `src/components/shell/app-sidebar.test.tsx`, remova o bloco `jest.mock("next-auth/react", () => ({ signOut: jest.fn() }));`. O `cliente-sessao` real não faz nada no render.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/auth/cliente-sessao.test.ts "src/app/(auth)" src/components/shell`
Expected: FAIL. O módulo `cliente-sessao` não existe e as páginas ainda importam `next-auth/react`.

- [ ] **Step 3: Implementar**

`src/lib/auth/cliente-sessao.ts`:

```ts
// Chamadas do browser aos endpoints de sessão da API Nest (substituem signIn/signOut do
// next-auth/react). O cookie crm_sessao é httpOnly: o browser só o recebe/limpa via
// Set-Cookie, nunca o lê.

export async function entrar(email: string, senha: string): Promise<boolean> {
  const resposta = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  if (resposta.ok) return true;
  // 401 = credencial errada/usuário inativo; 400 = campo vazio. Para a tela, os dois são
  // "e-mail ou senha inválidos" — nunca revelar qual dos dois errou.
  if (resposta.status === 401 || resposta.status === 400) return false;
  throw new Error(`Falha ao entrar (HTTP ${resposta.status}).`);
}

export async function sair(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Sem rede o cookie continua no browser, mas a navegação para /login segue — o
    // usuário pode tentar de novo de lá.
  }
}
```

`src/app/(auth)/login/page.tsx`: troque `import { signIn } from "next-auth/react";` por `import { entrar } from "@/lib/auth/cliente-sessao";`. Troque o trecho de `const result = await signIn(...)` até o `return;` do `if (result?.error)` por:

```tsx
      const logou = await entrar(String(formData.get("email") ?? ""), String(formData.get("senha") ?? ""));

      if (!logou) {
        setErro("E-mail ou senha inválidos.");
        return;
      }
```

O resto, com `destinoSeguro` e `window.location.href`, não muda.

`src/app/(auth)/cadastro/page.tsx`: troque `import { signIn } from "next-auth/react";` por `import { entrar } from "@/lib/auth/cliente-sessao";`. Troque o bloco `const loginResult = await signIn(...)` + `if (loginResult?.error) { ... }` por:

```tsx
      // A API de cadastro só cria o usuário; a sessão (crm_sessao) nasce no login.
      const logou = await entrar(String(payload.email ?? ""), String(payload.senha ?? "")).catch(() => false);

      if (!logou) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
        return;
      }
```

`src/components/shell/nav-usuario.tsx`: troque `import { signOut } from "next-auth/react";` por `import { sair } from "@/lib/auth/cliente-sessao";` e o item de menu por:

```tsx
            <DropdownMenuItem
              onClick={async () => {
                await sair();
                // Navegação forçada: descarta o Router Cache do usuário que saiu.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.href = "/login";
              }}
            >
```

Comentários que ainda citam o NextAuth:
- `src/components/shell/escritorio-switcher.tsx` (linhas 36–37): trocar por `// Troca de escritório: POST valida a membership no servidor e a API regrava o cookie crm_sessao -> router.refresh() recarrega os Server Components com o novo tenant.`
- `src/components/shell/novo-escritorio-form.tsx` (linhas 45–47): trocar `(unstable_update)` por `(a API regravou o cookie crm_sessao)`.

- [ ] **Step 4: Rodar os testes**

Run: `npx jest && npx tsc --noEmit && npm run lint`
Expected: tudo PASS.

Run: `grep -rn "next-auth\|lib/auth/config\|lib/auth/token" src --include=*.ts --include=*.tsx | grep -v "^src/lib/auth/config\|^src/lib/auth/token\|^src/types/next-auth.d.ts\|^src/app/api/auth/"`
Expected: vazio. Só sobram os arquivos removidos na Task 3.8.

- [ ] **Step 5: Smoke test manual ponta a ponta**

Terminal 1: `npm run api:dev`. Terminal 2: `npm run dev`, com `API_NEST_URL=http://localhost:3001` no `.env.local`.

Run: `curl -si -X POST localhost:3000/api/auth/login -H 'content-type: application/json' -d '{"email":"<usuario-do-seed>","senha":"<senha>"}' | grep -i "^set-cookie"`
Expected: `Set-Cookie: crm_sessao=eyJ...; Max-Age=2592000; Path=/; Expires=...; HttpOnly; SameSite=Lax`, o que confirma que o rewrite repassa o `Set-Cookie` da API.

No browser, numa aba anônima, faça o roteiro abaixo:
1. Abra `/`. Esperado: vai para `/login?callbackUrl=%2F`.
2. Faça login. Esperado: cai em `/`, com nome e e-mail certos no rodapé da sidebar. Em DevTools → Application, aparece só o cookie `crm_sessao` (HttpOnly) e nenhum `authjs.*`.
3. Troque de escritório pelo switcher. Esperado: o tenant muda e continua o mesmo depois do F5.
4. Crie um escritório pelo switcher. Esperado: entra nele.
5. Saia pelo menu do usuário. Esperado: volta a `/login`, e `/` sem cookie leva de novo ao login.
6. Cadastre um usuário novo. Esperado: cai em `/onboarding`, e criar o escritório leva a `/`.

Se o `Set-Cookie` não chegar ao browser pelo rewrite, pare. Isso invalida a estratégia sem CORS, e a decisão precisa ser revista antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/cliente-sessao.ts src/lib/auth/cliente-sessao.test.ts "src/app/(auth)" src/components/shell
git commit -m "feat(auth): login, cadastro e logout do front usam a API Nest"
```

---

### Task 3.8: Remover o NextAuth

**Files:**
- Delete: `src/lib/auth/config.ts`, `src/lib/auth/config.test.ts`, `src/lib/auth/token.ts`, `src/lib/auth/token.test.ts`, `src/app/api/auth/` (`[...nextauth]/route.ts`), `src/types/next-auth.d.ts`
- Modify: `package.json` / `package-lock.json` (sai `next-auth`), `jest.config.ts`, `apps/api/jest.config.cjs`, `apps/api/src/main.ts` (comentário), `.env.example`

**Interfaces:**
- Produces: nenhum import de `next-auth` no repositório. `AUTH_SECRET` (ou `NEXTAUTH_SECRET`, como fallback) continua sendo a única variável de sessão.

- [ ] **Step 1: Provar que nada mais usa os módulos do NextAuth**

Run: `grep -rn "next-auth\|@auth/core\|lib/auth/config\|lib/auth/token\|unstable_update\|useSession\|SessionProvider\|signIn(\|signOut(\|getToken(" src apps e2e --include=*.ts --include=*.tsx --include=*.cjs`
Expected: só os arquivos listados em **Delete**, `apps/api/jest.config.cjs` (`transformIgnorePatterns`) e eventuais comentários. Qualquer outro uso real precisa ser migrado antes de seguir.

- [ ] **Step 2: Remover arquivos e dependência**

```bash
git rm -r src/lib/auth/config.ts src/lib/auth/config.test.ts src/lib/auth/token.ts src/lib/auth/token.test.ts src/app/api/auth src/types/next-auth.d.ts
npm uninstall next-auth
npm ls jose
```

Expected: `npm ls jose` ainda mostra `jose@6.2.9` como dependência direta (Task 3.1).

Em `jest.config.ts`, apague de `collectCoverageFrom` as duas exclusões que não existem mais, junto com os comentários delas:

```ts
    // Re-export puro dos handlers do NextAuth.js — sem lógica própria, coberta pelo
    // spec E2E de login/cadastro.
    "!src/app/api/auth/**",
    // Wiring declarativo do NextAuth (providers/callbacks) — a lógica de negócio foi
    // extraída para authorize.ts/tenant-context.ts, que são testados isoladamente.
    "!src/lib/auth/config.ts",
```

Em `apps/api/jest.config.cjs`, troque a linha de `transformIgnorePatterns` e o comentário acima dela:

```js
// CJS de propósito: o pacote é "type": "module", e o Jest 29 roda em CommonJS.
// O @swc/jest transpila o próprio código, o domínio em ../../src e os pacotes ESM
// (Nest 12, jose) para CJS.
// ...
  transformIgnorePatterns: ["/node_modules/(?!(@nestjs|jose)/)"],
```

Em `apps/api/src/main.ts`, troque o comentário do `config(...)` por `// Mesmo .env do Next: DATABASE_URL e AUTH_SECRET precisam ser idênticos, senão a API e o proxy.ts do Next não conseguem verificar o cookie crm_sessao um do outro.`

Em `.env.example`, troque as linhas 7–8 (`NEXTAUTH_SECRET=...` e `NEXTAUTH_URL=...`) por:

```
# AUTH_SECRET: assina o cookie de sessão crm_sessao (JWT HS256). Precisa ser o MESMO
# no Next e na API Nest. Gerar com: openssl rand -base64 32
# (NEXTAUTH_SECRET ainda é aceito como fallback para ambientes antigos.)
AUTH_SECRET="troque-por-um-valor-aleatorio-gerado-com-openssl-rand-base64-32"
```

O `NEXTAUTH_URL` sai: nada lê essa variável depois da remoção, porque o `secure` do cookie depende de `NODE_ENV`. Confirme com `grep -rn "NEXTAUTH_URL\|AUTH_URL" src apps` → vazio.

- [ ] **Step 3: Rodar toda a bateria**

Run: `npx jest && npm run api:test && npm run api:typecheck && npx tsc --noEmit && npm run lint`
Expected: tudo PASS.

Run: `npx jest --coverage --collectCoverageFrom="src/lib/auth/**/*.{ts,tsx}" src/lib/auth`
Expected: `src/lib/auth/**` acima de 90% em branches, funções e linhas, que é o threshold do `jest.config.ts`. `sessao-jwt`, `sessao-servidor`, `cliente-sessao`, `tenant-context`, `resolver-tenant`, `authorize` e `escritorio-ativo` estão todos testados.

Run: `npm run build`
Expected: build do Next sem `next-auth` e sem avisos de módulo ausente.

- [ ] **Step 4: Commit**

```bash
git add -A src/lib/auth src/app/api src/types package.json package-lock.json jest.config.ts apps/api/jest.config.cjs apps/api/src/main.ts .env.example
git commit -m "chore(auth): remove o NextAuth; sessões antigas passam a exigir novo login"
```

No corpo do commit, registre: `BREAKING CHANGE: o cookie authjs.session-token deixa de ser aceito; todos os usuários precisam entrar novamente após o deploy.`

---

### Task 3.9: E2E da sessão própria (Playwright)

**Files:**
- Create: `e2e/sessao.spec.ts`
- Sem mudança (devem continuar verdes): `e2e/cadastro-escritorio.spec.ts`, `e2e/troca-escritorio.spec.ts` e os demais specs que logam

**Interfaces:**
- Consumes: UI de `/cadastro`, `/onboarding`, `/login`, switcher do header (`button` "Selecionar escritório"), menu do usuário (`menuitem` "Sair"); `GET /api/auth/sessao`.

- [ ] **Step 1: Escrever o spec**

`e2e/sessao.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

// Fluxos críticos da sessão própria (Fase 3 da migração): cookie crm_sessao emitido pela
// API Nest, login/logout, troca de escritório e sessões antigas do NextAuth invalidadas.
const SENHA = "senha-forte-123";

async function cadastrar(page: Page, nome: string, email: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(nome);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByLabel("Confirmar senha").fill(SENHA);
  await page.getByRole("button", { name: /cadastrar/i }).click();
  await expect(page).toHaveURL("/onboarding");
}

async function criarEscritorio(page: Page, nome: string) {
  await page.getByLabel("Nome do escritório").fill(nome);
  await page.getByRole("button", { name: /criar escritório/i }).click();
  await expect(page).toHaveURL("/");
}

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: /entrar/i }).click();
}

async function sair(page: Page, nome: string) {
  await page.getByRole("button", { name: new RegExp(nome) }).click();
  await page.getByRole("menuitem", { name: /sair/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe("Sessão própria (crm_sessao)", () => {
  test("cadastro + onboarding abrem sessão com cookie httpOnly e role do banco", async ({ page, context }) => {
    await cadastrar(page, "Advogada Sessão E2E", `e2e-sessao-${Date.now()}@teste.com`);

    const cookies = await context.cookies();
    const sessao = cookies.find((cookie) => cookie.name === "crm_sessao");
    expect(sessao?.httpOnly).toBe(true);
    expect(sessao?.sameSite).toBe("Lax");
    expect(cookies.some((cookie) => cookie.name.includes("authjs"))).toBe(false);

    await criarEscritorio(page, "Escritório Sessão E2E");

    const resposta = await page.request.get("/api/auth/sessao");
    expect(resposta.status()).toBe(200);
    expect(await resposta.json()).toMatchObject({ escritorioId: expect.any(String), role: "owner" });
  });

  test("logout limpa a sessão; login volta a abrir no escritório mais antigo", async ({ page, context }) => {
    const nome = "Advogado Logout E2E";
    const email = `e2e-logout-${Date.now()}@teste.com`;
    await cadastrar(page, nome, email);
    await criarEscritorio(page, "Escritório Antigo E2E");

    await page.getByRole("button", { name: /selecionar escritório/i }).click();
    await page.getByRole("menuitem", { name: /criar escritório/i }).click();
    await expect(page).toHaveURL("/onboarding");
    await criarEscritorio(page, "Escritório Novo E2E");

    await sair(page, nome);
    expect((await context.cookies()).some((cookie) => cookie.name === "crm_sessao")).toBe(false);
    expect((await page.request.get("/api/auth/sessao")).status()).toBe(401);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2F/);

    // Login escolhe a membership ativa mais antiga (resolverEscritorioAtivo).
    await entrar(page, email);
    await expect(page).toHaveURL("/");
    await page.goto("/configuracoes/escritorio");
    await expect(page.getByLabel("Nome do escritório")).toHaveValue("Escritório Antigo E2E");
  });

  test("troca de escritório regrava o cookie e sobrevive a um reload", async ({ page }) => {
    await cadastrar(page, "Advogada Troca Sessão", `e2e-troca-sessao-${Date.now()}@teste.com`);
    await criarEscritorio(page, "Escritório A Sessão");
    await page.getByRole("button", { name: /selecionar escritório/i }).click();
    await page.getByRole("menuitem", { name: /criar escritório/i }).click();
    await criarEscritorio(page, "Escritório B Sessão");

    await page.getByRole("button", { name: /selecionar escritório/i }).click();
    const [troca] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/sessao/escritorio-ativo")),
      page.getByRole("menuitem", { name: "Escritório A Sessão" }).click(),
    ]);
    expect(troca.status()).toBe(200);
    expect(troca.headers()["set-cookie"]).toContain("crm_sessao=");

    await page.reload();
    await page.goto("/configuracoes/escritorio");
    await expect(page.getByLabel("Nome do escritório")).toHaveValue("Escritório A Sessão");
  });

  test("login com credenciais inválidas mantém na tela e não grava cookie (FA-01)", async ({ page, context }) => {
    await entrar(page, "nao-existe@teste.com");

    await expect(page.getByText(/e-mail ou senha inválidos/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect((await context.cookies()).some((cookie) => cookie.name === "crm_sessao")).toBe(false);
  });

  test("cookie legado do NextAuth não abre sessão (decisão da Fase 3)", async ({ page, context }) => {
    await context.addCookies([
      { name: "authjs.session-token", value: "sessao-antiga", url: "http://localhost:3000" },
    ]);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("crm_sessao adulterado não abre sessão", async ({ page, context }) => {
    await context.addCookies([{ name: "crm_sessao", value: "a.b.c", url: "http://localhost:3000" }]);

    await page.goto("/clientes");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fclientes/);
  });
});
```

O seletor de `sair` usa o nome do usuário porque o gatilho do menu (`SidebarMenuButton`) tem como nome acessível o nome e o e-mail. Se o Playwright achar dois botões, por exemplo com a sidebar colapsada no mobile, troque por `page.getByRole("button", { name: new RegExp(email) })`.

- [ ] **Step 2: Rodar**

Pré-condições: `API_NEST_URL=http://localhost:3001` no `.env.local` **antes** do `npm run build` (os rewrites entram no build), banco local de pé, `npm run api:dev` em outro terminal.

Run: `npx playwright test e2e/sessao.spec.ts`
Expected: 6 testes PASS.

Se algum falhar, abra `npx playwright show-report`. As causas mais prováveis são duas: `Set-Cookie` não repassado pelo rewrite (o teste de troca aponta isso) e `AUTH_SECRET` diferente entre o Next e a API (a sessão abre na API, mas o `proxy.ts` manda para `/login`).

Run: `npm run e2e`
Expected: toda a suíte PASS, inclusive `cadastro-escritorio.spec.ts` e `troca-escritorio.spec.ts`, que exercitam cadastro + onboarding + troca pela UI sem nenhuma mudança.

- [ ] **Step 3: Commit**

```bash
git add e2e/sessao.spec.ts
git commit -m "test(e2e): fluxos de sessão própria — login, logout, troca de escritório e cookie legado"
```

---

### Task 3.10: Atualizar o ADR da migração

**Files:**
- Modify: `docs/arquitetura/migracao-nestjs.md`

- [ ] **Step 1: Atualizar o documento**

Em `docs/arquitetura/migracao-nestjs.md`:

Troque a linha de status por `**Status:** em andamento (branch \`feature/migracao-nestjs\`) — Fases 1, 2 e 3 concluídas.`

Em **Estratégia: strangler**, troque o item que começa com "Até a Fase 3 a sessão continua sendo a do NextAuth" por:

```markdown
- Desde a Fase 3 a sessão é própria: cookie `crm_sessao` emitido pela API (ver
  **Autenticação** abaixo). O NextAuth foi removido.
```

Na lista de **Fases**, marque a 3: `3. Autenticação nativa no Nest; remoção do NextAuth ✅`. Marque também a 2, se a Fase 2 ainda não tiver marcado.

Acrescente, antes de **Como rodar**:

```markdown
## Autenticação (Fase 3)

- **Cookie** `crm_sessao`: JWT HS256 (`jose`) assinado com `AUTH_SECRET` (fallback
  `NEXTAUTH_SECRET`), `httpOnly`, `SameSite=Lax`, `Path=/`, `Secure` em produção, 30 dias
  de duração fixa (sem renovação deslizante). Payload: `{ sub, escritorioId }` —
  **sem `role`**: papel e membership sempre do banco (`resolverTenantContext`, RN19).
- **Módulo único**: `src/lib/auth/sessao-jwt.ts` (assinar, verificar, opções do cookie).
  Leitores: guards da API (`apps/api/src/comum/tenant/ler-sessao.ts`), `src/proxy.ts` e
  Server Components (`src/lib/auth/sessao-servidor.ts`). Quem grava: só o
  `SessaoModule` da API (`apps/api/src/sessao/`).
- **Endpoints**: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/sessao`,
  `POST /api/sessao/escritorio-ativo`, `POST /api/cadastro`, `POST /api/escritorios`.
  No browser, `src/lib/auth/cliente-sessao.ts` (`entrar`, `sair`).
- **Sessões antigas invalidadas**: o cookie `authjs.session-token` do NextAuth não é
  lido. Todo usuário precisou entrar de novo após o deploy da Fase 3 — decisão
  consciente, para não manter `next-auth/jwt` só para migrar cookies.
- **Mesmo segredo nos dois processos**: Next (proxy/Server Components) e API verificam o
  mesmo cookie, então `AUTH_SECRET` precisa ser idêntico nos dois.
```

Em **Convenções da API**, acrescente:

```markdown
- Rotas que só exigem usuário autenticado (sem tenant): `@UseGuards(UsuarioGuard)` +
  `@UsuarioId()`. Gravar/limpar o cookie só no `SessaoModule`, via
  `gravarCookieSessao`/`limparCookieSessao` (`apps/api/src/comum/sessao/cookie-sessao.ts`).
```

- [ ] **Step 2: Commit**

```bash
git add docs/arquitetura/migracao-nestjs.md
git commit -m "docs(arquitetura): registra a autenticação própria da Fase 3 no ADR da migração"
```

---

## Critério de pronto da Fase 3

- `npx jest`, `npm run api:test`, `npm run api:typecheck`, `npx tsc --noEmit`, `npm run lint` e `npm run build` passando; cobertura de `src/lib/auth/**` ≥ 90%.
- `npm run e2e` verde (com `npm run api:dev` de pé e `API_NEST_URL` no build), incluindo `e2e/sessao.spec.ts`.
- `grep -rn "next-auth" src apps e2e package.json` → vazio; `src/app/api/` contém só o que a Fase 4 ainda precisar (esperado: nada além de eventuais rotas que nenhuma fase migrou, o que já seria um bug da Fase 2).
- `ROTAS_NA_API_NEST` cobre todo `/api/*`: com `API_NEST_URL` vazia, nenhuma rota de API responde pelo Next.
- Deploy: `AUTH_SECRET` idêntico nos Projects do Next e da API em cada ambiente; o aviso "todos precisarão entrar novamente" foi comunicado antes do deploy em produção.

---

## Fase 4 — Front React + Vite (parte A: infraestrutura)

No início desta fase, a API inteira já está no Nest (Fases 2 e 3), inclusive a sessão (`crm_sessao`). O Next só renderiza páginas, e os Server Components ainda chamam services. A parte A sobe o front novo em `apps/web` (Vite 8 + React 19 + React Router 7 + TanStack Query + Tailwind 4) e move para lá todo o código de front que já existe: componentes, hooks, `apiFetch`, chaves de query e utils só do front. Também cria a camada que deixa esse código rodar fora do Next sem reescrita: compat de `next/navigation`, `next/link` e `next/image`, sessão via `/api/auth/sessao`, `RotaProtegida`, título por página, fontes e favicon. Por fim, monta a **árvore completa de rotas**, com cada página apontando para um `PaginaEmMigracao` provisório. A parte B porta as páginas uma a uma, trocando esses provisórios, e no fim remove o Next.

Durante toda a parte A, **o Next continua funcionando**. Uma ponte de aliases na raiz (Task 4.3) faz as páginas do Next acharem os arquivos movidos, e `@/compat/*` resolve, no lado do Next, para re-exports do próprio `next/*`. Assim dá para pausar entre quaisquer duas tasks, e a parte B pode portar página por página comparando com a versão do Next ainda no ar.

### Decisões desta parte

- **Versões fixadas** (verificadas com `npm view` em 2026-11-01): `vite@8.3.5`, `@vitejs/plugin-react@6.1.2` (peer `vite ^8`), `@tailwindcss/vite@4.3.3` (mesma versão do `tailwindcss` da raiz), `react-router@7.18.5`, `@fontsource-variable/inter@5.3.0`, `@fontsource-variable/geist-mono@5.3.0`, `@swc/core@1.16.21`, `@swc/jest@0.2.39`, `jest@29.7.0`, `jest-environment-jsdom@29.7.0`. O `react-router@8.5.1` já existe, mas a decisão da migração é a v7 (a v8 exige Node ≥ 22.22 e não traz nada de que a gente precise agora). No v7, tudo sai do pacote `react-router`. Só o `RouterProvider` com `flushSync` vem de `react-router/dom`.
- **Toolchain validado num spike** (scratchpad, fora do repo):
  - Vite 8 + plugin-react 6 + Tailwind 4 fazem build com alias `@/` e classes de tema.
  - Vite resolve `@/lib/utils` para `utils.ts` mesmo havendo a pasta `utils/` ao lado.
  - **As 74 suítes de front atuais** (`src/components`, `src/hooks`, `src/lib`) passam com `@swc/jest` no lugar do `next/jest`, usando o ambiente de teste da Task 4.1.
  - O React Router 7 no Jest/jsdom quebra de dois jeitos sem esse ambiente: `TextEncoder is not defined` ao importar e `Request is not defined` ao navegar num data router (`<Navigate>`, `createMemoryRouter`). Daí o ambiente próprio `apps/web/test/ambiente-jsdom.cjs`.
  - O `jest-fixed-jsdom` foi descartado: ele troca `FormData`, `Blob` e `URL` do jsdom pelos do Node, e o `new FormData(form)` das telas de login e cadastro quebra.
  - O Node 26 roda `.ts` direto (type stripping), então o codemod é um `.ts` executado com `node`.
- **Fronteira com o domínio até a Fase 5:**
  - O web importa do domínio só código puro, via alias `@dominio/*` → `../../src/*`: `@dominio/types/*`, `@dominio/lib/utils/<compartilhados>` e `@dominio/lib/auth/permissoes`.
  - Os utils compartilhados (usados pelo front **e** pela API) ficam em `src/lib/utils`: `campanha-mensagem`, `campanha-status-mensagem`, `campanha-tratamentos`, `cores-status`, `cpf`, `email`, `icones-status`, `telefone`.
  - Os 12 utils só do front vão para `apps/web/src/lib/utils`.
  - Os componentes não importam nenhum schema Zod de `src/lib/api` (verificado com grep), então nada de `src/lib/api` cruza a fronteira.
  - O `@prisma/client` continua aparecendo no front só como `import type { RoleMembro }`. Ele é apagado no build, e a Task 4.9 trava qualquer import de valor.
  - Essa fronteira é verificada por teste (Task 4.9).
- **`src/lib/auth/cliente-sessao.ts` (criado na Task 3.7) é código de browser.** Ele vira `apps/web/src/lib/sessao.ts` e mantém o contrato da Fase 3:
  - `entrar(): Promise<boolean>`;
  - `sair()`, que nunca lança e não navega; quem chama decide a navegação dura.

  Em cima disso, ganha `buscarSessao`, `useSessao` e `trocarEscritorio`.
- **Dois QueryClients.**
  - `queryClientRaiz` (singleton em `lib/query/query-client-raiz.ts`) guarda a sessão e atende as telas públicas.
  - O `QueryProvider` existente continua criando um client por escritório dentro da `RotaProtegida`. A sessão não pode morar no client do tenant, porque é ela que diz qual é o tenant.
  - `useSessao()` passa o `queryClientRaiz` explicitamente para o `useQuery`.
  - `router.refresh()` do compat invalida o client do tenant e a sessão. É o equivalente de "reler os Server Components", e por isso o `EscritorioSwitcher` (POST + `router.refresh()`) funciona sem mudança.
- **Tema:** `ThemeProvider` do `next-themes` com `attribute="class"`, `defaultTheme="light"` e `enableSystem={false}`. O `next-themes` não depende do Next: os únicos peers são `react` e `react-dom`, e o bundle só faz `require("react")`.
  - Hoje não existe `ThemeProvider`, então a página é sempre clara. Com essa configuração ela continua clara.
  - O `Toaster` passa a ser sempre claro. Antes ele seguia o tema do sistema operacional, porque o `useTheme()` sem provider devolvia `"system"`. É uma mudança consciente: a página nunca acompanhou o SO.
  - O `Toaster` vira **global** em `app.tsx`, e o shell do dashboard da parte B não renderiza outro.
- **Fontes:** `next/font/google` (Inter e Geist Mono) dá lugar a `@fontsource-variable/inter` e `@fontsource-variable/geist-mono`, sem requisição ao Google em runtime. As variáveis `--font-sans` e `--font-geist-mono` ficam num CSS **fora de `@layer`**, porque CSS sem camada vence a camada `theme` do Tailwind, exatamente como a classe do `next/font` fazia.
- **`public/` continua na raiz** enquanto o Next existir. O Vite usa `publicDir: ../../public`, e a parte B move a pasta para `apps/web/public` quando remover o Next.
- **Favicon:** `src/app/icon.tsx` (`ImageResponse` do `next/og`) vira `public/favicon.svg` estático, com o mesmo desenho e as mesmas cores. Os dois convivem até o Next sair.
- **`<html lang>`:** passa de `en` para `pt-BR` (acessibilidade e leitores de tela). O Next continua com `en` até sair.
- **E2E:** `playwright.config.ts` passa a ter dois alvos.
  - `E2E_ALVO=web` sobe a API e o Vite (build + preview em :5173).
  - O alvo padrão continua sendo o Next, porque as specs de fluxo só passam no web depois da parte B. A parte B inverte o padrão.

### Estrutura de arquivos

```
package.json                                     (modificar: scripts web:*, dev:tudo, e2e:web)
.gitignore                                       (modificar: /apps/web/dist)
tsconfig.json                                    (modificar: ponte de paths para apps/web)
jest.config.ts                                   (modificar: ponte no moduleNameMapper; cobertura de front sai da raiz)
playwright.config.ts                             (modificar: alvos next/web, webServer múltiplo)
public/favicon.svg                               (criar)
e2e/web-infra.spec.ts                            (criar)
src/app/layout.tsx                               (modificar: import do globals.css movido)
src/app/(auth)/login/page.tsx (+ .test.tsx)      (modificar: import de @/lib/sessao)
src/app/(auth)/cadastro/page.tsx (+ .test.tsx)   (modificar: import de @/lib/sessao)
src/components/shell/nav-usuario.tsx (+ .test.tsx) → apps/web (o import vira @/lib/sessao pelo codemod)
src/compat-next/next-navigation.ts               (criar: ponte — some com o Next)
src/compat-next/next-link.ts                     (criar: ponte)
src/compat-next/next-image.ts                    (criar: ponte)
src/components/**  → apps/web/src/components/**  (git mv)
src/hooks/**       → apps/web/src/hooks/**       (git mv)
src/lib/{api-client,api-client.test,utils,site-config}.ts, test-utils.tsx → apps/web/src/lib/ (git mv)
src/lib/auth/cliente-sessao{,.test}.ts → apps/web/src/lib/sessao{,.test}.ts (git mv)
src/lib/query/{chaves,opcoes-padrao}.ts → apps/web/src/lib/query/ (git mv)
src/lib/utils/<12 utils só do front>{,.test}.ts → apps/web/src/lib/utils/ (git mv)
src/app/globals.css → apps/web/src/globals.css   (git mv)
components.json     → apps/web/components.json   (git mv + editar)
apps/web/package.json, tsconfig.json, vite.config.ts, index.html, jest.config.cjs, jest.setup.ts
apps/web/test/ambiente-jsdom.cjs
apps/web/scripts/transformar-imports.ts (+ .test.ts), codemod-imports.ts
apps/web/src/main.tsx, app.tsx (+ .test.tsx), rotas.tsx (+ .test.tsx), fontes.css
apps/web/src/fronteira.test.ts
apps/web/src/compat/next-navigation.ts (+ .test.tsx), next-link.tsx (+ .test.tsx), next-image.tsx (+ .test.tsx)
apps/web/src/lib/query/query-client-raiz.ts
apps/web/src/lib/test-utils-rotas.tsx (+ .test.tsx)
apps/web/src/hooks/use-titulo-pagina.ts (+ .test.ts)
apps/web/src/paginas/pagina-em-migracao.tsx (+ .test.tsx)
apps/web/src/paginas/pagina-nao-encontrada.tsx
apps/web/src/paginas/layout-raiz.tsx
apps/web/src/paginas/rota-protegida.tsx (+ .test.tsx)
apps/web/src/paginas/auth/layout-auth.tsx
apps/web/src/paginas/dashboard/layout-dashboard.tsx          (provisório — a parte B porta o shell)
apps/web/src/paginas/dashboard/configuracoes/layout-configuracoes.tsx
```

### Mapa de rotas (Next → React Router → arquivo da parte B)

Na `rotas.tsx` desta parte, cada linha marcada "4b" aponta para `<PaginaEmMigracao caminhoNext="…" />`. A parte B cria o arquivo da última coluna e troca o elemento. A convenção é exportar `Pagina<Nome>` e chamar `useTituloPagina("<título>")` com o `metadata.title` do Next.

| Next (`src/app/…`) | Rota React Router | Elemento / arquivo | Título (`useTituloPagina`) | Quem |
|---|---|---|---|---|
| `layout.tsx` | rota raiz sem path | `paginas/layout-raiz.tsx` + `index.html` + `main.tsx` | padrão `CRM Advocacia` | 4a |
| `icon.tsx` | — | `public/favicon.svg` | — | 4a |
| `(auth)/layout.tsx` | layout sem path | `paginas/auth/layout-auth.tsx` | — | 4a |
| `(auth)/login/page.tsx` (+ `layout.tsx` só com metadata) | `/login` | `paginas/auth/login/pagina.tsx` → `PaginaLogin` | `Entrar` | 4b |
| `(auth)/cadastro/page.tsx` (+ `layout.tsx` só com metadata) | `/cadastro` | `paginas/auth/cadastro/pagina.tsx` → `PaginaCadastro` | `Criar conta` | 4b |
| `(onboarding)/onboarding/page.tsx` | `/onboarding` sob `RotaProtegida exigirEscritorio={false}` | `paginas/onboarding/pagina.tsx` → `PaginaOnboarding` | `Criar escritório` | 4b |
| `(dashboard)/layout.tsx` | layout sem path: `RotaProtegida` → `LayoutDashboard` | `paginas/dashboard/layout-dashboard.tsx` (provisório na 4a) | — | 4a/4b |
| `(dashboard)/page.tsx` | `/` (index) | `paginas/dashboard/pagina.tsx` → `PaginaDashboard` | `Dashboard` | 4b |
| `(dashboard)/clientes/page.tsx` | `/clientes` | `paginas/dashboard/clientes/pagina.tsx` → `PaginaClientes` | `Clientes` | 4b |
| `(dashboard)/casos/page.tsx` | `/casos` | `paginas/dashboard/casos/pagina.tsx` → `PaginaCasos` | `Processos` | 4b |
| `(dashboard)/agenda/page.tsx` | `/agenda` | `paginas/dashboard/agenda/pagina.tsx` → `PaginaAgenda` | `Agenda` | 4b |
| `(dashboard)/campanhas/page.tsx` | `/campanhas` (index) | `paginas/dashboard/campanhas/pagina.tsx` → `PaginaCampanhas` | `Campanhas` | 4b |
| `(dashboard)/campanhas/nova/page.tsx` | `/campanhas/nova` | `paginas/dashboard/campanhas/nova/pagina.tsx` → `PaginaNovaCampanha` | `Nova campanha` | 4b |
| `(dashboard)/campanhas/[id]/page.tsx` | `/campanhas/:id` | `paginas/dashboard/campanhas/detalhe/pagina.tsx` → `PaginaDetalheCampanha` | `Campanha` | 4b |
| `(dashboard)/instancias/page.tsx` | `/instancias` | `paginas/dashboard/instancias/pagina.tsx` → `PaginaInstancias` | `Instâncias` | 4b |
| `(dashboard)/perfil/page.tsx` | `/perfil` | `paginas/dashboard/perfil/pagina.tsx` → `PaginaPerfil` | `Perfil` | 4b |
| `(dashboard)/configuracoes/layout.tsx` | `/configuracoes` (layout) | `paginas/dashboard/configuracoes/layout-configuracoes.tsx` | — | 4a |
| `(dashboard)/configuracoes/page.tsx` (redirect) | `/configuracoes` (index) | `<Navigate to="/configuracoes/escritorio" replace />` | — | 4a |
| `(dashboard)/configuracoes/escritorio/page.tsx` | `/configuracoes/escritorio` | `paginas/dashboard/configuracoes/escritorio/pagina.tsx` → `PaginaConfiguracoesEscritorio` | `Escritório` | 4b |
| `(dashboard)/configuracoes/membros/page.tsx` | `/configuracoes/membros` | `…/configuracoes/membros/pagina.tsx` → `PaginaConfiguracoesMembros` | `Membros` | 4b |
| `(dashboard)/configuracoes/status/page.tsx` | `/configuracoes/status` | `…/configuracoes/status/pagina.tsx` → `PaginaConfiguracoesStatus` | `Status do Kanban` | 4b |
| `(dashboard)/configuracoes/tipos-processo/page.tsx` | `/configuracoes/tipos-processo` | `…/configuracoes/tipos-processo/pagina.tsx` → `PaginaConfiguracoesTiposProcesso` | `Tipos de processo` | 4b |
| — (404 padrão do Next) | `*` | `paginas/pagina-nao-encontrada.tsx` | `Página não encontrada` | 4a |
| `(dashboard)/_lib/tenant-context-pagina.ts` | — | some: o tenant vem da sessão (`useSessao`) | — | 4b |
| `**/_components/**` | — | sugestão: `paginas/<mesmo caminho>/_components/**` (`git mv` + codemod da Task 4.2) | — | 4b |

---

### Task 4.1: Workspace `@crm/web` com Vite, Jest e a página provisória

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/jest.config.cjs`, `apps/web/jest.setup.ts`, `apps/web/test/ambiente-jsdom.cjs`, `apps/web/src/main.tsx`, `apps/web/src/paginas/pagina-em-migracao.tsx`
- Test: `apps/web/src/paginas/pagina-em-migracao.test.tsx`
- Modify: `package.json` (scripts), `.gitignore`

**Interfaces:**
- Produces:
  - workspace `@crm/web` com os scripts `dev`, `build`, `preview`, `test`, `test:coverage` e `typecheck`;
  - na raiz, `web:dev`, `web:build`, `web:preview`, `web:test` e `web:typecheck`;
  - alias `@/*` → `apps/web/src/*` e `@dominio/*` → `src/*` (Vite, TS e Jest);
  - proxy `/api` → `API_NEST_URL ?? http://localhost:3001` em `server` e `preview`, porta 5173 fixa;
  - `export function PaginaEmMigracao(props: { caminhoNext: string }): JSX.Element`.

- [ ] **Step 1: Criar o pacote**

`apps/web/package.json`:

```json
{
  "name": "@crm/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@base-ui/react": "^1.7.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@fontsource-variable/geist-mono": "5.3.0",
    "@fontsource-variable/inter": "5.3.0",
    "@tanstack/react-query": "^5.101.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^4.4.0",
    "lucide-react": "^1.32.0",
    "next-themes": "^0.4.6",
    "papaparse": "^5.7.0",
    "react": "19.2.8",
    "react-day-picker": "^10.0.1",
    "react-dom": "19.2.8",
    "react-router": "7.18.5",
    "recharts": "^3.8.0",
    "shadcn": "^4.18.0",
    "sonner": "^2.0.8",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@swc/core": "1.16.21",
    "@swc/jest": "0.2.39",
    "@tailwindcss/vite": "4.3.3",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.5",
    "@types/jest": "^30.0.0",
    "@types/node": "^20",
    "@types/papaparse": "^5.5.2",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "6.1.2",
    "jest": "29.7.0",
    "jest-environment-jsdom": "29.7.0",
    "tailwindcss": "4.3.3",
    "typescript": "^5",
    "vite": "8.3.5"
  }
}
```

As faixas das dependências compartilhadas com a raiz (`react`, `react-dom`, `@tanstack/react-query`, `@base-ui/react`…) são **idênticas** às do `package.json` da raiz. Isso é de propósito. Com faixas divergentes, o npm instalaria uma segunda cópia em `apps/web/node_modules`. Uma segunda cópia de React quebra hooks, inclusive no Next, que vai compilar estes arquivos pela ponte da Task 4.3.

`apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "types": ["vite/client", "node", "jest"],
    "paths": {
      "@/*": ["./src/*", "../../src/*"],
      "@dominio/*": ["../../src/*"]
    }
  },
  "include": ["src", "scripts", "vite.config.ts", "jest.setup.ts"]
}
```

O segundo destino de `@/*` (`../../src/*`) existe **só para o typecheck** dos arquivos do domínio que o web alcança por `@dominio/`. Exemplo: `src/types/caso.ts` faz `import type { StatusDTO } from "@/types/status"`. Todos esses imports internos são `import type` (verificado), então somem no build e no Jest. O código do próprio web nunca depende desse fallback, e a Task 4.9 trava isso.

`apps/web/vite.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

// Mesma origem no browser: /api vai para a API Nest pelo proxy do Vite (dev e preview).
// O cookie httpOnly crm_sessao continua first-party, sem CORS, como era com os rewrites
// do Next (docs/arquitetura/migracao-nestjs.md).
const proxyDaApi = {
  "/api": { target: process.env.API_NEST_URL ?? "http://localhost:3001", changeOrigin: false },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // public/ continua na raiz enquanto o Next existir; a parte B move para apps/web/public.
  publicDir: caminho("../../public"),
  resolve: {
    alias: [
      // Domínio puro (tipos, utils, permissões) até a Fase 5 mover src/ para apps/api.
      { find: /^@dominio\//, replacement: caminho("../../src/") },
      { find: /^@\//, replacement: caminho("./src/") },
    ],
  },
  server: { port: 5173, strictPort: true, proxy: proxyDaApi },
  preview: { port: 5173, strictPort: true, proxy: proxyDaApi },
});
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="pt-BR" class="h-full antialiased">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      name="description"
      content="CRM para escritórios de advocacia — clientes, casos e mensagens em um só lugar."
    />
    <title>CRM Advocacia</title>
  </head>
  <body class="flex min-h-full flex-col">
    <div id="raiz" class="flex min-h-full flex-1 flex-col"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/test/ambiente-jsdom.cjs`:

```js
const JSDOMEnvironment = require("jest-environment-jsdom").default;

// jsdom do Jest 29 sem as APIs que o React Router 7 usa: TextEncoder (no import do
// pacote) e Request/Headers/AbortController (a cada navegação de um data router, ex.
// <Navigate> dentro de createMemoryRouter). As classes vêm do Node que roda o Jest.
// AbortController/AbortSignal também precisam ser os do Node: o Request do Node rejeita
// um signal do jsdom. FormData, Blob e URL continuam os do jsdom — o login faz
// `new FormData(form)`, que só o FormData do jsdom aceita.
class AmbienteJsdom extends JSDOMEnvironment {
  constructor(...args) {
    super(...args);
    this.global.TextEncoder = TextEncoder;
    this.global.TextDecoder = TextDecoder;
    this.global.Request = Request;
    this.global.Response = Response;
    this.global.Headers = Headers;
    this.global.AbortController = AbortController;
    this.global.AbortSignal = AbortSignal;
  }
}

module.exports = AmbienteJsdom;
```

`apps/web/jest.config.cjs`:

```js
// CJS de propósito: o pacote é "type": "module" e o Jest 29 roda em CommonJS.
// @swc/jest substitui o next/jest da raiz — mesmas transformações (TS + JSX automático).
// Metas de cobertura: docs/testes/estrategia-tdd.md (piso institucional de 25% no front).
module.exports = {
  testEnvironment: "<rootDir>/test/ambiente-jsdom.cjs",
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          transform: { react: { runtime: "automatic" } },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  moduleNameMapper: {
    "^@dominio/(.*)$": "<rootDir>/../../src/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/main.tsx",
    "!src/lib/test-utils*.tsx",
    // Primitivas geradas pelo shadcn CLI (docs/app/design-system.md) — cobertas pelos
    // componentes que as compõem.
    "!src/components/ui/**",
  ],
  coverageThreshold: {
    global: { branches: 25, functions: 25, lines: 25, statements: 25 },
  },
};
```

O setup é **cópia** do da raiz, com os polyfills de `matchMedia`, `PointerEvent`, `ResizeObserver` e `scrollIntoView` de que os testes de componente dependem. A raiz mantém o seu enquanto houver testes de página do Next.

Run: `cp jest.setup.ts apps/web/jest.setup.ts`

Em `package.json` (raiz), acrescentar em `"scripts"`:

```json
"web:dev": "npm run dev -w @crm/web",
"web:build": "npm run build -w @crm/web",
"web:preview": "npm run preview -w @crm/web",
"web:test": "npm test -w @crm/web",
"web:typecheck": "npm run typecheck -w @crm/web",
```

Em `.gitignore`, acrescentar ao bloco `# production`:

```
/apps/web/dist
```

Run: `npm install` (na raiz)
Expected: termina sem erro. `ls node_modules/@crm` mostra `api web`. `npm ls react react-dom @tanstack/react-query` mostra **uma** versão de cada (as do workspace aparecem como `deduped`). `ls apps/web/node_modules 2>/dev/null | grep -E "^(react|react-dom|@tanstack)$"` não imprime nada.

- [ ] **Step 2: Escrever o teste que falha**

`apps/web/src/paginas/pagina-em-migracao.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { PaginaEmMigracao } from "./pagina-em-migracao";

describe("PaginaEmMigracao", () => {
  it("identifica a página do Next que ainda não foi portada", () => {
    render(<PaginaEmMigracao caminhoNext="src/app/(dashboard)/clientes/page.tsx" />);

    expect(screen.getByRole("heading", { name: "Página em migração" })).toBeInTheDocument();
    expect(screen.getByText("src/app/(dashboard)/clientes/page.tsx")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm run web:test`
Expected: FAIL com `Cannot find module './pagina-em-migracao'`.

- [ ] **Step 4: Implementar**

`apps/web/src/paginas/pagina-em-migracao.tsx`:

```tsx
export interface PaginaEmMigracaoProps {
  /** Página do Next que esta rota ainda espera, ex.: "src/app/(dashboard)/clientes/page.tsx". */
  caminhoNext: string;
}

// Marcador provisório da Fase 4: a árvore de rotas do React nasce completa (parte A) e
// cada rota aponta para cá até a parte B portar a página do Next correspondente.
export function PaginaEmMigracao({ caminhoNext }: PaginaEmMigracaoProps) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold text-foreground">Página em migração</h1>
      <p className="text-sm text-muted-foreground">
        Origem no Next: <code className="font-mono">{caminhoNext}</code>
      </p>
    </section>
  );
}
```

`apps/web/src/main.tsx` (provisório; a Task 4.8 troca pelo app completo):

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PaginaEmMigracao } from "@/paginas/pagina-em-migracao";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <PaginaEmMigracao caminhoNext="src/app/layout.tsx" />
  </StrictMode>
);
```

- [ ] **Step 5: Rodar os testes, o typecheck e o build**

Run: `npm run web:test`
Expected: PASS (1 suíte, 1 teste).

Run: `npm run web:build`
Expected: o `tsc` não acusa erro, e o `vite build` termina com `✓ built in …`, gerando `apps/web/dist/index.html`.

Run: `npx jest` (raiz)
Expected: as suítes da raiz continuam passando. `apps/` está fora do Jest da raiz desde a Fase 1.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore apps/web
git commit -m "feat(web): cria o workspace apps/web com Vite, React 19 e Jest"
```

---

### Task 4.2: Codemod de imports (Next → compat, domínio → `@dominio`)

**Files:**
- Create: `apps/web/scripts/transformar-imports.ts`, `apps/web/scripts/codemod-imports.ts`
- Modify: `apps/web/jest.config.cjs` (`roots` passa a incluir `scripts`)
- Test: `apps/web/scripts/transformar-imports.test.ts`

**Interfaces:**
- Produces (a parte B reaproveita o codemod ao mover `src/app/**`):
  ```ts
  // apps/web/scripts/transformar-imports.ts
  export const UTILS_DO_DOMINIO: readonly ["campanha-mensagem", "campanha-status-mensagem", "campanha-tratamentos", "cores-status", "cpf", "email", "icones-status", "telefone"];
  export function trocarEspecificador(especificador: string): string;
  export function transformarImports(codigo: string): string;        // idempotente
  export function extrairEspecificadores(codigo: string): string[];  // usado pela guarda da Task 4.9
  ```
  CLI: `node apps/web/scripts/codemod-imports.ts <arquivo|pasta>...`. Reescreve os `.ts`/`.tsx` no lugar e imprime `N arquivo(s) alterado(s).`.
- Regras de troca: `next/navigation` → `@/compat/next-navigation`; `next/link` → `@/compat/next-link`; `next/image` → `@/compat/next-image`; `@/lib/auth/cliente-sessao` → `@/lib/sessao`; `@/lib/auth/permissoes` → `@dominio/lib/auth/permissoes`; `@/lib/utils/<UTILS_DO_DOMINIO>` → `@dominio/lib/utils/<…>`; `@/types/*` → `@dominio/types/*`. Elas valem em `from "…"`, `import "…"`, `import("…")` e `jest.mock/doMock/unmock/requireActual/requireMock("…")`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/scripts/transformar-imports.test.ts`:

```ts
import {
  UTILS_DO_DOMINIO,
  extrairEspecificadores,
  transformarImports,
  trocarEspecificador,
} from "./transformar-imports";

describe("trocarEspecificador", () => {
  it.each([
    ["next/navigation", "@/compat/next-navigation"],
    ["next/link", "@/compat/next-link"],
    ["next/image", "@/compat/next-image"],
    ["@/lib/auth/cliente-sessao", "@/lib/sessao"],
    ["@/lib/auth/permissoes", "@dominio/lib/auth/permissoes"],
    ["@/lib/utils/cpf", "@dominio/lib/utils/cpf"],
    ["@/types/caso", "@dominio/types/caso"],
  ])("%s → %s", (de, para) => {
    expect(trocarEspecificador(de)).toBe(para);
  });

  it.each(["@/lib/utils", "@/lib/utils/data", "@/components/ui/button", "react", "./local"])(
    "mantém %s",
    (especificador) => {
      expect(trocarEspecificador(especificador)).toBe(especificador);
    }
  );
});

describe("transformarImports", () => {
  it("reescreve imports, re-exports e mocks do Jest", () => {
    const antes = [
      'import { useRouter } from "next/navigation";',
      "import Link from 'next/link';",
      'import type { CasoDTO } from "@/types/caso";',
      'export type { ComentarioDTO } from "@/types/comentario";',
      'jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));',
      'const real = jest.requireActual("next/navigation");',
    ].join("\n");

    expect(transformarImports(antes)).toBe(
      [
        'import { useRouter } from "@/compat/next-navigation";',
        "import Link from '@/compat/next-link';",
        'import type { CasoDTO } from "@dominio/types/caso";',
        'export type { ComentarioDTO } from "@dominio/types/comentario";',
        'jest.mock("@/compat/next-navigation", () => ({ useRouter: jest.fn() }));',
        'const real = jest.requireActual("@/compat/next-navigation");',
      ].join("\n")
    );
  });

  it("não mexe em strings fora de posição de import", () => {
    const codigo = 'const rota = "next/link";\nconst tipo = "@/types/caso";';

    expect(transformarImports(codigo)).toBe(codigo);
  });

  it("é idempotente", () => {
    const codigo = 'import Image from "next/image";\nimport { formatarCpf } from "@/lib/utils/cpf";';
    const umaVez = transformarImports(codigo);

    expect(transformarImports(umaVez)).toBe(umaVez);
  });
});

describe("extrairEspecificadores", () => {
  it("lista os módulos importados, inclusive side-effect e import dinâmico", () => {
    const codigo = [
      'import "./estilo.css";',
      'import type { RoleMembro } from "@prisma/client";',
      'const modulo = await import("./preguicoso");',
    ].join("\n");

    expect(extrairEspecificadores(codigo)).toEqual(["./estilo.css", "@prisma/client", "./preguicoso"]);
  });
});

it("UTILS_DO_DOMINIO são exatamente os utils usados pelo front e pela API", () => {
  expect([...UTILS_DO_DOMINIO].sort()).toEqual([
    "campanha-mensagem",
    "campanha-status-mensagem",
    "campanha-tratamentos",
    "cores-status",
    "cpf",
    "email",
    "icones-status",
    "telefone",
  ]);
});
```

Em `apps/web/jest.config.cjs`, troque `roots: ["<rootDir>/src"],` por `roots: ["<rootDir>/src", "<rootDir>/scripts"],`. Isso só entra agora porque o Jest recusa um `roots` que aponte para pasta inexistente.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run web:test -- transformar-imports`
Expected: FAIL com `Cannot find module './transformar-imports'`.

- [ ] **Step 3: Implementar**

`apps/web/scripts/transformar-imports.ts`:

```ts
// Utils puros usados pelo front E pela API: continuam em src/lib/utils (domínio) até a
// Fase 5, e o web os importa por @dominio/. Os demais utils de src/lib/utils são só do
// front e foram movidos para apps/web/src/lib/utils (Task 4.3).
export const UTILS_DO_DOMINIO = [
  "campanha-mensagem",
  "campanha-status-mensagem",
  "campanha-tratamentos",
  "cores-status",
  "cpf",
  "email",
  "icones-status",
  "telefone",
] as const;

const TROCAS_EXATAS = new Map<string, string>([
  ["next/navigation", "@/compat/next-navigation"],
  ["next/link", "@/compat/next-link"],
  ["next/image", "@/compat/next-image"],
  ["@/lib/auth/cliente-sessao", "@/lib/sessao"],
  ["@/lib/auth/permissoes", "@dominio/lib/auth/permissoes"],
  ...UTILS_DO_DOMINIO.map((util): [string, string] => [`@/lib/utils/${util}`, `@dominio/lib/utils/${util}`]),
]);

// Só reescreve string em posição de módulo: `from "x"`, `import "x"`, `import("x")` e as
// APIs de mock do Jest. Uma string comum com o mesmo texto fica intacta.
function padraoDeEspecificador() {
  return /(\bfrom\s+|\bimport\s+|\bimport\s*\(\s*|\bjest\.(?:mock|doMock|unmock|requireActual|requireMock)\(\s*)(["'])([^"'\n]+)\2/g;
}

export function trocarEspecificador(especificador: string): string {
  const exata = TROCAS_EXATAS.get(especificador);
  if (exata) return exata;
  if (especificador.startsWith("@/types/")) {
    return `@dominio/types/${especificador.slice("@/types/".length)}`;
  }
  return especificador;
}

export function transformarImports(codigo: string): string {
  return codigo.replace(
    padraoDeEspecificador(),
    (_trecho, prefixo: string, aspas: string, especificador: string) =>
      `${prefixo}${aspas}${trocarEspecificador(especificador)}${aspas}`
  );
}

export function extrairEspecificadores(codigo: string): string[] {
  return [...codigo.matchAll(padraoDeEspecificador())].map((casamento) => casamento[3]);
}
```

`apps/web/scripts/codemod-imports.ts`:

```ts
// Uso: node apps/web/scripts/codemod-imports.ts <arquivo|pasta>...
// Node 26 executa .ts direto (type stripping) — por isso o import com extensão.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformarImports } from "./transformar-imports.ts";

function listarArquivos(caminho: string): string[] {
  if (statSync(caminho).isFile()) return [caminho];
  return readdirSync(caminho, { withFileTypes: true }).flatMap((entrada) => {
    if (entrada.name === "node_modules" || entrada.name === "dist") return [];
    const completo = join(caminho, entrada.name);
    if (entrada.isDirectory()) return listarArquivos(completo);
    return /\.(ts|tsx)$/.test(entrada.name) ? [completo] : [];
  });
}

const alvos = process.argv.slice(2);
if (alvos.length === 0) {
  console.error("uso: node apps/web/scripts/codemod-imports.ts <arquivo|pasta>...");
  process.exit(1);
}

let alterados = 0;
for (const arquivo of alvos.flatMap(listarArquivos)) {
  const original = readFileSync(arquivo, "utf8");
  const novo = transformarImports(original);
  if (novo !== original) {
    writeFileSync(arquivo, novo);
    alterados += 1;
    console.log(`alterado: ${arquivo}`);
  }
}
console.log(`${alterados} arquivo(s) alterado(s).`);
```

- [ ] **Step 4: Rodar os testes e o typecheck**

Run: `npm run web:test -- transformar-imports`
Expected: PASS.

Run: `npm run web:typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/scripts
git commit -m "chore(web): codemod que reescreve imports do Next e do domínio"
```

---

### Task 4.3: Mover o front para `apps/web` e ligar a ponte do Next

Esta task só **move** arquivos e religa imports. Os testes do web só voltam a rodar verdes na Task 4.4, que cria os módulos `@/compat/*` que o codemod passa a importar, então **não rode `web:test` aqui**. O critério desta task é a raiz: o Jest da raiz, o `tsc` da raiz e o Next em dev continuam funcionando com os arquivos já movidos.

**Files:**
- Move (git mv): `src/components/**` → `apps/web/src/components/**`; `src/hooks/**` → `apps/web/src/hooks/**`; `src/lib/{api-client.ts,api-client.test.ts,utils.ts,site-config.ts,test-utils.tsx}` → `apps/web/src/lib/`; `src/lib/auth/cliente-sessao.ts` → `apps/web/src/lib/sessao.ts`; `src/lib/auth/cliente-sessao.test.ts` → `apps/web/src/lib/sessao.test.ts`; `src/lib/query/{chaves,opcoes-padrao}.ts` → `apps/web/src/lib/query/`; `src/lib/utils/{agenda-eventos,agenda-grade,agenda-layout,csv-campanha,data-input,data,nome,oab,role,tipo-arquivo,valor,whatsapp-formatacao}.ts` (+ os `.test.ts` existentes) → `apps/web/src/lib/utils/`; `src/app/globals.css` → `apps/web/src/globals.css`; `components.json` → `apps/web/components.json`
- Create: `src/compat-next/next-navigation.ts`, `src/compat-next/next-link.ts`, `src/compat-next/next-image.ts`
- Modify: `tsconfig.json`, `jest.config.ts`, `src/app/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/page.test.tsx`, `src/app/(auth)/cadastro/page.tsx`, `src/app/(auth)/cadastro/page.test.tsx`, `apps/web/components.json`, `apps/web/src/lib/sessao.test.ts`
- Fica em `src/` (só o Next usa; sai com o Next na parte B): `src/lib/query/query-client-servidor.ts`

**Interfaces:**
- Consumes: codemod da Task 4.2.
- Produces (ponte temporária, removida pela parte B junto com o Next):
  - na raiz, `@/compat/*` → `src/compat-next/*` (re-export de `next/*`);
  - `@dominio/*` → `src/*`;
  - os caminhos movidos de `@/…` → `apps/web/src/…`, no `tsconfig.json` e no `moduleNameMapper` do `jest.config.ts`.

- [ ] **Step 1: Mover os arquivos**

```bash
mkdir -p apps/web/src/lib/query apps/web/src/lib/utils
git mv src/components apps/web/src/components
git mv src/hooks apps/web/src/hooks
git mv src/lib/api-client.ts src/lib/api-client.test.ts src/lib/utils.ts src/lib/site-config.ts src/lib/test-utils.tsx apps/web/src/lib/
git mv src/lib/auth/cliente-sessao.ts apps/web/src/lib/sessao.ts
git mv src/lib/auth/cliente-sessao.test.ts apps/web/src/lib/sessao.test.ts
git mv src/lib/query/chaves.ts src/lib/query/opcoes-padrao.ts apps/web/src/lib/query/
for u in agenda-eventos agenda-grade agenda-layout csv-campanha data-input data nome oab role tipo-arquivo valor whatsapp-formatacao; do
  git mv "src/lib/utils/$u.ts" apps/web/src/lib/utils/
  if [ -f "src/lib/utils/$u.test.ts" ]; then git mv "src/lib/utils/$u.test.ts" apps/web/src/lib/utils/; fi
done
git mv src/app/globals.css apps/web/src/globals.css
git mv components.json apps/web/components.json
```

Run: `git status --short | grep -c "^R"`
Expected: 185 renomeações (181 arquivos de front, mais `sessao.ts`, `sessao.test.ts`, `globals.css` e `components.json`). Se as Fases 2 e 3 criaram arquivos novos em `src/components` ou `src/hooks`, o número sobe; o que importa é `ls src/components src/hooks 2>&1` responder `No such file or directory`.

O teste movido de `cliente-sessao` importa o próprio módulo pelo nome antigo:

Run: `sed -i '' 's#from "./cliente-sessao"#from "./sessao"#' apps/web/src/lib/sessao.test.ts && grep -n 'from "./' apps/web/src/lib/sessao.test.ts`
Expected: `import { entrar, sair } from "./sessao";`.

- [ ] **Step 2: Rodar o codemod nos arquivos movidos**

Run: `node apps/web/scripts/codemod-imports.ts apps/web/src`
Expected: lista os arquivos alterados e fecha com `N arquivo(s) alterado(s).` (≈ 95 no estado do repo em 2026-11-01).

Run: `grep -rnE "(from |import |jest\.mock\()['\"](next(/|['\"])|next-auth|@/types/|@/lib/auth/)" apps/web/src`
Expected: nenhuma saída.

Os `"use client"` ficam nos arquivos movidos. O Vite os ignora sem erro, e o Next ainda precisa deles enquanto compilar esses componentes pela ponte.

- [ ] **Step 3: Atualizar o `components.json`**

`apps/web/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

Daqui em diante o shadcn CLI roda de dentro de `apps/web` (`cd apps/web && npx shadcn@latest add <componente>`). O `docs/app/design-system.md` é atualizado na Fase 5, junto com os demais docs.

- [ ] **Step 4: Criar os shims da ponte no lado do Next**

`src/compat-next/next-navigation.ts`:

```ts
// Ponte temporária da Fase 4: os componentes movidos para apps/web importam
// "@/compat/next-navigation". Enquanto o Next ainda renderiza as páginas, o alias da raiz
// aponta para cá e o contrato continua sendo o do próprio Next. Some junto com o Next
// (parte B da Fase 4). No front Vite, o mesmo alias resolve para apps/web/src/compat.
export { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
```

`src/compat-next/next-link.ts`:

```ts
// Ponte temporária da Fase 4 — ver src/compat-next/next-navigation.ts.
export { default, default as Link } from "next/link";
```

`src/compat-next/next-image.ts`:

```ts
// Ponte temporária da Fase 4 — ver src/compat-next/next-navigation.ts.
export { default, default as Image } from "next/image";
```

- [ ] **Step 5: Ponte de aliases no `tsconfig.json` da raiz**

Antes de editar, ler a doc de aliases do Next 16. A ponte depende de o Next respeitar `paths` com entradas exatas e prefixo mais longo (semântica do TypeScript).

Run: `grep -n -A12 -i "paths" node_modules/next/dist/docs/01-app/01-getting-started/01-installation.md`
Expected: a doc descreve `compilerOptions.paths` do `tsconfig.json` como a forma de declarar aliases. Se tiver mudado, adapte o Step à forma documentada.

Em `tsconfig.json` (raiz), troque `"paths": { "@/*": ["./src/*"] }` por:

```json
    "paths": {
      "@/compat/*": ["./src/compat-next/*"],
      "@dominio/*": ["./src/*"],
      "@/components/*": ["./apps/web/src/components/*"],
      "@/hooks/*": ["./apps/web/src/hooks/*"],
      "@/lib/utils": ["./apps/web/src/lib/utils.ts"],
      "@/lib/api-client": ["./apps/web/src/lib/api-client.ts"],
      "@/lib/sessao": ["./apps/web/src/lib/sessao.ts"],
      "@/lib/site-config": ["./apps/web/src/lib/site-config.ts"],
      "@/lib/test-utils": ["./apps/web/src/lib/test-utils.tsx"],
      "@/lib/query/chaves": ["./apps/web/src/lib/query/chaves.ts"],
      "@/lib/query/opcoes-padrao": ["./apps/web/src/lib/query/opcoes-padrao.ts"],
      "@/lib/query/query-client-raiz": ["./apps/web/src/lib/query/query-client-raiz.ts"],
      "@/lib/utils/agenda-eventos": ["./apps/web/src/lib/utils/agenda-eventos.ts"],
      "@/lib/utils/agenda-grade": ["./apps/web/src/lib/utils/agenda-grade.ts"],
      "@/lib/utils/agenda-layout": ["./apps/web/src/lib/utils/agenda-layout.ts"],
      "@/lib/utils/csv-campanha": ["./apps/web/src/lib/utils/csv-campanha.ts"],
      "@/lib/utils/data-input": ["./apps/web/src/lib/utils/data-input.ts"],
      "@/lib/utils/data": ["./apps/web/src/lib/utils/data.ts"],
      "@/lib/utils/nome": ["./apps/web/src/lib/utils/nome.ts"],
      "@/lib/utils/oab": ["./apps/web/src/lib/utils/oab.ts"],
      "@/lib/utils/role": ["./apps/web/src/lib/utils/role.ts"],
      "@/lib/utils/tipo-arquivo": ["./apps/web/src/lib/utils/tipo-arquivo.ts"],
      "@/lib/utils/valor": ["./apps/web/src/lib/utils/valor.ts"],
      "@/lib/utils/whatsapp-formatacao": ["./apps/web/src/lib/utils/whatsapp-formatacao.ts"],
      "@/*": ["./src/*"]
    }
```

Cada entrada aponta para **um** destino. Fallback com vários destinos por padrão não é usado, porque o suporte a ele no Turbopack não foi verificado. O TypeScript e o Next escolhem o padrão de prefixo mais longo, então `@/compat/*` e as entradas exatas vencem `@/*`. `query-client-raiz.ts` só passa a existir na Task 4.4, e um `paths` para arquivo inexistente é inofensivo.

- [ ] **Step 6: A mesma ponte no Jest da raiz**

Em `jest.config.ts`, troque o `moduleNameMapper` por (a ordem importa, porque o Jest usa a primeira regex que casa):

```ts
  // Ponte da Fase 4 (docs/arquitetura/migracao-nestjs.md): o front mora em apps/web, mas
  // as páginas do Next (e seus testes) ainda o importam por "@/". Espelha os paths do
  // tsconfig.json. Sai junto com o Next.
  moduleNameMapper: {
    "^@/compat/(.*)$": "<rootDir>/src/compat-next/$1",
    "^@dominio/(.*)$": "<rootDir>/src/$1",
    "^@/(components|hooks)/(.*)$": "<rootDir>/apps/web/src/$1/$2",
    "^@/lib/(utils|api-client|sessao|site-config|test-utils)$": "<rootDir>/apps/web/src/lib/$1",
    "^@/lib/query/(chaves|opcoes-padrao|query-client-raiz)$": "<rootDir>/apps/web/src/lib/query/$1",
    "^@/lib/utils/(agenda-eventos|agenda-grade|agenda-layout|csv-campanha|data-input|data|nome|oab|role|tipo-arquivo|valor|whatsapp-formatacao)$":
      "<rootDir>/apps/web/src/lib/utils/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
```

No mesmo arquivo, a cobertura de front passa a ser do workspace web. Isso significa:
- remover `"src/components/**/*.{ts,tsx}"`, `"src/hooks/**/*.{ts,tsx}"` e `"!src/components/ui/**"` (com o comentário acima dele) de `collectCoverageFrom`;
- remover as chaves `"src/components/**/*.{ts,tsx}"` e `"src/hooks/**/*.{ts,tsx}"` de `coverageThreshold`.

- [ ] **Step 7: Religar os imports que ficaram no Next**

Em `src/app/layout.tsx`, troque `import "./globals.css";` por:

```ts
// Ponte da Fase 4: os tokens de tema vivem em apps/web (shadcn/Tailwind do front Vite).
import "../../apps/web/src/globals.css";
```

As páginas de login e cadastro do Next (e seus testes) importam o antigo `cliente-sessao`:

Run: `sed -i '' 's#@/lib/auth/cliente-sessao#@/lib/sessao#g' "src/app/(auth)/login/page.tsx" "src/app/(auth)/login/page.test.tsx" "src/app/(auth)/cadastro/page.tsx" "src/app/(auth)/cadastro/page.test.tsx"`

Run: `grep -rn "lib/auth/cliente-sessao" src apps e2e`
Expected: nenhuma saída.

- [ ] **Step 8: Verificar a raiz**

Run: `npx jest` (raiz)
Expected: tudo PASS. As suítes de `src/app/**` (páginas e `_components`) continuam passando. Elas importam os arquivos movidos pela ponte, e o `jest.mock("next/navigation")` delas continua valendo, porque `src/compat-next` re-exporta `next/navigation`. As suítes movidas não rodam mais na raiz.

Run: `npx tsc --noEmit` (raiz)
Expected: sem erros.

Run: `npm run lint`
Expected: sem erros (`apps/**` segue ignorado desde a Fase 1).

Smoke test manual: terminal 1 com `npm run api:dev`, terminal 2 com `npm run dev` (`API_NEST_URL=http://localhost:3001` no `.env.local`). Abra `http://localhost:3000/login`, entre, navegue por Dashboard, Clientes, Processos, Agenda e Configurações e saia pelo menu do usuário.
Expected: o visual não muda (tokens e fontes iguais) e não há erro no console do browser nem no terminal do Next.

Se o Next acusar `Module not found` para algum `@/…` movido, o arquivo está faltando na ponte. Acrescente a entrada exata no `tsconfig.json` e no `jest.config.ts` (Steps 5 e 6). Não volte a usar destinos múltiplos.

- [ ] **Step 9: Commit**

```bash
git add -A src apps/web tsconfig.json jest.config.ts components.json
git commit -m "refactor(web): move componentes, hooks e utils de front para apps/web"
```

---

### Task 4.4: Camada de compatibilidade (`next/navigation`, `next/link`, `next/image`)

**Files:**
- Create: `apps/web/src/compat/next-navigation.ts`, `apps/web/src/compat/next-link.tsx`, `apps/web/src/compat/next-image.tsx`, `apps/web/src/lib/query/query-client-raiz.ts`, `apps/web/src/lib/test-utils-rotas.tsx`
- Modify: `apps/web/src/lib/query/chaves.ts`
- Test: `apps/web/src/compat/next-navigation.test.tsx`, `apps/web/src/compat/next-link.test.tsx`, `apps/web/src/compat/next-image.test.tsx`, `apps/web/src/lib/test-utils-rotas.test.tsx`, mais as 65 suítes movidas na Task 4.3

**Interfaces:**
- Produces:
  ```ts
  // apps/web/src/compat/next-navigation.ts
  export interface OpcoesNavegacao { scroll?: boolean }
  export interface RoteadorCompat {
    push(href: string, opcoes?: OpcoesNavegacao): void;
    replace(href: string, opcoes?: OpcoesNavegacao): void;
    back(): void;
    forward(): void;
    refresh(): void;          // invalida o QueryClient do contexto (tenant) + a sessão no queryClientRaiz
    prefetch(href: string): void; // no-op
  }
  export type ReadonlyURLSearchParams = Omit<URLSearchParams, "append" | "delete" | "set" | "sort">;
  export function useRouter(): RoteadorCompat;
  export function usePathname(): string;
  export function useSearchParams(): ReadonlyURLSearchParams;
  export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T;

  // apps/web/src/compat/next-link.tsx
  export interface LinkProps extends Omit<ComponentPropsWithRef<"a">, "href"> {
    href: string; replace?: boolean; scroll?: boolean; prefetch?: boolean | null;
  }
  export function Link(props: LinkProps): JSX.Element; // também `export default`
  // Fora de um <Router> (componente isolado em teste) renderiza <a href> comum.

  // apps/web/src/compat/next-image.tsx
  export interface ImageProps extends Omit<ComponentPropsWithRef<"img">, "src" | "alt" | "width" | "height" | "loading"> {
    src: string; alt: string; width?: number; height?: number; fill?: boolean; priority?: boolean;
    sizes?: string; quality?: number; unoptimized?: boolean; placeholder?: string;
  }
  export function Image(props: ImageProps): JSX.Element; // também `export default`

  // apps/web/src/lib/query/query-client-raiz.ts
  export const queryClientRaiz: QueryClient;

  // apps/web/src/lib/query/chaves.ts (acréscimo)
  export const chaveSessao: () => readonly ["sessao"];

  // apps/web/src/lib/test-utils-rotas.tsx
  export interface OpcoesRenderComRotas extends Omit<RenderOptions, "wrapper"> { rota?: string; padrao?: string }
  export function renderComRotas(ui: ReactElement, opcoes?: OpcoesRenderComRotas): RenderResult & { queryClient: QueryClient };
  ```

- [ ] **Step 1: Escrever os testes que falham**

`apps/web/src/compat/next-navigation.test.tsx`:

```tsx
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";
import { useParams, usePathname, useRouter, useSearchParams } from "./next-navigation";

function montar(rota: string, padrao = "*") {
  const queryClient = criarQueryClientDeTeste();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[rota]}>
          <Routes>
            <Route path={padrao} element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  const hook = renderHook(
    () => ({
      router: useRouter(),
      pathname: usePathname(),
      searchParams: useSearchParams(),
      params: useParams(),
    }),
    { wrapper: Wrapper }
  );
  return { queryClient, ...hook };
}

describe("compat de next/navigation", () => {
  it("usePathname e useSearchParams leem a URL atual", () => {
    const { result } = montar("/agenda?visao=semana&data=2026-09-10");

    expect(result.current.pathname).toBe("/agenda");
    expect(result.current.searchParams.get("visao")).toBe("semana");
    expect(result.current.searchParams.get("data")).toBe("2026-09-10");
  });

  it("useParams expõe os segmentos dinâmicos da rota", () => {
    const { result } = montar("/campanhas/abc123", "/campanhas/:id");

    expect(result.current.params).toEqual({ id: "abc123" });
  });

  it("push empilha no histórico e back volta para a entrada anterior", () => {
    const { result } = montar("/clientes");

    act(() => result.current.router.push("/casos"));
    act(() => result.current.router.push("/agenda"));
    expect(result.current.pathname).toBe("/agenda");

    act(() => result.current.router.back());
    expect(result.current.pathname).toBe("/casos");
  });

  it("replace troca a entrada atual sem empilhar (aceita { scroll: false } como no Next)", () => {
    const { result } = montar("/clientes");

    act(() => result.current.router.push("/agenda?visao=mes"));
    act(() => result.current.router.replace("/agenda?visao=semana", { scroll: false }));
    expect(result.current.searchParams.get("visao")).toBe("semana");

    act(() => result.current.router.back());
    expect(result.current.pathname).toBe("/clientes");
  });

  // No Next, refresh() relia os Server Components — dados do tenant e sessão. Aqui o
  // equivalente é invalidar o cache do tenant e a sessão (ex.: após trocar de escritório).
  it("refresh invalida o cache do tenant e a sessão", () => {
    const { result, queryClient } = montar("/configuracoes/escritorio");
    const invalidarTenant = jest.spyOn(queryClient, "invalidateQueries");
    const invalidarRaiz = jest.spyOn(queryClientRaiz, "invalidateQueries");

    act(() => result.current.router.refresh());

    expect(invalidarTenant).toHaveBeenCalledWith();
    expect(invalidarRaiz).toHaveBeenCalledWith({ queryKey: ["sessao"] });
    invalidarRaiz.mockRestore();
  });
});
```

`apps/web/src/compat/next-link.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import Link from "./next-link";

function LocalAtual() {
  const { pathname } = useLocation();
  return <p data-testid="local">{pathname}</p>;
}

describe("Link (compat de next/link)", () => {
  it("navega pelo React Router e repassa className", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Link href="/perfil" className="item-menu">
          Perfil
        </Link>
        <LocalAtual />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: "Perfil" });
    expect(link).toHaveAttribute("href", "/perfil");
    expect(link).toHaveClass("item-menu");

    await user.click(link);
    expect(screen.getByTestId("local")).toHaveTextContent("/perfil");
  });

  it("não vaza props exclusivas do Next para o DOM", () => {
    render(
      <MemoryRouter>
        <Link href="/casos" prefetch={false} scroll={false}>
          Processos
        </Link>
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: "Processos" });
    expect(link).not.toHaveAttribute("prefetch");
    expect(link).not.toHaveAttribute("scroll");
  });

  // Componentes com Link costumam ser testados isolados, sem router (como no Next).
  it("fora de um router vira um <a> comum", () => {
    render(<Link href="/clientes">Clientes</Link>);

    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("href", "/clientes");
  });
});
```

`apps/web/src/compat/next-image.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import Image from "./next-image";

describe("Image (compat de next/image)", () => {
  it("renderiza <img> com src, alt e dimensões, com carregamento lazy por padrão", () => {
    render(
      <Image src="/images/justica-estatua.webp" alt="Estátua" width={320} height={320} className="size-40" />
    );

    const imagem = screen.getByRole("img", { name: "Estátua" });
    expect(imagem).toHaveAttribute("src", "/images/justica-estatua.webp");
    expect(imagem).toHaveAttribute("width", "320");
    expect(imagem).toHaveAttribute("loading", "lazy");
    expect(imagem).toHaveClass("size-40");
  });

  it("fill cobre o container posicionado, como no Next", () => {
    render(<Image src="/images/auth-background.webp" alt="Fundo" fill sizes="50vw" />);

    const imagem = screen.getByRole("img", { name: "Fundo" });
    expect(imagem).toHaveStyle({ position: "absolute", width: "100%", height: "100%" });
    expect(imagem).toHaveAttribute("sizes", "50vw");
  });

  it("priority carrega de imediato e com prioridade alta", () => {
    render(<Image src="/images/justica-estatua.webp" alt="Destaque" fill priority />);

    const imagem = screen.getByRole("img", { name: "Destaque" });
    expect(imagem).toHaveAttribute("loading", "eager");
    expect(imagem).toHaveAttribute("fetchpriority", "high");
  });
});
```

`apps/web/src/lib/test-utils-rotas.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { useParams } from "@/compat/next-navigation";
import { renderComRotas } from "./test-utils-rotas";

function DetalheCampanha() {
  const { id } = useParams<{ id: string }>();
  return <p>campanha {id}</p>;
}

describe("renderComRotas", () => {
  it("monta a árvore com router, rota inicial e params", () => {
    const { queryClient } = renderComRotas(<DetalheCampanha />, {
      rota: "/campanhas/7",
      padrao: "/campanhas/:id",
    });

    expect(screen.getByText("campanha 7")).toBeInTheDocument();
    expect(queryClient).toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run web:test`
Expected: FAIL. As 4 suítes novas falham com `Cannot find module './next-navigation'` (e equivalentes), e as suítes movidas que usam `@/compat/*` falham com `Cannot find module '@/compat/next-navigation'`.

- [ ] **Step 3: Implementar**

`apps/web/src/lib/query/query-client-raiz.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";
import { opcoesPadraoQuery } from "@/lib/query/opcoes-padrao";

// Client de fora do tenant: guarda a sessão (GET /api/auth/sessao) e serve as telas
// públicas (login, cadastro). Os dados do escritório vivem no client do QueryProvider,
// recriado a cada troca de tenant — a sessão não pode morar lá, porque é ela que diz
// qual é o tenant.
export const queryClientRaiz = new QueryClient({
  defaultOptions: { queries: opcoesPadraoQuery },
});
```

Em `apps/web/src/lib/query/chaves.ts`, acrescentar ao fim:

```ts
// Sessão do usuário logado (GET /api/auth/sessao). Vive no queryClientRaiz, fora do
// cache do tenant — ver lib/query/query-client-raiz.ts.
export const chaveSessao = () => ["sessao"] as const;
```

`apps/web/src/compat/next-navigation.ts`:

```ts
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLocation,
  useNavigate,
  useParams as useParamsDoRouter,
  useSearchParams as useSearchParamsDoRouter,
} from "react-router";
import { chaveSessao } from "@/lib/query/chaves";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";

// Mesma API de "next/navigation" que os componentes já usavam, implementada sobre o
// React Router — o código movido do Next roda sem reescrita (Fase 4 da migração).

export interface OpcoesNavegacao {
  /** `false` preserva a rolagem, como `{ scroll: false }` do App Router. */
  scroll?: boolean;
}

export interface RoteadorCompat {
  push(href: string, opcoes?: OpcoesNavegacao): void;
  replace(href: string, opcoes?: OpcoesNavegacao): void;
  back(): void;
  forward(): void;
  refresh(): void;
  prefetch(href: string): void;
}

export type ReadonlyURLSearchParams = Omit<URLSearchParams, "append" | "delete" | "set" | "sort">;

export function useRouter(): RoteadorCompat {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMemo<RoteadorCompat>(
    () => ({
      push: (href, opcoes) => {
        void navigate(href, { preventScrollReset: opcoes?.scroll === false });
      },
      replace: (href, opcoes) => {
        void navigate(href, { replace: true, preventScrollReset: opcoes?.scroll === false });
      },
      back: () => {
        void navigate(-1);
      },
      forward: () => {
        void navigate(1);
      },
      // No Next, refresh() relia os Server Components (dados + sessão). Aqui: invalida o
      // cache do tenant e a sessão — troca de escritório, papel alterado, perfil editado.
      refresh: () => {
        void queryClient.invalidateQueries();
        void queryClientRaiz.invalidateQueries({ queryKey: chaveSessao() });
      },
      // Sem prefetch de rota no SPA: o bundle das páginas já está carregado.
      prefetch: () => {},
    }),
    [navigate, queryClient]
  );
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParams(): ReadonlyURLSearchParams {
  const [params] = useSearchParamsDoRouter();
  return params;
}

export function useParams<
  T extends Record<string, string | undefined> = Record<string, string | undefined>,
>(): T {
  return useParamsDoRouter() as T;
}
```

`apps/web/src/compat/next-link.tsx`:

```tsx
import type { ComponentPropsWithRef } from "react";
import { Link as LinkDoRouter, useInRouterContext } from "react-router";

export interface LinkProps extends Omit<ComponentPropsWithRef<"a">, "href"> {
  href: string;
  replace?: boolean;
  /** `false` preserva a rolagem ao navegar, como no next/link. */
  scroll?: boolean;
  /** Aceito só por compatibilidade com next/link — o SPA não faz prefetch de rota. */
  prefetch?: boolean | null;
}

// Mesma API de "next/link" sobre o React Router. Fora de um <Router> (componente
// renderizado isolado num teste) vira um <a> comum, como o next/link se comportava.
// React 19: `ref` chega como prop comum e segue no spread (Base UI usa isso em
// DropdownMenuItem render={<Link … />}).
export function Link({ href, replace, scroll, prefetch: _prefetch, ...props }: LinkProps) {
  const dentroDoRouter = useInRouterContext();

  if (!dentroDoRouter) {
    return <a href={href} {...props} />;
  }

  return (
    <LinkDoRouter to={href} replace={replace} preventScrollReset={scroll === false} {...props} />
  );
}

export default Link;
```

`apps/web/src/compat/next-image.tsx`:

```tsx
import type { CSSProperties, ComponentPropsWithRef } from "react";

export interface ImageProps
  extends Omit<ComponentPropsWithRef<"img">, "src" | "alt" | "width" | "height" | "loading"> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  /** Cobre o container (que precisa ser position: relative/absolute), como no next/image. */
  fill?: boolean;
  /** Imagem acima da dobra: carrega de imediato e com prioridade alta. */
  priority?: boolean;
  sizes?: string;
  // Aceitos só por compatibilidade — sem otimizador de imagem fora do Next.
  quality?: number;
  unoptimized?: boolean;
  placeholder?: string;
}

const ESTILO_FILL: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

// O Vite não tem o otimizador do next/image: as artes do produto já são .webp em
// public/images, então um <img> com lazy loading e as mesmas props de layout basta.
export function Image({
  fill = false,
  priority = false,
  quality: _quality,
  unoptimized: _unoptimized,
  placeholder: _placeholder,
  style,
  ...props
}: ImageProps) {
  return (
    <img
      {...props}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      style={fill ? { ...ESTILO_FILL, ...style } : style}
    />
  );
}

export default Image;
```

`apps/web/src/lib/test-utils-rotas.tsx`:

```tsx
import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { criarQueryClientDeTeste } from "@/lib/test-utils";

export interface OpcoesRenderComRotas extends Omit<RenderOptions, "wrapper"> {
  /** URL inicial, ex.: "/campanhas/7?aba=mensagens". */
  rota?: string;
  /** Padrão do React Router que casa com `rota` — necessário para useParams. */
  padrao?: string;
}

// Para componentes/páginas que usam o compat de navegação de verdade (sem jest.mock):
// QueryClient isolado + MemoryRouter. Fica fora de test-utils.tsx de propósito: aquele
// arquivo ainda é importado pelos testes do Next (via ponte), que não têm o ambiente de
// teste do apps/web — e o React Router exige TextEncoder já no import.
export function renderComRotas(
  ui: ReactElement,
  { rota = "/", padrao = "*", ...opcoes }: OpcoesRenderComRotas = {}
) {
  const queryClient = criarQueryClientDeTeste();
  const resultado = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path={padrao} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
    opcoes
  );
  return { queryClient, ...resultado };
}
```

- [ ] **Step 4: Rodar a suíte inteira do web e o typecheck**

Run: `npm run web:test`
Expected: PASS. Passam as 65 suítes movidas (54 de components/hooks, `api-client`, 9 de utils e `sessao`) e as 6 do web (pagina-em-migracao, transformar-imports, next-navigation, next-link, next-image e test-utils-rotas). Nenhuma falha.

Se uma suíte movida falhar por depender de algo do `next/jest`, corrija no teste, não no compat. O spike rodou todas as suítes de front sob `@swc/jest` com este ambiente sem falha.

Run: `npm run web:typecheck`
Expected: sem erros.

Run: `npx jest && npx tsc --noEmit` (raiz)
Expected: tudo PASS. O `query-client-raiz.ts` agora existe para a ponte.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/compat apps/web/src/lib
git commit -m "feat(web): camada de compatibilidade com next/navigation, next/link e next/image"
```

---

### Task 4.5: Sessão no front (`lib/sessao.ts`)

`apps/web/src/lib/sessao.ts` chega da Task 4.3 com o conteúdo da Task 3.7 (`entrar` e `sair`). Esta task acrescenta leitura da sessão, troca de escritório e limpeza do cache, e **mantém** o contrato da Fase 3 para que login, cadastro e `NavUsuario` não mudem:
- `entrar()` devolve `boolean`;
- `sair()` nunca lança e não navega.

**Files:**
- Modify: `apps/web/src/lib/sessao.ts`, `apps/web/src/lib/sessao.test.ts`

**Interfaces:**
- Consumes:
  - `GET /api/auth/sessao`: 200 `{ usuario: { id, nome, email }, escritorioId: string | null, role: RoleMembro | null }` ou 401;
  - `POST /api/auth/login`;
  - `POST /api/auth/logout`;
  - `POST /api/sessao/escritorio-ativo { escritorioId }`;
  - todos da Fase 3, mais `queryClientRaiz` e `chaveSessao` da Task 4.4.
- Produces:
  ```ts
  // apps/web/src/lib/sessao.ts
  export interface UsuarioDaSessao { id: string; nome: string; email: string }
  export interface Sessao { usuario: UsuarioDaSessao; escritorioId: string | null; role: RoleMembro | null }
  export async function buscarSessao(): Promise<Sessao | null>;      // 401 → null; outros erros → ApiError
  export function useSessao(): UseQueryResult<Sessao | null, Error>;  // sempre no queryClientRaiz
  export async function entrar(email: string, senha: string): Promise<boolean>; // inalterado (Fase 3)
  export async function sair(): Promise<void>;                        // logout + queryClientRaiz.clear(); nunca lança; não navega
  export async function trocarEscritorio(escritorioId: string): Promise<void>; // POST + invalida a sessão; erro → ApiError
  ```

- [ ] **Step 1: Escrever os testes que falham**

Substituir `apps/web/src/lib/sessao.test.ts` por:

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api-client";
import { chaveSessao } from "@/lib/query/chaves";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";
import { buscarSessao, entrar, sair, trocarEscritorio, useSessao, type Sessao } from "./sessao";

const SESSAO: Sessao = {
  usuario: { id: "user-1", nome: "Fulana", email: "fulana@teste.com" },
  escritorioId: "esc-1",
  role: "owner",
};

function resposta(status: number, corpo: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    redirected: false,
    headers: { get: () => "application/json" },
    json: async () => corpo,
  } as unknown as Response;
}

beforeEach(() => {
  global.fetch = jest.fn();
  queryClientRaiz.clear();
});

describe("buscarSessao", () => {
  it("devolve a sessão do GET /api/auth/sessao", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200, SESSAO));

    await expect(buscarSessao()).resolves.toEqual(SESSAO);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("/api/auth/sessao");
  });

  // 401 aqui é resposta esperada ("ninguém logado"), não sessão expirada: nada de
  // redirect — quem decide para onde ir é a RotaProtegida.
  it("devolve null quando não há sessão (401)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(401, { error: "Sessão inválida ou expirada." }));

    await expect(buscarSessao()).resolves.toBeNull();
  });

  it("lança ApiError em erro de servidor", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(500));

    await expect(buscarSessao()).rejects.toEqual(expect.objectContaining({ status: 500 }));
    await expect(buscarSessao()).rejects.toBeInstanceOf(ApiError);
  });

  it("lança ApiError com status 0 quando a rede falha", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    await expect(buscarSessao()).rejects.toEqual(expect.objectContaining({ status: 0 }));
  });
});

describe("useSessao", () => {
  it("guarda a sessão no queryClientRaiz, fora do cache do tenant", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200, SESSAO));

    const { result } = renderHook(() => useSessao());

    await waitFor(() => expect(result.current.data).toEqual(SESSAO));
    expect(queryClientRaiz.getQueryData(chaveSessao())).toEqual(SESSAO);
  });
});

describe("entrar (contrato da Fase 3)", () => {
  it("envia as credenciais para /api/auth/login e devolve true no 200", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200));

    await expect(entrar("f@t.com", "senha")).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "f@t.com", senha: "senha" }),
    });
  });

  it.each([401, 400])("devolve false para %i (credenciais inválidas)", async (status) => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(status));

    await expect(entrar("f@t.com", "errada")).resolves.toBe(false);
  });

  it("lança para erro de servidor", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(500));

    await expect(entrar("f@t.com", "senha")).rejects.toThrow("HTTP 500");
  });
});

describe("sair", () => {
  it("chama /api/auth/logout e descarta a sessão em cache", async () => {
    queryClientRaiz.setQueryData(chaveSessao(), SESSAO);
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200));

    await sair();

    expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(queryClientRaiz.getQueryData(chaveSessao())).toBeUndefined();
  });

  it("não lança quando a rede falha (a navegação para /login segue)", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    await expect(sair()).resolves.toBeUndefined();
  });
});

describe("trocarEscritorio", () => {
  it("troca o escritório ativo na API e invalida a sessão", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200, { ok: true }));
    const invalidar = jest.spyOn(queryClientRaiz, "invalidateQueries");

    await trocarEscritorio("esc-2");

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/sessao/escritorio-ativo");
    expect(init).toEqual(
      expect.objectContaining({ method: "POST", body: JSON.stringify({ escritorioId: "esc-2" }) })
    );
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["sessao"] });
    invalidar.mockRestore();
  });

  it("propaga a mensagem da API quando a troca é recusada", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      resposta(403, { error: "Você não é membro deste escritório." })
    );

    await expect(trocarEscritorio("esc-x")).rejects.toThrow("Você não é membro deste escritório.");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run web:test -- lib/sessao`
Expected: FAIL. Os imports `buscarSessao`, `useSessao`, `trocarEscritorio` e `Sessao` não existem, e o teste de `sair` falha porque o cache não é limpo.

- [ ] **Step 3: Implementar**

Substituir `apps/web/src/lib/sessao.ts` por:

```ts
import { useQuery } from "@tanstack/react-query";
import type { RoleMembro } from "@prisma/client";
import { ApiError, apiFetch } from "@/lib/api-client";
import { chaveSessao } from "@/lib/query/chaves";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";

// Sessão no browser, falando com os endpoints de sessão da API Nest (Fase 3). O cookie
// crm_sessao é httpOnly: o browser só o recebe/limpa via Set-Cookie, nunca o lê — o que
// o front sabe da sessão vem sempre de GET /api/auth/sessao.

export interface UsuarioDaSessao {
  id: string;
  nome: string;
  email: string;
}

export interface Sessao {
  usuario: UsuarioDaSessao;
  /** null = logado sem escritório ativo (vai para /onboarding). */
  escritorioId: string | null;
  /** Sempre do banco (RN19); null quando não há escritório ativo. */
  role: RoleMembro | null;
}

// fetch cru, não apiFetch: aqui 401 é a resposta esperada para "ninguém logado" e vira
// null. O apiFetch trataria 401 como sessão expirada e faria um redirect duro para
// /login — inclusive a partir de /cadastro, onde por definição não há sessão.
export async function buscarSessao(): Promise<Sessao | null> {
  let resposta: Response;
  try {
    resposta = await fetch("/api/auth/sessao", { headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor.", 0);
  }

  if (resposta.status === 401) return null;
  if (!resposta.ok) {
    throw new ApiError("Não foi possível carregar a sessão.", resposta.status);
  }
  return (await resposta.json()) as Sessao;
}

// Sempre no queryClientRaiz (e não no client do contexto): a RotaProtegida lê a sessão
// para decidir qual client de tenant montar, então a sessão não pode morar dentro dele.
export function useSessao() {
  return useQuery(
    { queryKey: chaveSessao(), queryFn: buscarSessao, staleTime: Infinity, retry: false },
    queryClientRaiz
  );
}

export async function entrar(email: string, senha: string): Promise<boolean> {
  const resposta = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  if (resposta.ok) return true;
  // 401 = credencial errada/usuário inativo; 400 = campo vazio. Para a tela, os dois são
  // "e-mail ou senha inválidos" — nunca revelar qual dos dois errou.
  if (resposta.status === 401 || resposta.status === 400) return false;
  throw new Error(`Falha ao entrar (HTTP ${resposta.status}).`);
}

export async function sair(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Sem rede o cookie continua no browser, mas a navegação para /login segue — o
    // usuário pode tentar de novo de lá.
  }
  // Nada do usuário que saiu sobrevive no cache. Quem chama faz a navegação dura.
  queryClientRaiz.clear();
}

// A API valida a membership e regrava o cookie; invalidar a sessão faz a RotaProtegida
// receber o novo escritorioId, e o QueryProvider troca o cache do tenant inteiro.
export async function trocarEscritorio(escritorioId: string): Promise<void> {
  await apiFetch<unknown>("/api/sessao/escritorio-ativo", {
    method: "POST",
    body: JSON.stringify({ escritorioId }),
  });
  await queryClientRaiz.invalidateQueries({ queryKey: chaveSessao() });
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run web:test && npm run web:typecheck`
Expected: tudo PASS, e o typecheck sem erros. A suíte de `nav-usuario`, que mocka `@/lib/sessao` desde o codemod, continua verde.

Run: `npx jest && npx tsc --noEmit` (raiz)
Expected: tudo PASS. As páginas de login e cadastro do Next usam `entrar`, cujo contrato não mudou, e o `NavUsuario` no Next passa a limpar o `queryClientRaiz` no `sair()`, o que é inofensivo.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/sessao.ts apps/web/src/lib/sessao.test.ts
git commit -m "feat(web): sessão no front via /api/auth/sessao"
```

---

### Task 4.6: Título por página, fontes e favicon

**Files:**
- Create: `apps/web/src/hooks/use-titulo-pagina.ts`, `apps/web/src/fontes.css`, `public/favicon.svg`
- Modify: `apps/web/index.html`, `apps/web/src/main.tsx`
- Test: `apps/web/src/hooks/use-titulo-pagina.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // apps/web/src/hooks/use-titulo-pagina.ts
  export function montarTitulo(titulo?: string): string;   // "Clientes | CRM Advocacia" ou "CRM Advocacia"
  export function useTituloPagina(titulo?: string): void;   // aplica no mount/troca, restaura no unmount
  ```
  `public/favicon.svg` é servido em `/favicon.svg` tanto pelo Vite (`publicDir`) quanto pelo Next.

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/src/hooks/use-titulo-pagina.test.ts`:

```ts
import { renderHook } from "@testing-library/react";
import { montarTitulo, useTituloPagina } from "./use-titulo-pagina";

describe("useTituloPagina", () => {
  beforeEach(() => {
    document.title = "CRM Advocacia";
  });

  it("aplica o mesmo template do metadata do Next: '<título> | CRM Advocacia'", () => {
    renderHook(() => useTituloPagina("Clientes"));

    expect(document.title).toBe("Clientes | CRM Advocacia");
  });

  it("sem título usa só o nome do produto", () => {
    expect(montarTitulo()).toBe("CRM Advocacia");
  });

  it("acompanha a troca de título", () => {
    const { rerender } = renderHook(({ titulo }) => useTituloPagina(titulo), {
      initialProps: { titulo: "Campanhas" },
    });

    rerender({ titulo: "Nova campanha" });

    expect(document.title).toBe("Nova campanha | CRM Advocacia");
  });

  it("restaura o título anterior ao desmontar", () => {
    document.title = "Antes";
    const { unmount } = renderHook(() => useTituloPagina("Agenda"));

    unmount();

    expect(document.title).toBe("Antes");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run web:test -- use-titulo-pagina`
Expected: FAIL com `Cannot find module './use-titulo-pagina'`.

- [ ] **Step 3: Implementar**

`apps/web/src/hooks/use-titulo-pagina.ts`:

```ts
import { useEffect } from "react";
import { siteConfig } from "@/lib/site-config";

export function montarTitulo(titulo?: string): string {
  return titulo ? `${titulo} | ${siteConfig.name}` : siteConfig.name;
}

// Substitui o `metadata.title` do Next (template "%s | CRM Advocacia" do layout raiz).
// Cada página chama no topo: useTituloPagina("Clientes").
export function useTituloPagina(titulo?: string): void {
  useEffect(() => {
    const anterior = document.title;
    document.title = montarTitulo(titulo);
    return () => {
      document.title = anterior;
    };
  }, [titulo]);
}
```

`apps/web/src/fontes.css`:

```css
/* Equivalente ao next/font do layout raiz do Next: Inter (texto) e Geist Mono (código),
   servidas pelo próprio bundle via @fontsource-variable — sem request ao Google.
   Fora de @layer de propósito: o globals.css declara --font-sans dentro de @theme (camada
   "theme" do Tailwind), e CSS sem camada vence qualquer camada — exatamente como a classe
   que o next/font punha no <html>. */
:root {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-geist-mono: "Geist Mono Variable", ui-monospace, SFMono-Regular, monospace;
}
```

`public/favicon.svg` tem o mesmo desenho de `src/app/icon.tsx`: balança `Scale` do lucide em `#fafafa` sobre `#b3812f`, com cantos de 7px. É um asset estático; a regra de tokens vale para componentes.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#b3812f" />
  <svg x="6" y="6" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fafafa"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3v18" />
    <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
    <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
    <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
    <path d="M7 21h10" />
  </svg>
</svg>
```

Em `apps/web/index.html`, logo depois da `<meta name="description" …/>`:

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

`apps/web/src/main.tsx` passa a carregar fontes e tema. A Task 4.8 troca o conteúdo renderizado:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import "./fontes.css";
import { PaginaEmMigracao } from "@/paginas/pagina-em-migracao";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <PaginaEmMigracao caminhoNext="src/app/layout.tsx" />
  </StrictMode>
);
```

- [ ] **Step 4: Rodar testes e build**

Run: `npm run web:test -- use-titulo-pagina`
Expected: PASS.

Run: `npm run web:build && ls apps/web/dist/favicon.svg apps/web/dist/images`
Expected: o build passa. `dist/` tem `favicon.svg` e `images/` (copiados do `public/` da raiz), e o CSS gerado em `dist/assets/*.css` contém `Inter Variable`.

Run: `npm run web:dev` e abra `http://localhost:5173`.
Expected: "Página em migração" com a tipografia Inter, o favicon dourado na aba e o título `CRM Advocacia`. Encerre o dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-titulo-pagina.ts apps/web/src/hooks/use-titulo-pagina.test.ts apps/web/src/fontes.css apps/web/src/main.tsx apps/web/index.html public/favicon.svg
git commit -m "feat(web): título por página, fontes e favicon fora do Next"
```

---

### Task 4.7: `RotaProtegida` e layouts

**Files:**
- Create: `apps/web/src/paginas/rota-protegida.tsx`, `apps/web/src/paginas/layout-raiz.tsx`, `apps/web/src/paginas/pagina-nao-encontrada.tsx`, `apps/web/src/paginas/auth/layout-auth.tsx`, `apps/web/src/paginas/dashboard/layout-dashboard.tsx`, `apps/web/src/paginas/dashboard/configuracoes/layout-configuracoes.tsx`
- Modify: `apps/web/jest.setup.ts`
- Test: `apps/web/src/paginas/rota-protegida.test.tsx` (os layouts são exercitados pelo teste de rotas da Task 4.8)

**Interfaces:**
- Consumes: `useSessao()` (Task 4.5), `QueryProvider` (`@/components/providers/query-provider`, movido), `AuthBrandingPanel`, `ConfiguracoesNav`, `Link` do compat.
- Produces:
  ```tsx
  export interface RotaProtegidaProps { exigirEscritorio?: boolean } // padrão true
  export function RotaProtegida(props: RotaProtegidaProps): JSX.Element;
  // carregando → <div role="status">; erro → <div role="alert"> + "Tentar novamente" (refetch);
  // sem sessão → <Navigate replace to={`/login?callbackUrl=${encodeURIComponent(pathname + search)}`} />;
  // exigirEscritorio && !escritorioId → <Navigate replace to="/onboarding" />;
  // senão → <QueryProvider escritorioId={sessao.escritorioId ?? undefined}><Outlet /></QueryProvider>
  export function LayoutRaiz(): JSX.Element;            // <Outlet /> + <ScrollRestoration />
  export function LayoutAuth(): JSX.Element;            // porte de src/app/(auth)/layout.tsx
  export function LayoutDashboard(): JSX.Element;       // PROVISÓRIO: <main><Outlet /></main> — a parte B porta o shell
  export function LayoutConfiguracoes(): JSX.Element;   // porte de src/app/(dashboard)/configuracoes/layout.tsx
  export function PaginaNaoEncontrada(): JSX.Element;
  ```

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/src/paginas/rota-protegida.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { useSessao } from "@/lib/sessao";
import { RotaProtegida, type RotaProtegidaProps } from "./rota-protegida";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));

const mockedUseSessao = useSessao as jest.Mock;

const SESSAO_COM_ESCRITORIO = {
  usuario: { id: "user-1", nome: "Fulana", email: "fulana@teste.com" },
  escritorioId: "esc-1",
  role: "owner",
};

function sessaoComo(parcial: Record<string, unknown>) {
  mockedUseSessao.mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    ...parcial,
  });
}

function LocalAtual() {
  const { pathname, search } = useLocation();
  return <p data-testid="local">{pathname + search}</p>;
}

function montar(rota: string, props?: RotaProtegidaProps) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route element={<RotaProtegida {...props} />}>
          <Route path="/clientes" element={<p>conteúdo protegido</p>} />
        </Route>
        <Route path="/login" element={<LocalAtual />} />
        <Route path="/onboarding" element={<LocalAtual />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RotaProtegida", () => {
  it("mostra carregando enquanto a sessão não chegou", () => {
    sessaoComo({ isPending: true });

    montar("/clientes");

    expect(screen.getByRole("status")).toHaveTextContent(/carregando/i);
    expect(screen.queryByText("conteúdo protegido")).not.toBeInTheDocument();
  });

  // RN01: mesma regra do proxy.ts do Next — guarda o destino (path + query) no callbackUrl.
  it("sem sessão manda para /login guardando a rota atual", () => {
    sessaoComo({ data: null });

    montar("/clientes?pagina=2");

    expect(screen.getByTestId("local")).toHaveTextContent(
      "/login?callbackUrl=%2Fclientes%3Fpagina%3D2"
    );
  });

  it("sessão sem escritório ativo vai para /onboarding", () => {
    sessaoComo({ data: { ...SESSAO_COM_ESCRITORIO, escritorioId: null, role: null } });

    montar("/clientes");

    expect(screen.getByTestId("local")).toHaveTextContent("/onboarding");
  });

  it("com exigirEscritorio={false} (onboarding) aceita sessão sem escritório", () => {
    sessaoComo({ data: { ...SESSAO_COM_ESCRITORIO, escritorioId: null, role: null } });

    montar("/clientes", { exigirEscritorio: false });

    expect(screen.getByText("conteúdo protegido")).toBeInTheDocument();
  });

  it("renderiza a rota filha com sessão e escritório ativo", () => {
    sessaoComo({ data: SESSAO_COM_ESCRITORIO });

    montar("/clientes");

    expect(screen.getByText("conteúdo protegido")).toBeInTheDocument();
  });

  it("falha ao verificar a sessão mostra alerta e permite tentar de novo", async () => {
    const refetch = jest.fn();
    sessaoComo({ isError: true, refetch });
    const user = userEvent.setup();

    montar("/clientes");

    expect(screen.getByRole("alert")).toHaveTextContent(/não foi possível verificar sua sessão/i);
    await user.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run web:test -- rota-protegida`
Expected: FAIL com `Cannot find module './rota-protegida'`.

- [ ] **Step 3: Implementar**

`apps/web/src/paginas/rota-protegida.tsx`:

```tsx
import { Navigate, Outlet, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { QueryProvider } from "@/components/providers/query-provider";
import { useSessao } from "@/lib/sessao";

export interface RotaProtegidaProps {
  /** false só no onboarding: basta estar logado, ainda sem escritório. */
  exigirEscritorio?: boolean;
}

// Substitui o proxy.ts do Next (RN01) e os redirects do (dashboard)/layout.tsx: sem sessão
// → /login com o destino guardado; sem escritório ativo → /onboarding. O cache de dados
// nasce aqui, preso ao escritório da sessão (QueryProvider troca o client inteiro quando
// o tenant muda — RN19 no front).
export function RotaProtegida({ exigirEscritorio = true }: RotaProtegidaProps) {
  const { data: sessao, isPending, isError, refetch } = useSessao();
  const { pathname, search } = useLocation();

  if (isPending) {
    return (
      <div
        role="status"
        className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground"
      >
        Carregando…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
      >
        <p className="text-sm text-muted-foreground">Não foi possível verificar sua sessão.</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!sessao) {
    return <Navigate replace to={`/login?callbackUrl=${encodeURIComponent(pathname + search)}`} />;
  }

  if (exigirEscritorio && !sessao.escritorioId) {
    return <Navigate replace to="/onboarding" />;
  }

  return (
    <QueryProvider escritorioId={sessao.escritorioId ?? undefined}>
      <Outlet />
    </QueryProvider>
  );
}
```

`apps/web/src/paginas/layout-raiz.tsx`:

```tsx
import { Outlet, ScrollRestoration } from "react-router";

// Equivalente ao src/app/layout.tsx: <html>/<body>, fontes e metadata padrão vivem em
// index.html + main.tsx; aqui fica só o que depende do router. ScrollRestoration
// reproduz o "volta ao topo a cada navegação" do App Router (e respeita scroll: false).
export function LayoutRaiz() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
```

`apps/web/src/paginas/pagina-nao-encontrada.tsx`:

```tsx
import Link from "@/compat/next-link";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaNaoEncontrada() {
  useTituloPagina("Página não encontrada");

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground">O endereço acessado não existe no CRM.</p>
      <Link
        href="/"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Voltar ao início
      </Link>
    </section>
  );
}
```

`apps/web/src/paginas/auth/layout-auth.tsx` é o porte literal de `src/app/(auth)/layout.tsx`, com `{children}` virando `<Outlet />`:

```tsx
import { Outlet } from "react-router";
import { Scale } from "lucide-react";
import Link from "@/compat/next-link";
import { AuthBrandingPanel } from "@/components/auth/auth-branding-panel";

export function LayoutAuth() {
  return (
    <div className="grid min-h-screen gap-4 bg-background p-4 lg:grid-cols-2 lg:p-6">
      <div className="flex flex-col justify-center rounded-[2rem] bg-linear-to-br from-gold-soft from-35% via-gold-soft via-55% to-gold px-6 py-10 sm:px-12 sm:py-12">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8">
          <Link
            href="/"
            className="mx-auto flex items-center gap-2.5 font-heading text-lg font-semibold"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="size-5" />
            </span>
            CRM Advocacia
          </Link>

          <Outlet />
        </div>
      </div>

      <AuthBrandingPanel />
    </div>
  );
}
```

`apps/web/src/paginas/dashboard/layout-dashboard.tsx` é **provisório**:

```tsx
import { Outlet } from "react-router";

// PROVISÓRIO (Fase 4, parte A). A parte B porta aqui o shell de
// src/app/(dashboard)/layout.tsx: header com marca, EscritorioSwitcher (lista de
// escritórios do usuário) e HeaderData; SidebarProvider + AppSidebar com NavUsuario
// (nome/e-mail de useSessao()). Sessão, redirect e QueryProvider já vêm da
// RotaProtegida; o Toaster é global (app.tsx) — não renderizar outro aqui.
export function LayoutDashboard() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <Outlet />
    </main>
  );
}
```

`apps/web/src/paginas/dashboard/configuracoes/layout-configuracoes.tsx` é o porte literal de `src/app/(dashboard)/configuracoes/layout.tsx`:

```tsx
import { Outlet } from "react-router";
import { ConfiguracoesNav } from "@/components/configuracoes/configuracoes-nav";

export function LayoutConfiguracoes() {
  return (
    <div className="grid flex-1 gap-8 md:grid-cols-[220px_1fr]">
      <div className="md:border-r md:border-border md:pr-6">
        <ConfiguracoesNav />
      </div>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
```

Em `apps/web/jest.setup.ts`, acrescentar ao fim:

```ts
// jsdom não implementa window.scrollTo (só loga "Not implemented"); o <ScrollRestoration>
// do React Router chama a cada navegação dos testes de rota.
if (typeof window !== "undefined") {
  window.scrollTo = () => {};
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run web:test -- rota-protegida`
Expected: PASS (6 testes).

Run: `npm run web:typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/paginas apps/web/jest.setup.ts
git commit -m "feat(web): rota protegida e layouts das áreas do app"
```

---

### Task 4.8: Árvore de rotas, providers e entrada da aplicação

**Files:**
- Create: `apps/web/src/rotas.tsx`, `apps/web/src/app.tsx`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/src/rotas.test.tsx`, `apps/web/src/app.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  // apps/web/src/rotas.tsx — árvore completa (ver "Mapa de rotas" no início da Fase 4)
  export const rotas: RouteObject[];
  // apps/web/src/app.tsx
  export function Provedores(props: { children: ReactNode }): JSX.Element; // ThemeProvider(light) > QueryClientProvider(queryClientRaiz) > children + <Toaster />
  export function App(): JSX.Element;                                     // Provedores + RouterProvider(createBrowserRouter(rotas))
  ```
- Contrato para a parte B: para portar uma página, crie o arquivo da coluna "Elemento / arquivo" do mapa e troque, em `rotas.tsx`, o `emMigracao("…")` daquela rota pelo componente. Depois remova a linha correspondente de `ROTAS_EM_MIGRACAO` em `rotas.test.tsx` e, se quiser manter a cobertura da rota, troque-a por uma asserção da página real. Rotas pesadas (ex.: agenda e campanhas, com `recharts`/`papaparse`) podem virar `lazy: () => import(...)` no mesmo objeto de rota.

- [ ] **Step 1: Escrever os testes que falham**

`apps/web/src/rotas.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { useSessao } from "@/lib/sessao";
import { rotas } from "./rotas";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));

const mockedUseSessao = useSessao as jest.Mock;

function navegarPara(rota: string) {
  render(<RouterProvider router={createMemoryRouter(rotas, { initialEntries: [rota] })} />);
}

// Rota React Router → página do Next que ela ainda espera. A parte B remove cada linha
// ao portar a página correspondente.
const ROTAS_EM_MIGRACAO: [string, string][] = [
  ["/login", "src/app/(auth)/login/page.tsx"],
  ["/cadastro", "src/app/(auth)/cadastro/page.tsx"],
  ["/onboarding", "src/app/(onboarding)/onboarding/page.tsx"],
  ["/", "src/app/(dashboard)/page.tsx"],
  ["/clientes", "src/app/(dashboard)/clientes/page.tsx"],
  ["/casos", "src/app/(dashboard)/casos/page.tsx"],
  ["/agenda", "src/app/(dashboard)/agenda/page.tsx"],
  ["/campanhas", "src/app/(dashboard)/campanhas/page.tsx"],
  ["/campanhas/nova", "src/app/(dashboard)/campanhas/nova/page.tsx"],
  ["/campanhas/abc123", "src/app/(dashboard)/campanhas/[id]/page.tsx"],
  ["/instancias", "src/app/(dashboard)/instancias/page.tsx"],
  ["/perfil", "src/app/(dashboard)/perfil/page.tsx"],
  ["/configuracoes/escritorio", "src/app/(dashboard)/configuracoes/escritorio/page.tsx"],
  ["/configuracoes/membros", "src/app/(dashboard)/configuracoes/membros/page.tsx"],
  ["/configuracoes/status", "src/app/(dashboard)/configuracoes/status/page.tsx"],
  ["/configuracoes/tipos-processo", "src/app/(dashboard)/configuracoes/tipos-processo/page.tsx"],
];

describe("árvore de rotas", () => {
  beforeEach(() => {
    mockedUseSessao.mockReturnValue({
      data: {
        usuario: { id: "user-1", nome: "Fulana", email: "fulana@teste.com" },
        escritorioId: "esc-1",
        role: "owner",
      },
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    });
  });

  it.each(ROTAS_EM_MIGRACAO)("%s aponta para %s", async (rota, caminhoNext) => {
    navegarPara(rota);

    expect(await screen.findByText(caminhoNext)).toBeInTheDocument();
  });

  it("/configuracoes redireciona para /configuracoes/escritorio", async () => {
    navegarPara("/configuracoes");

    expect(
      await screen.findByText("src/app/(dashboard)/configuracoes/escritorio/page.tsx")
    ).toBeInTheDocument();
  });

  it("as rotas de configurações ficam dentro da nav lateral própria", async () => {
    navegarPara("/configuracoes/membros");

    expect(await screen.findByRole("link", { name: "Membros" })).toHaveAttribute("data-active");
  });

  it("login e cadastro ficam dentro do layout de autenticação", async () => {
    navegarPara("/login");

    expect(await screen.findByRole("link", { name: /crm advocacia/i })).toHaveAttribute("href", "/");
  });

  it("as rotas do dashboard exigem sessão", async () => {
    mockedUseSessao.mockReturnValue({ data: null, isPending: false, isError: false, refetch: jest.fn() });

    navegarPara("/clientes");

    expect(await screen.findByText("src/app/(auth)/login/page.tsx")).toBeInTheDocument();
  });

  it("rota inexistente mostra a página não encontrada", async () => {
    navegarPara("/rota-que-nao-existe");

    expect(await screen.findByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
  });
});
```

`apps/web/src/app.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";
import { useSessao } from "@/lib/sessao";
import { App, Provedores } from "./app";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));

describe("Provedores", () => {
  it("expõe o queryClientRaiz para a árvore", () => {
    function Sonda() {
      return <p>{useQueryClient() === queryClientRaiz ? "client raiz" : "outro client"}</p>;
    }

    render(
      <Provedores>
        <Sonda />
      </Provedores>
    );

    expect(screen.getByText("client raiz")).toBeInTheDocument();
  });
});

describe("App", () => {
  it("monta o router do browser com a árvore de rotas", async () => {
    (useSessao as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    });
    window.history.pushState({}, "", "/rota-que-nao-existe");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run web:test -- rotas app.test`
Expected: FAIL com `Cannot find module './rotas'` e `Cannot find module './app'`.

- [ ] **Step 3: Implementar**

`apps/web/src/rotas.tsx`:

```tsx
import { Navigate, type RouteObject } from "react-router";
import { LayoutRaiz } from "@/paginas/layout-raiz";
import { RotaProtegida } from "@/paginas/rota-protegida";
import { PaginaEmMigracao } from "@/paginas/pagina-em-migracao";
import { PaginaNaoEncontrada } from "@/paginas/pagina-nao-encontrada";
import { LayoutAuth } from "@/paginas/auth/layout-auth";
import { LayoutDashboard } from "@/paginas/dashboard/layout-dashboard";
import { LayoutConfiguracoes } from "@/paginas/dashboard/configuracoes/layout-configuracoes";

// Placeholder da parte A: a parte B troca cada chamada pela página portada.
const emMigracao = (caminhoNext: string) => <PaginaEmMigracao caminhoNext={caminhoNext} />;

// Espelha src/app do Next: route groups viram rotas de layout sem `path`; [id] vira :id.
// Mapa completo Next → rota → arquivo no plano da Fase 4.
export const rotas: RouteObject[] = [
  {
    element: <LayoutRaiz />,
    children: [
      // (auth) — públicas
      {
        element: <LayoutAuth />,
        children: [
          { path: "login", element: emMigracao("src/app/(auth)/login/page.tsx") },
          { path: "cadastro", element: emMigracao("src/app/(auth)/cadastro/page.tsx") },
        ],
      },
      // (onboarding) — exige sessão, ainda sem escritório
      {
        element: <RotaProtegida exigirEscritorio={false} />,
        children: [
          { path: "onboarding", element: emMigracao("src/app/(onboarding)/onboarding/page.tsx") },
        ],
      },
      // (dashboard) — sessão + escritório ativo
      {
        element: <RotaProtegida />,
        children: [
          {
            element: <LayoutDashboard />,
            children: [
              { index: true, element: emMigracao("src/app/(dashboard)/page.tsx") },
              { path: "clientes", element: emMigracao("src/app/(dashboard)/clientes/page.tsx") },
              { path: "casos", element: emMigracao("src/app/(dashboard)/casos/page.tsx") },
              { path: "agenda", element: emMigracao("src/app/(dashboard)/agenda/page.tsx") },
              {
                path: "campanhas",
                children: [
                  { index: true, element: emMigracao("src/app/(dashboard)/campanhas/page.tsx") },
                  { path: "nova", element: emMigracao("src/app/(dashboard)/campanhas/nova/page.tsx") },
                  { path: ":id", element: emMigracao("src/app/(dashboard)/campanhas/[id]/page.tsx") },
                ],
              },
              { path: "instancias", element: emMigracao("src/app/(dashboard)/instancias/page.tsx") },
              { path: "perfil", element: emMigracao("src/app/(dashboard)/perfil/page.tsx") },
              {
                path: "configuracoes",
                element: <LayoutConfiguracoes />,
                children: [
                  { index: true, element: <Navigate replace to="/configuracoes/escritorio" /> },
                  {
                    path: "escritorio",
                    element: emMigracao("src/app/(dashboard)/configuracoes/escritorio/page.tsx"),
                  },
                  {
                    path: "membros",
                    element: emMigracao("src/app/(dashboard)/configuracoes/membros/page.tsx"),
                  },
                  {
                    path: "status",
                    element: emMigracao("src/app/(dashboard)/configuracoes/status/page.tsx"),
                  },
                  {
                    path: "tipos-processo",
                    element: emMigracao("src/app/(dashboard)/configuracoes/tipos-processo/page.tsx"),
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <PaginaNaoEncontrada /> },
    ],
  },
];
```

`apps/web/src/app.tsx`:

```tsx
import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Toaster } from "@/components/ui/sonner";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";
import { rotas } from "@/rotas";

// Providers globais. O tema é fixo em light: o app Next nunca teve ThemeProvider, então
// a página sempre foi clara (next-themes só cuida da classe .dark — não depende do Next).
// O cache dos dados do escritório não mora aqui: a RotaProtegida monta um QueryProvider
// por tenant; este client guarda só a sessão e as telas públicas. Toaster é global.
export function Provedores({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClientRaiz}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export function App() {
  // Router criado uma vez por montagem (e não no escopo do módulo) para os testes
  // conseguirem montar o App mais de uma vez com URLs diferentes.
  const [roteador] = useState(() => createBrowserRouter(rotas));

  return (
    <Provedores>
      <RouterProvider router={roteador} />
    </Provedores>
  );
}
```

`apps/web/src/main.tsx` (versão final):

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import "./fontes.css";
import { App } from "@/app";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 4: Rodar tudo**

Run: `npm run web:test`
Expected: tudo PASS, incluindo `rotas.test.tsx` (16 rotas em migração + 5 casos) e `app.test.tsx`.

Run: `npm run web:build`
Expected: o build passa.

Smoke test manual: terminal 1 com `npm run api:dev`, terminal 2 com `npm run web:dev`, e abra `http://localhost:5173/clientes` numa aba anônima.
Expected:
- vai para `/login?callbackUrl=%2Fclientes`, com o layout de autenticação (painel dourado + arte) e "Página em migração · src/app/(auth)/login/page.tsx";
- na aba Network, `GET /api/auth/sessao` chega à API pelo proxy e responde 401 JSON;
- `http://localhost:5173/rota-x` mostra "Página não encontrada", com o título da aba `Página não encontrada | CRM Advocacia`.

Logado pelo Next em `:3000`, o cookie **não** vale em `:5173`, porque são origens diferentes. O login no front novo chega com a página portada pela parte B.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/rotas.tsx apps/web/src/rotas.test.tsx apps/web/src/app.tsx apps/web/src/app.test.tsx apps/web/src/main.tsx
git commit -m "feat(web): árvore de rotas completa e providers da aplicação"
```

---

### Task 4.9: Guarda de fronteira do web

**Files:**
- Test: `apps/web/src/fronteira.test.ts`

**Interfaces:**
- Consumes: `extrairEspecificadores` (Task 4.2).
- Produces: regra verificada em todo `npm run web:test`.
  - Nenhum arquivo de `apps/web/src` importa `next`, `next/*` ou `next-auth`.
  - `@dominio/*` só aparece com `types/`, `lib/utils/` ou `lib/auth/permissoes`.
  - Nada de domínio é importado por `@/`: `@/types/`, `@/services/`, `@/repositories/`, `@/lib/{auth,api,external,documentos}/` e `@/lib/prisma` são proibidos.
  - `@prisma/client` só entra como `import type`.
  - A parte B herda a guarda ao mover as páginas.

- [ ] **Step 1: Escrever o teste**

`apps/web/src/fronteira.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { extrairEspecificadores } from "../scripts/transformar-imports";

// Regra de fronteira (docs/app/estrutura-codigo.md) aplicada ao front Vite: o web não
// conhece o Next nem a camada de dados. Do domínio, só alcança código puro — tipos,
// utils e a hierarquia de papéis — via @dominio/ até a Fase 5.

const RAIZ_WEB = join(__dirname, "..");

function arquivosDoWeb(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivosDoWeb(caminho);
    return /\.(ts|tsx)$/.test(entrada.name) ? [caminho] : [];
  });
}

const DOMINIO_PERMITIDO = [
  /^@dominio\/types\//,
  /^@dominio\/lib\/utils\//,
  /^@dominio\/lib\/auth\/permissoes$/,
];

function motivoDaViolacao(especificador: string): string | null {
  if (/^next(\/|$)/.test(especificador) || especificador.startsWith("next-auth")) {
    return "import do Next — use @/compat/*";
  }
  if (
    especificador.startsWith("@dominio/") &&
    !DOMINIO_PERMITIDO.some((padrao) => padrao.test(especificador))
  ) {
    return "o front só alcança tipos, utils puros e permissões do domínio";
  }
  if (
    /^@\/(types|services|repositories)\//.test(especificador) ||
    /^@\/lib\/(auth|api|external|documentos)\//.test(especificador) ||
    especificador === "@/lib/prisma"
  ) {
    return "módulo de domínio importado como se fosse do web — use @dominio/ (ou uma rota da API)";
  }
  return null;
}

describe("fronteira do apps/web", () => {
  const arquivos = arquivosDoWeb(join(RAIZ_WEB, "src"));

  it("nenhum arquivo importa o Next ou alcança o domínio fora do permitido", () => {
    const problemas = arquivos.flatMap((arquivo) =>
      extrairEspecificadores(readFileSync(arquivo, "utf8")).flatMap((especificador) => {
        const motivo = motivoDaViolacao(especificador);
        return motivo ? [`${relative(RAIZ_WEB, arquivo)}: "${especificador}" — ${motivo}`] : [];
      })
    );

    expect(problemas).toEqual([]);
  });

  it("@prisma/client só entra como tipo (nunca vai para o bundle)", () => {
    const importDeValor = /^\s*import\s+(?!type\b)[^;]*?from\s+["']@prisma\/client["']/m;
    const problemas = arquivos
      .filter((arquivo) => importDeValor.test(readFileSync(arquivo, "utf8")))
      .map((arquivo) => relative(RAIZ_WEB, arquivo));

    expect(problemas).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar**

Run: `npm run web:test -- fronteira`
Expected: PASS. A guarda documenta um estado que as Tasks 4.3 a 4.8 já deixaram correto. Se falhar, a mensagem lista `arquivo: "especificador" — motivo`. Corrija o arquivo, de preferência rodando `node apps/web/scripts/codemod-imports.ts <arquivo>`.

Run: um teste negativo rápido, para provar que a guarda morde:
`printf 'import Link from "next/link";\nexport const x = Link;\n' > apps/web/src/violacao-temporaria.ts && npm run web:test -- fronteira; rm apps/web/src/violacao-temporaria.ts`
Expected: FAIL, apontando `src/violacao-temporaria.ts: "next/link" — import do Next — use @/compat/*`. Depois do `rm`, rode de novo: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/fronteira.test.ts
git commit -m "test(web): guarda de fronteira entre front e domínio"
```

---

### Task 4.10: Playwright com dois alvos e o script `dev:tudo`

**Files:**
- Modify: `playwright.config.ts`, `package.json` (scripts)
- Create: `e2e/web-infra.spec.ts`

**Interfaces:**
- Produces:
  - `E2E_ALVO=web|next` no Playwright, com padrão `next` até a parte B inverter;
  - `npm run e2e:web`;
  - `npm run dev:tudo`, que sobe API e web juntos, com `predev:tudo` subindo o Postgres via Docker.

- [ ] **Step 1: Escrever a spec**

`e2e/web-infra.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// Infra do front (Fase 4). Vale para os dois alvos do E2E: a proteção de rota (RN01) é
// a mesma regra do proxy.ts do Next, agora também implementada pela RotaProtegida.
test("rota protegida sem sessão leva ao login guardando o destino", async ({ page }) => {
  await page.goto("/clientes?pagina=2");

  await expect(page).toHaveURL("/login?callbackUrl=%2Fclientes%3Fpagina%3D2");
});

test("o front alcança a API pela mesma origem", async ({ request }) => {
  test.skip(process.env.E2E_ALVO !== "web", "O proxy /api → :3001 é o do Vite; o Next tem rewrites próprios.");

  const resposta = await request.get("/api/saude");

  expect(resposta.status()).toBe(200);
  expect(await resposta.json()).toEqual({ ok: true });
});
```

- [ ] **Step 2: Ver falhar no alvo web**

Run: `E2E_ALVO=web npx playwright test e2e/web-infra.spec.ts`
Expected: FAIL. A config atual sobe só o Next (`npm run build && npm run start` em :3000), e o `baseURL` não é o do Vite.

- [ ] **Step 3: Reescrever a config e os scripts**

`playwright.config.ts` substitui o conteúdo atual. O ramo `next` reproduz o `webServer` de hoje e acrescenta a API Nest, de que o Next depende desde as Fases 2 e 3. Com `reuseExistingServer`, uma API já de pé localmente é reaproveitada.

```ts
import { defineConfig, devices } from "@playwright/test";

// Fluxos críticos cobertos aqui: docs/testes/estrategia-tdd.md
//
// Fase 4 da migração (docs/arquitetura/migracao-nestjs.md): o mesmo conjunto de specs
// roda contra dois fronts. "next" (padrão até a parte 4b terminar) sobe a API Nest e o
// Next em :3000; "web" (E2E_ALVO=web) sobe a API Nest e o front React/Vite em :5173
// (build + preview), que encaminha /api para a API pelo proxy do Vite. A parte 4b
// inverte o padrão e apaga o ramo "next" junto com o Next.
const alvo = process.env.E2E_ALVO === "web" ? "web" : "next";
const reaproveitar = !process.env.CI;

const api = {
  command: "npm run api:dev",
  url: "http://localhost:3001/api/saude",
  reuseExistingServer: reaproveitar,
  timeout: 120_000,
};

const servidores =
  alvo === "web"
    ? [
        api,
        {
          command: "npm run web:build && npm run web:preview",
          url: "http://localhost:5173",
          reuseExistingServer: reaproveitar,
          timeout: 180_000,
        },
      ]
    : [
        api,
        {
          command: "npm run build && npm run start",
          url: "http://localhost:3000",
          reuseExistingServer: reaproveitar,
          timeout: 300_000,
          env: { API_NEST_URL: "http://localhost:3001" },
        },
      ];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: alvo === "web" ? "http://localhost:5173" : "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: servidores,
});
```

Em `package.json` (raiz), acrescentar em `"scripts"`:

```json
"predev:tudo": "docker compose up -d",
"dev:tudo": "concurrently -k -n api,web -c magenta,cyan \"npm run api:dev\" \"npm run web:dev\"",
"e2e:web": "E2E_ALVO=web playwright test",
```

- [ ] **Step 4: Rodar**

Run: `E2E_ALVO=web npx playwright test e2e/web-infra.spec.ts`
Expected: 2 passed. O Playwright sobe a API e o `vite preview`, ou reaproveita os que já estiverem de pé.

Run: `npx playwright test e2e/web-infra.spec.ts`
Expected: 1 passed, 1 skipped (alvo `next`).

Run: `npm run e2e`
Expected: a suíte completa continua verde contra o Next. As specs de fluxo (`agenda`, `casos`, `clientes`, `sessao`…) **não** rodam no alvo web nesta parte. Elas dependem das páginas portadas pela parte B, que passa a rodá-las com `npm run e2e:web`.

Run: `npm run dev:tudo`
Expected: o Postgres sobe pelo Docker, e os logs prefixados `[api]` e `[web]` mostram a API em :3001 e o Vite em `http://localhost:5173/`. Com `Ctrl+C` os dois encerram juntos.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts package.json e2e/web-infra.spec.ts
git commit -m "chore(e2e): Playwright contra o front Vite e script dev:tudo"
```

---

## Fase 4 — Front React + Vite (parte B: páginas e remoção do Next)

A parte A deixou `apps/web` de pé, com componentes, hooks e o front de `src/lib` já movidos, e com toda rota apontando para `PaginaEmMigracao`. Esta parte troca cada `page.tsx`/`layout.tsx` de `src/app` por uma página cliente em `apps/web/src/paginas/`. O que antes vinha de service direto num Server Component passa a vir de hooks do React Query sobre a API Nest. A redireção feita por `getTenantContextOuRedirect` passa para a `RotaProtegida`, e o `ctx.role` vira `useSessao().role`. No fim, o Next sai do repositório.

### Inventário (`src/app`, sem `src/app/api`)

| Arquivo | Tipo | Dados de service direto | Outros recursos Next |
|---|---|---|---|
| `layout.tsx` (raiz) | Server | — | `metadata` (template `%s \| CRM Advocacia`), `next/font` (Inter, Geist Mono), `globals.css`, `lang="en"` |
| `icon.tsx` | Server | — | `ImageResponse` (favicon dourado com ícone `Scale`) |
| `(auth)/layout.tsx` | Server | — | `next/link` |
| `(auth)/login/layout.tsx`, `(auth)/cadastro/layout.tsx` | Server | — | só `metadata` (Entrar / Criar conta) |
| `(auth)/login/page.tsx` (+ test) | Client | — | `signIn` do next-auth, `next/link`, `window.location` |
| `(auth)/cadastro/page.tsx` (+ test) | Client | — | `signIn`, `fetch /api/cadastro`, `next/link` |
| `(onboarding)/onboarding/page.tsx` | Server | `auth()` | `redirect("/login")`, `metadata` |
| `(dashboard)/layout.tsx` | Server | `auth()`, **`membroService.listarEscritoriosDoUsuario`** | `redirect` (/login, /onboarding), `QueryProvider escritorioId`, data do header formatada no servidor |
| `(dashboard)/_lib/tenant-context-pagina.ts` (+ test) | Server | `getTenantContext` | `redirect` |
| `(dashboard)/page.tsx` | Server | `dashboardService.resumo`, `montarListaCasos`, `montarOpcoesFiltroCaso`, `auth()` | `prefetchQuery` + `HydrationBoundary`/`dehydrate` (`getQueryClientServidor`), `paraJson`, `Suspense` com `DashboardSkeleton` (streaming) |
| `(dashboard)/clientes/page.tsx` | Server | `getTenantContextOuRedirect`, `auth()` (nome) | `metadata` |
| `(dashboard)/casos/page.tsx` | Server | idem | `metadata` |
| `(dashboard)/agenda/page.tsx` | Server | `getTenantContextOuRedirect` | `Suspense` (exigido pelo `useSearchParams` do Next), `metadata` |
| `(dashboard)/campanhas/page.tsx` | Server | `getTenantContextOuRedirect` (`role === "padrao"`) | `metadata` |
| `(dashboard)/campanhas/nova/page.tsx` | Server | idem | `redirect("/campanhas")` para `padrao` |
| `(dashboard)/campanhas/[id]/page.tsx` | Server | idem | `params` (Promise), `metadata` |
| `(dashboard)/instancias/page.tsx` | Server | idem | `metadata` |
| `(dashboard)/perfil/page.tsx` (+ test) | Server | `auth()`, **`usuarioService.obterPerfil`** | `redirect("/login")` sem sessão ou sem usuário |
| `(dashboard)/configuracoes/layout.tsx` | Server | — | — |
| `(dashboard)/configuracoes/page.tsx` | Server | — | `redirect("/configuracoes/escritorio")` |
| `(dashboard)/configuracoes/escritorio/page.tsx` | Server | `escritorioService.obterEscritorioAtivo` | `metadata` |
| `(dashboard)/configuracoes/membros/page.tsx` (+ test) | Server | **`membroService.listarMembros` + `usuarioService.assinarUrlAvatar`**, `conviteService.listarPendentes` | `metadata` |
| `(dashboard)/configuracoes/status/page.tsx`, `tipos-processo/page.tsx` | Server | `getTenantContextOuRedirect` | `metadata` |
| `(dashboard)/{agenda,campanhas,campanhas/nova,campanhas/[id],instancias}/_components/**` | Client | — | `next/link`, `next/navigation` (`useRouter`) em `lista-campanhas`, `detalhe-campanha`, `formulario-campanha`, `seletor-instancia` e no teste `formulario-campanha.test.tsx` |

Não há `loading.tsx`, `error.tsx` nem `not-found.tsx`: o Next usava os padrões dele, e a Task 4.33 cria os equivalentes no React Router.

Três dados **não têm endpoint hoje** (em negrito acima) e precisam de API antes da página: a lista de escritórios do usuário, o perfil e a lista de membros com avatar assinado (`GET /api/membros` existe, mas devolve a chave crua do S3). O resto já tem rota: `/api/escritorios/atual`, `/api/convites`, `/api/dashboard/resumo`, `/api/casos`, `/api/casos/filtros` etc.

### Contratos assumidos das Fases 2, 3 e 4a

Validar antes da Task 4.20. Onde o nome real for outro, ajustar só os imports.

- **Fase 2**: módulos Nest `apps/api/src/escritorios/` (`escritorios.module.ts`, `tokens.ts`), `apps/api/src/perfil/` (`perfil.module.ts`, `tokens.ts`) e `apps/api/src/membros/` (`membros.module.ts`, `membros.controller.ts` com `GET /api/membros`, `tokens.ts` com `MEMBRO_SERVICE`).
- **Fase 2 (Task 2.20)**: rotas que só exigem sessão (sem tenant) usam `UsuarioGuard` (`apps/api/src/comum/tenant/usuario.guard.ts`) e o decorator `@UsuarioId()` (`apps/api/src/comum/tenant/usuario.decorator.ts`, devolve `string`). Em `criarAppDeTeste`, a opção `usuarioId?: string | Error` controla o resolvedor (padrão `CTX_OWNER.usuarioId`); para simular sessão ausente, passe `usuarioId: new NaoAutenticadoError()`.
- **4a, `@/lib/sessao`**:
  - `useSessao()` lê de um **contexto React** montado acima do router, e não de um `useQuery` no QueryClient mais próximo. O layout do dashboard aninha um `QueryProvider` por escritório.
  - Retorna `{ usuario: { id, nome, email }, escritorioId: string | null, role: RoleMembro | null }`.
  - `entrar(email: string, senha: string): Promise<boolean>` — `false` para credencial inválida (401/400), lança `Error` em outras falhas (contrato da Fase 3, mantido na Task 4.5).
  - `trocarEscritorio(escritorioId: string): Promise<void>` lança `ApiError`.
- **4a, `RotaProtegida`**: renderiza `<Outlet />`, redireciona para `/login?callbackUrl=…` sem sessão e para `/onboarding` sem escritório. A Task 4.24 acrescenta `exigirEscritorio={false}` se ainda não existir.
- **4a, `rotas.tsx`**: exporta o array `RouteObject[]` usado no `createBrowserRouter`. A Task 4.33 fixa a árvore final.
- **4a, demais**:
  - `@/lib/api-client` (`apiFetch`, `ApiError`), `@/lib/test-utils` (`criarQueryClientDeTeste`), `@/lib/utils/data` (`formatarDataExtensa`) e `@/lib/query/chaves` estão em `apps/web/src/lib`.
  - Tipos de DTO são importados como os componentes movidos já importam.
  - Scripts `web:dev`, `web:build` e `web:test`; pacote `@crm/web`.

---

### Task 4.20: API — `GET /api/escritorios` (escritórios do usuário da sessão)

Hoje o layout do dashboard chama `membroService.listarEscritoriosDoUsuario(session.user.id)` direto, e não existe rota HTTP para isso. A rota exige só sessão, não tenant, porque lista os escritórios do *usuário*.

**Files:**
- Create: `apps/api/src/escritorios/meus-escritorios.controller.ts`
- Test: `apps/api/src/escritorios/meus-escritorios.controller.test.ts`
- Modify: `apps/api/src/escritorios/tokens.ts`, `apps/api/src/escritorios/escritorios.module.ts`

**Interfaces:**
- Consumes: `membroService.listarEscritoriosDoUsuario(usuarioId): Promise<{ escritorio: Escritorio; role: RoleMembro }[]>`; `UsuarioGuard`, `UsuarioId` (Fase 3); `criarAppDeTeste`, `CTX_OWNER`.
- Produces: `GET /api/escritorios → 200 { escritorios: { id: string; nome: string; role: RoleMembro }[] }`, 401 sem sessão. Token `MEMBRO_SERVICE_DO_USUARIO`.

- [ ] **Step 1: Teste que falha**

`apps/api/src/escritorios/meus-escritorios.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { EscritoriosModule } from "./escritorios.module";
import { MEMBRO_SERVICE_DO_USUARIO } from "./tokens";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const membros = { listarEscritoriosDoUsuario: jest.fn() };
let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [EscritoriosModule],
    ctx,
    overrides: [[MEMBRO_SERVICE_DO_USUARIO, membros]],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/escritorios", () => {
  it("lista só id, nome e papel de cada escritório do usuário da sessão", async () => {
    membros.listarEscritoriosDoUsuario.mockResolvedValue([
      {
        escritorio: { id: "esc-1", nome: "Um", oabResponsavel: "SC 1", telefoneWhatsapp: null },
        role: "owner",
      },
      {
        escritorio: { id: "esc-2", nome: "Dois", oabResponsavel: null, telefoneWhatsapp: "5548" },
        role: "padrao",
      },
    ]);

    await request(await subir())
      .get("/api/escritorios")
      .expect(200, {
        escritorios: [
          { id: "esc-1", nome: "Um", role: "owner" },
          { id: "esc-2", nome: "Dois", role: "padrao" },
        ],
      });
    expect(membros.listarEscritoriosDoUsuario).toHaveBeenCalledWith(CTX_OWNER.usuarioId);
  });

  it("responde 401 sem sessão e não consulta o banco", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/escritorios").expect(401);
    expect(membros.listarEscritoriosDoUsuario).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- meus-escritorios`
Expected: FAIL. `MEMBRO_SERVICE_DO_USUARIO` não é exportado de `./tokens` e o controller não existe.

- [ ] **Step 3: Implementar**

Acrescentar ao fim de `apps/api/src/escritorios/tokens.ts`:

```ts
// Leitura dos escritórios do usuário (switcher do header) — rota de sessão, não de tenant.
export const MEMBRO_SERVICE_DO_USUARIO = Symbol("MEMBRO_SERVICE_DO_USUARIO");
```

`apps/api/src/escritorios/meus-escritorios.controller.ts`:

```ts
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { UsuarioGuard } from "../comum/tenant/usuario.guard";
import { UsuarioId } from "../comum/tenant/usuario.decorator";
import { MEMBRO_SERVICE_DO_USUARIO } from "./tokens";
import type { membroService } from "@/services/membro.service";

// Escritórios em que o usuário da sessão é membro, para o switcher do header. Exige só
// sessão: a lista é do usuário, não de um tenant. A projeção devolve id/nome/papel e
// nunca os demais dados de escritórios que não são o ativo.
@Controller("escritorios")
@UseGuards(UsuarioGuard)
export class MeusEscritoriosController {
  constructor(
    @Inject(MEMBRO_SERVICE_DO_USUARIO)
    private readonly membros: Pick<typeof membroService, "listarEscritoriosDoUsuario">
  ) {}

  @Get()
  async listar(@UsuarioId() usuarioId: string) {
    const lista = await this.membros.listarEscritoriosDoUsuario(usuarioId);
    return {
      escritorios: lista.map(({ escritorio, role }) => ({
        id: escritorio.id,
        nome: escritorio.nome,
        role,
      })),
    };
  }
}
```

Em `apps/api/src/escritorios/escritorios.module.ts`:
- acrescentar `MeusEscritoriosController` em `controllers`;
- acrescentar em `providers`:

```ts
{ provide: MEMBRO_SERVICE_DO_USUARIO, useValue: membroService },
```

Os imports são `import { MeusEscritoriosController } from "./meus-escritorios.controller";`, `import { MEMBRO_SERVICE_DO_USUARIO } from "./tokens";` e `import { membroService } from "@/services/membro.service";`. O `POST /api/escritorios` da Fase 2 continua no controller dele. Dois controllers com o mesmo prefixo e métodos diferentes não colidem no Nest.

- [ ] **Step 4: Rodar**

Run: `npm run api:test -- escritorios && npm run api:typecheck`
Expected: PASS (incluindo as suítes já existentes de `escritorios`); typecheck sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/escritorios
git commit -m "feat(api): GET /api/escritorios lista os escritórios do usuário da sessão"
```

---

### Task 4.21: API — `GET /api/perfil`

A página de perfil lia `usuarioService.obterPerfil` direto e mandava para `/login` se o usuário não existisse mais. Hoje só existe `PATCH /api/perfil`.

**Files:**
- Create: `apps/api/src/perfil/perfil-leitura.controller.ts`
- Test: `apps/api/src/perfil/perfil-leitura.controller.test.ts`
- Modify: `apps/api/src/perfil/tokens.ts`, `apps/api/src/perfil/perfil.module.ts`

**Interfaces:**
- Consumes: `usuarioService.obterPerfil(usuarioId): Promise<Usuario | null>`; `NaoAutenticadoError`.
- Produces: `GET /api/perfil → 200 { usuario: { id, nome, email, temAvatar: boolean } }`. Responde 401 sem sessão **ou** quando o usuário foi removido. Nesse caso o `apiFetch` leva ao login, como fazia o `redirect` da página. Token `USUARIO_SERVICE_PERFIL`.

- [ ] **Step 1: Teste que falha**

`apps/api/src/perfil/perfil-leitura.controller.test.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { PerfilModule } from "./perfil.module";
import { USUARIO_SERVICE_PERFIL } from "./tokens";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const usuarios = { obterPerfil: jest.fn() };
let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [PerfilModule],
    ctx,
    overrides: [[USUARIO_SERVICE_PERFIL, usuarios]],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/perfil", () => {
  it("devolve os dados do banco, sem senhaHash e sem a chave do avatar", async () => {
    usuarios.obterPerfil.mockResolvedValue({
      id: "user-1",
      nome: "Nome Novo",
      email: "novo@teste.com",
      senhaHash: "$2b$10$segredo",
      avatarUrl: "development/avatares/user-1/foto.png",
      telefone: null,
    });

    const res = await request(await subir()).get("/api/perfil").expect(200);

    expect(res.body).toEqual({
      usuario: { id: "user-1", nome: "Nome Novo", email: "novo@teste.com", temAvatar: true },
    });
    expect(usuarios.obterPerfil).toHaveBeenCalledWith(CTX_OWNER.usuarioId);
  });

  it("temAvatar é false quando o usuário não tem foto", async () => {
    usuarios.obterPerfil.mockResolvedValue({
      id: "user-1",
      nome: "N",
      email: "n@teste.com",
      senhaHash: "x",
      avatarUrl: null,
    });

    const res = await request(await subir()).get("/api/perfil").expect(200);
    expect(res.body.usuario.temAvatar).toBe(false);
  });

  it("responde 401 quando o usuário da sessão não existe mais", async () => {
    usuarios.obterPerfil.mockResolvedValue(null);

    await request(await subir()).get("/api/perfil").expect(401);
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/perfil").expect(401);
    expect(usuarios.obterPerfil).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- perfil-leitura`
Expected: FAIL. `USUARIO_SERVICE_PERFIL` e o controller não existem.

- [ ] **Step 3: Implementar**

Acrescentar ao fim de `apps/api/src/perfil/tokens.ts`:

```ts
export const USUARIO_SERVICE_PERFIL = Symbol("USUARIO_SERVICE_PERFIL");
```

`apps/api/src/perfil/perfil-leitura.controller.ts`:

```ts
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { UsuarioGuard } from "../comum/tenant/usuario.guard";
import { UsuarioId } from "../comum/tenant/usuario.decorator";
import { USUARIO_SERVICE_PERFIL } from "./tokens";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";
import type { usuarioService } from "@/services/usuario.service";

// Leitura do perfil do usuário (não do tenant). Lê sempre do banco: a sessão guarda o
// nome do momento do login e o PATCH não a renova. A chave do avatar no S3 não sai
// daqui; a URL assinada continua vindo de GET /api/perfil/avatar/download-url.
@Controller("perfil")
@UseGuards(UsuarioGuard)
export class PerfilLeituraController {
  constructor(
    @Inject(USUARIO_SERVICE_PERFIL)
    private readonly usuarios: Pick<typeof usuarioService, "obterPerfil">
  ) {}

  @Get()
  async obter(@UsuarioId() usuarioId: string) {
    const perfil = await this.usuarios.obterPerfil(usuarioId);
    // Sessão válida para um usuário que não existe mais equivale a sessão inválida.
    if (!perfil) throw new NaoAutenticadoError();
    return {
      usuario: {
        id: perfil.id,
        nome: perfil.nome,
        email: perfil.email,
        temAvatar: perfil.avatarUrl != null,
      },
    };
  }
}
```

Em `apps/api/src/perfil/perfil.module.ts`:
- acrescentar `PerfilLeituraController` em `controllers`;
- acrescentar `{ provide: USUARIO_SERVICE_PERFIL, useValue: usuarioService }` em `providers`.

O `NaoAutenticadoError` chega como 401 pelo `ErrosHttpFilter` global (`tratarErroDeContexto`, Fase 1).

- [ ] **Step 4: Rodar**

Run: `npm run api:test -- perfil && npm run api:typecheck`
Expected: PASS; sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/perfil
git commit -m "feat(api): GET /api/perfil devolve o perfil do usuário da sessão lido do banco"
```

---

### Task 4.22: API — `GET /api/membros` devolve o avatar já assinado

A página de membros assinava cada `avatarUrl` com `usuarioService.assinarUrlAvatar` antes de montar a tabela. O `GET /api/membros` devolve a chave crua do S3, que não serve como `src` de imagem. Nenhum código do front consome esse GET hoje (confirmado por `grep -rn "api/membros" src`), então mudar o contrato não quebra ninguém.

**Files:**
- Modify: `apps/api/src/membros/tokens.ts`, `apps/api/src/membros/membros.controller.ts`, `apps/api/src/membros/membros.module.ts`
- Test: `apps/api/src/membros/membros.controller.test.ts` (acrescentar casos)

**Interfaces:**
- Consumes: `membroService.listarMembros(ctx)`, `usuarioService.assinarUrlAvatar(chave: string | null): Promise<string | null>`.
- Produces: `GET /api/membros → 200 { membros: MembroComUsuarioPublico[] }`, com `usuario.avatarUrl` igual a uma URL assinada ou `null`. Token `USUARIO_SERVICE_AVATAR`.

- [ ] **Step 1: Teste que falha**

Acrescentar a `apps/api/src/membros/membros.controller.test.ts`. Quem migra para cá é o teste de `src/app/(dashboard)/configuracoes/membros/page.test.tsx`.

```ts
import { USUARIO_SERVICE_AVATAR } from "./tokens";

const avatares = { assinarUrlAvatar: jest.fn() };

describe("GET /api/membros — avatar", () => {
  afterEach(() => jest.clearAllMocks());

  it("assina o avatarUrl de cada membro antes de responder", async () => {
    const membroService = {
      listarMembros: jest.fn().mockResolvedValue([
        {
          id: "membro-1",
          role: "owner",
          usuario: {
            id: "user-1",
            nome: "Dona Owner",
            email: "owner@teste.com",
            telefone: null,
            avatarUrl: "development/avatares/user-1/foto.png",
          },
        },
        {
          id: "membro-2",
          role: "padrao",
          usuario: { id: "user-2", nome: "Sem Foto", email: "s@teste.com", telefone: null, avatarUrl: null },
        },
      ]),
    };
    avatares.assinarUrlAvatar.mockImplementation(async (chave: string | null) =>
      chave ? "https://bucket.s3.amazonaws.com/signed-get" : null
    );
    const app = await criarAppDeTeste({
      imports: [MembrosModule],
      overrides: [
        [MEMBRO_SERVICE, membroService],
        [USUARIO_SERVICE_AVATAR, avatares],
      ],
    });

    const res = await request(app.getHttpServer()).get("/api/membros").expect(200);

    expect(avatares.assinarUrlAvatar).toHaveBeenCalledWith("development/avatares/user-1/foto.png");
    expect(res.body.membros[0].usuario.avatarUrl).toBe("https://bucket.s3.amazonaws.com/signed-get");
    expect(res.body.membros[1].usuario.avatarUrl).toBeNull();
    await app.close();
  });
});
```

(`criarAppDeTeste`, `MembrosModule`, `MEMBRO_SERVICE` e `request` já são importados no arquivo pela Fase 2.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run api:test -- membros.controller`
Expected: FAIL. `USUARIO_SERVICE_AVATAR` não existe e o avatar volta cru.

- [ ] **Step 3: Implementar**

Acrescentar ao fim de `apps/api/src/membros/tokens.ts`:

```ts
export const USUARIO_SERVICE_AVATAR = Symbol("USUARIO_SERVICE_AVATAR");
```

Em `apps/api/src/membros/membros.controller.ts`:
- acrescentar ao construtor o parâmetro abaixo:

```ts
@Inject(USUARIO_SERVICE_AVATAR)
private readonly avatares: Pick<typeof usuarioService, "assinarUrlAvatar">,
```

- substituir o handler `@Get()` por:

```ts
  // A chave do S3 nunca sai crua: a tabela de membros usa a URL como <img src>.
  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    const membros = await this.service.listarMembros(ctx);
    return {
      membros: await Promise.all(
        membros.map(async (membro) => ({
          ...membro,
          usuario: {
            ...membro.usuario,
            avatarUrl: await this.avatares.assinarUrlAvatar(membro.usuario.avatarUrl),
          },
        }))
      ),
    };
  }
```

Os imports são `USUARIO_SERVICE_AVATAR` (de `./tokens`) e `import type { usuarioService } from "@/services/usuario.service"`. Em `membros.module.ts`, acrescentar `{ provide: USUARIO_SERVICE_AVATAR, useValue: usuarioService }` aos `providers` e importar `usuarioService` como valor.

- [ ] **Step 4: Rodar**

Run: `npm run api:test -- membros && npm run api:typecheck`
Expected: PASS; os casos antigos de `GET /api/membros` continuam verdes, desde que tenham `avatarUrl: null` ou recebam o override de `USUARIO_SERVICE_AVATAR`. Se algum falhar por chamar o S3 real, acrescentar `[USUARIO_SERVICE_AVATAR, { assinarUrlAvatar: async () => null }]` aos `overrides` dele.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/membros
git commit -m "feat(api): GET /api/membros devolve o avatar de cada membro com URL assinada"
```

---

### Task 4.23: Base das páginas — hooks de dados, sessão do escritório, utilitários de teste e `refresh()`

**Files:**
- Create: `apps/web/src/hooks/use-sessao-do-escritorio.ts`, `apps/web/src/hooks/use-escritorios.ts`, `apps/web/src/hooks/use-membros.ts`, `apps/web/src/hooks/use-perfil.ts`, `apps/web/src/lib/test-paginas.tsx`
- Test: `apps/web/src/hooks/use-sessao-do-escritorio.test.ts`, `apps/web/src/hooks/use-escritorios.test.ts`, `apps/web/src/hooks/use-membros.test.ts`, `apps/web/src/hooks/use-perfil.test.ts`, `apps/web/src/compat/next-navigation-refresh.test.tsx`
- Modify (só se o teste de `refresh` falhar): o arquivo do compat `@/compat/next-navigation`

**Interfaces:**
- Produces:
  ```ts
  // use-sessao-do-escritorio.ts
  export interface SessaoDoEscritorio { usuario: { id: string; nome: string; email: string }; escritorioId: string; role: RoleMembro }
  export function useSessaoDoEscritorio(): SessaoDoEscritorio
  // use-escritorios.ts
  export interface EscritorioDoUsuarioDTO { id: string; nome: string; role: RoleMembro }
  export interface EscritorioAtualDTO { id: string; nome: string; oabResponsavel: string | null; telefoneWhatsapp: string | null }
  export const RAIZ_ESCRITORIOS: readonly ["escritorios"]
  export function useMeusEscritorios(): UseQueryResult<EscritorioDoUsuarioDTO[]>
  export function useEscritorioAtual(): UseQueryResult<EscritorioAtualDTO>
  // use-membros.ts
  export const chaveMembros: () => readonly ["membros"]
  export const chaveConvites: () => readonly ["convites"]
  export function useMembros(): UseQueryResult<MembroLinha[]>
  export function useConvitesPendentes(habilitado: boolean): UseQueryResult<ConviteLinha[]>
  // use-perfil.ts
  export interface PerfilDTO { id: string; nome: string; email: string; temAvatar: boolean }
  export const chavePerfil: () => readonly ["perfil"]
  export function usePerfil(): UseQueryResult<PerfilDTO>
  // test-paginas.tsx
  export const SESSAO_OWNER, SESSAO_PADRAO
  export function respostaJson(corpo: unknown, status?: number): Response
  export function mockApi(rotas: Record<string, unknown>): void
  export function renderPagina(ui: ReactElement, opcoes?: { rota?: string; caminho?: string; outras?: [string, ReactElement][] }): RenderResult & { queryClient: QueryClient }
  ```
- Guarantees: `useRouter().refresh()` do compat chama `queryClient.invalidateQueries()` no client mais próximo. É o equivalente SPA do `router.refresh()` do Next, que re-renderizava os Server Components. Os componentes que já chamam `refresh()` depois de uma escrita (`MembrosTable`, `ConvitesTable`, `ConviteForm`, `EscritorioForm`, `PerfilForm`, `AvatarUpload`) passam então a refazer as queries ativas sem nenhuma mudança neles.

- [ ] **Step 1: Utilitário de teste das páginas**

`apps/web/src/lib/test-paginas.tsx`:

```tsx
import type { ReactElement } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { render } from "@testing-library/react";
import { criarQueryClientDeTeste } from "@/lib/test-utils";

export const SESSAO_OWNER = {
  usuario: { id: "user-1", nome: "Dona Owner", email: "owner@teste.com" },
  escritorioId: "esc-1",
  role: "owner" as const,
};

export const SESSAO_PADRAO = {
  usuario: { id: "user-2", nome: "Colaborador Padrão", email: "padrao@teste.com" },
  escritorioId: "esc-1",
  role: "padrao" as const,
};

// Resposta mínima que o apiFetch aceita (JSON declarado, sem redirect).
export function respostaJson(corpo: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    redirected: false,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => corpo,
  } as unknown as Response;
}

// Mock de fetch por URL exata. Um valor Error vira 500 { error }, e uma URL não
// declarada falha o teste: a página não pode chamar a API além do esperado.
export function mockApi(rotas: Record<string, unknown>) {
  global.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const chave = String(url);
    if (!(chave in rotas)) throw new Error(`fetch inesperado: ${chave}`);
    const corpo = rotas[chave];
    return corpo instanceof Error ? respostaJson({ error: corpo.message }, 500) : respostaJson(corpo);
  }) as jest.Mock;
}

interface OpcoesRender {
  rota?: string;
  caminho?: string;
  outras?: [string, ReactElement][];
}

// Página dentro de um router de memória (Link/Navigate/useParams funcionam) e de um
// QueryClient isolado e sem retry.
export function renderPagina(ui: ReactElement, { rota = "/", caminho = "/", outras = [] }: OpcoesRender = {}) {
  const queryClient = criarQueryClientDeTeste();
  const resultado = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path={caminho} element={ui} />
          {outras.map(([caminhoOutro, elemento]) => (
            <Route key={caminhoOutro} path={caminhoOutro} element={elemento} />
          ))}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { queryClient, ...resultado };
}
```

- [ ] **Step 2: Testes que falham**

`apps/web/src/hooks/use-sessao-do-escritorio.test.ts`:

```ts
import { renderHook } from "@testing-library/react";
import { useSessao } from "@/lib/sessao";
import { useSessaoDoEscritorio } from "./use-sessao-do-escritorio";
import { SESSAO_OWNER } from "@/lib/test-paginas";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));
const mockedUseSessao = useSessao as jest.Mock;

describe("useSessaoDoEscritorio", () => {
  it("devolve a sessão com escritório e papel garantidos", () => {
    mockedUseSessao.mockReturnValue(SESSAO_OWNER);
    const { result } = renderHook(() => useSessaoDoEscritorio());
    expect(result.current).toEqual(SESSAO_OWNER);
  });

  it("falha alto fora de uma rota com escritório ativo", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockedUseSessao.mockReturnValue({ ...SESSAO_OWNER, escritorioId: null, role: null });
    expect(() => renderHook(() => useSessaoDoEscritorio())).toThrow(/RotaProtegida/);
  });
});
```

`apps/web/src/hooks/use-escritorios.test.ts`:

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { mockApi } from "@/lib/test-paginas";
import { useEscritorioAtual, useMeusEscritorios } from "./use-escritorios";

function wrapper() {
  const queryClient = criarQueryClientDeTeste();
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useMeusEscritorios", () => {
  it("lê a lista de GET /api/escritorios", async () => {
    mockApi({ "/api/escritorios": { escritorios: [{ id: "esc-1", nome: "Um", role: "owner" }] } });
    const { result } = renderHook(() => useMeusEscritorios(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "esc-1", nome: "Um", role: "owner" }]);
  });
});

describe("useEscritorioAtual", () => {
  it("lê o escritório ativo de GET /api/escritorios/atual", async () => {
    const escritorio = { id: "esc-1", nome: "Um", oabResponsavel: null, telefoneWhatsapp: null };
    mockApi({ "/api/escritorios/atual": { escritorio } });
    const { result } = renderHook(() => useEscritorioAtual(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(escritorio);
  });

  it("expõe o erro da API", async () => {
    mockApi({ "/api/escritorios/atual": new Error("Escritório não encontrado.") });
    const { result } = renderHook(() => useEscritorioAtual(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Escritório não encontrado.");
  });
});
```

`apps/web/src/hooks/use-membros.test.ts`:

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { mockApi } from "@/lib/test-paginas";
import { useConvitesPendentes, useMembros } from "./use-membros";

function wrapper() {
  const queryClient = criarQueryClientDeTeste();
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useMembros", () => {
  it("projeta só os campos que a tabela usa", async () => {
    mockApi({
      "/api/membros": {
        membros: [
          {
            id: "m1",
            role: "owner",
            escritorioId: "esc-1",
            usuarioId: "user-1",
            createdAt: "2026-01-01T00:00:00.000Z",
            usuario: { id: "user-1", nome: "Dona", email: "d@t.com", telefone: null, avatarUrl: "https://s3/x" },
          },
        ],
      },
    });
    const { result } = renderHook(() => useMembros(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      {
        id: "m1",
        role: "owner",
        usuario: { id: "user-1", nome: "Dona", email: "d@t.com", telefone: null, avatarUrl: "https://s3/x" },
      },
    ]);
  });
});

describe("useConvitesPendentes", () => {
  it("não chama a API quando desabilitado (papel padrao recebe 403)", () => {
    mockApi({});
    const { result } = renderHook(() => useConvitesPendentes(false), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("lê os convites de GET /api/convites", async () => {
    mockApi({
      "/api/convites": {
        convites: [{ id: "c1", email: "novo@t.com", role: "padrao", expiraEm: "2026-12-01T00:00:00.000Z" }],
      },
    });
    const { result } = renderHook(() => useConvitesPendentes(true), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "c1", email: "novo@t.com", role: "padrao" }]);
  });
});
```

`apps/web/src/hooks/use-perfil.test.ts`:

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { mockApi } from "@/lib/test-paginas";
import { usePerfil } from "./use-perfil";

it("lê o perfil de GET /api/perfil", async () => {
  const usuario = { id: "user-1", nome: "Nome Novo", email: "novo@t.com", temAvatar: true };
  mockApi({ "/api/perfil": { usuario } });
  const queryClient = criarQueryClientDeTeste();
  const { result } = renderHook(() => usePerfil(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(usuario);
});
```

`apps/web/src/compat/next-navigation-refresh.test.tsx`:

```tsx
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { useRouter } from "./next-navigation";

// Os componentes migrados do Next chamam router.refresh() depois de uma escrita para
// recarregar os dados da página. Na SPA os dados vêm do React Query, então refresh()
// precisa invalidar as queries ativas; senão a tela fica com o dado antigo.
it("refresh() invalida as queries do QueryClient mais próximo", () => {
  const queryClient = criarQueryClientDeTeste();
  const invalidar = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useRouter(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    ),
  });

  act(() => result.current.refresh());

  expect(invalidar).toHaveBeenCalledWith();
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm run web:test -- use-sessao-do-escritorio use-escritorios use-membros use-perfil next-navigation-refresh`
Expected: FAIL. Os quatro hooks não existem. O teste do `refresh` passa se a 4a já invalida queries; se falhar, aplicar a correção do Step 4.

- [ ] **Step 4: Implementar**

`apps/web/src/hooks/use-sessao-do-escritorio.ts`:

```ts
import type { RoleMembro } from "@prisma/client";
import { useSessao } from "@/lib/sessao";

export interface SessaoDoEscritorio {
  usuario: { id: string; nome: string; email: string };
  escritorioId: string;
  role: RoleMembro;
}

// Páginas do dashboard só montam sob <RotaProtegida> com escritório ativo, que já
// redirecionou quem não tem sessão ou escritório. Este hook estreita o tipo para essas
// páginas e falha alto se alguém montá-lo fora dessa garantia, em vez de deixar uma
// tela checar papel contra null.
export function useSessaoDoEscritorio(): SessaoDoEscritorio {
  const sessao = useSessao();
  if (!sessao?.escritorioId || !sessao.role) {
    throw new Error("useSessaoDoEscritorio usado fora de RotaProtegida com escritório ativo.");
  }
  return { usuario: sessao.usuario, escritorioId: sessao.escritorioId, role: sessao.role };
}
```

`apps/web/src/hooks/use-escritorios.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import type { RoleMembro } from "@prisma/client";
import { apiFetch } from "@/lib/api-client";

export interface EscritorioDoUsuarioDTO {
  id: string;
  nome: string;
  role: RoleMembro;
}

export interface EscritorioAtualDTO {
  id: string;
  nome: string;
  oabResponsavel: string | null;
  telefoneWhatsapp: string | null;
}

// Raiz comum: renomear o escritório (EscritorioForm → refresh) refaz a lista do switcher
// e os dados da tela de configurações de uma vez.
export const RAIZ_ESCRITORIOS = ["escritorios"] as const;
export const chaveMeusEscritorios = () => [...RAIZ_ESCRITORIOS, "meus"] as const;
export const chaveEscritorioAtual = () => [...RAIZ_ESCRITORIOS, "atual"] as const;

export function useMeusEscritorios() {
  return useQuery({
    queryKey: chaveMeusEscritorios(),
    queryFn: async () =>
      (await apiFetch<{ escritorios: EscritorioDoUsuarioDTO[] }>("/api/escritorios")).escritorios,
  });
}

export function useEscritorioAtual() {
  return useQuery({
    queryKey: chaveEscritorioAtual(),
    queryFn: async () =>
      (await apiFetch<{ escritorio: EscritorioAtualDTO }>("/api/escritorios/atual")).escritorio,
  });
}
```

`apps/web/src/hooks/use-membros.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { MembroLinha } from "@/components/configuracoes/membros-table";
import type { ConviteLinha } from "@/components/configuracoes/convites-table";

export const chaveMembros = () => ["membros"] as const;
export const chaveConvites = () => ["convites"] as const;

// A API devolve o membro inteiro (com avatar já assinado). A tabela recebe só o que
// exibe, como a página server fazia.
export function useMembros() {
  return useQuery({
    queryKey: chaveMembros(),
    queryFn: async () => {
      const { membros } = await apiFetch<{ membros: MembroLinha[] }>("/api/membros");
      return membros.map((membro) => ({
        id: membro.id,
        role: membro.role,
        usuario: {
          id: membro.usuario.id,
          nome: membro.usuario.nome,
          email: membro.usuario.email,
          telefone: membro.usuario.telefone,
          avatarUrl: membro.usuario.avatarUrl,
        },
      }));
    },
  });
}

// Convites são só de quem gerencia membros: o papel padrao recebe 403, então a query
// nem dispara para ele.
export function useConvitesPendentes(habilitado: boolean) {
  return useQuery({
    queryKey: chaveConvites(),
    enabled: habilitado,
    queryFn: async () => {
      const { convites } = await apiFetch<{ convites: ConviteLinha[] }>("/api/convites");
      return convites.map((convite) => ({ id: convite.id, email: convite.email, role: convite.role }));
    },
  });
}
```

`apps/web/src/hooks/use-perfil.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface PerfilDTO {
  id: string;
  nome: string;
  email: string;
  temAvatar: boolean;
}

export const chavePerfil = () => ["perfil"] as const;

export function usePerfil() {
  return useQuery({
    queryKey: chavePerfil(),
    queryFn: async () => (await apiFetch<{ usuario: PerfilDTO }>("/api/perfil")).usuario,
  });
}
```

Se o teste de `refresh` falhou, no `useRouter` de `@/compat/next-navigation`:
- obter o client com `const queryClient = useQueryClient();` (import de `@tanstack/react-query`);
- definir `refresh` como:

```ts
    // Equivalente SPA do router.refresh() do Next: refaz as queries ativas da tela.
    refresh: () => {
      void queryClient.invalidateQueries();
    },
```

- [ ] **Step 5: Rodar**

Run: `npm run web:test -- use-sessao-do-escritorio use-escritorios use-membros use-perfil next-navigation-refresh`
Expected: PASS (5 suítes).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks apps/web/src/lib/test-paginas.tsx apps/web/src/compat
git commit -m "feat(web): hooks de escritórios, membros e perfil e base de testes das páginas"
```

---

### Task 4.24: Auth e onboarding — layout de auth, login, cadastro e onboarding

**Files:**
- Create: `apps/web/src/paginas/layouts/layout-auth.tsx`, `apps/web/src/paginas/login.tsx`, `apps/web/src/paginas/cadastro.tsx`, `apps/web/src/paginas/onboarding.tsx`
- Test: `apps/web/src/paginas/login.test.tsx`, `apps/web/src/paginas/cadastro.test.tsx`, `apps/web/src/paginas/onboarding.test.tsx`
- Modify: `apps/web/src/rotas.tsx`; o componente `RotaProtegida` (e o teste dele), se ainda não aceitar `exigirEscritorio`
- Delete: `src/app/(auth)/**`, `src/app/(onboarding)/**`

**Interfaces:**
- Consumes: `entrar(email, senha): Promise<boolean>` de `@/lib/sessao`; `useTituloPagina`; `AuthBrandingPanel`, `PasswordStrengthMeter`, `NovoEscritorioForm`.
- Produces: `LayoutAuth`, `PaginaLogin`, `destinoSeguro(callbackUrl)`, `PaginaCadastro`, `PaginaOnboarding`. Também `RotaProtegida` com a prop `exigirEscritorio?: boolean` (padrão `true`).

Decisão: login e cadastro continuam terminando em **navegação dura** (`window.location.href`). O reload descarta todo cache em memória do usuário anterior e relê `/api/auth/sessao` do zero. Assim nada depende de como `entrar` propaga o estado, e nenhum dado de outro usuário ou tenant sobrevive no React Query.

- [ ] **Step 1: Testes que falham**

`apps/web/src/paginas/login.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { entrar } from "@/lib/sessao";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina } from "@/lib/test-paginas";
import { PaginaLogin, destinoSeguro } from "./login";

jest.mock("@/lib/sessao", () => ({ entrar: jest.fn() }));
jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));

const mockedEntrar = entrar as jest.Mock;

describe("PaginaLogin", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    jest.clearAllMocks();
    Reflect.deleteProperty(window, "location");
    window.location = { href: "", search: "", pathname: "/login" } as never;
  });

  afterAll(() => {
    window.location = originalLocation as never;
  });

  async function enviar(senha = "senha-correta") {
    const user = userEvent.setup();
    renderPagina(<PaginaLogin />, { rota: "/login", caminho: "/login" });
    await user.type(screen.getByLabelText("E-mail"), "fulano@teste.com");
    await user.type(screen.getByLabelText("Senha"), senha);
    await user.click(screen.getByRole("button", { name: /entrar/i }));
  }

  it("define o título da aba", () => {
    renderPagina(<PaginaLogin />, { rota: "/login", caminho: "/login" });
    expect(useTituloPagina).toHaveBeenCalledWith("Entrar");
  });

  it("mostra erro de credencial e não navega quando a API responde 401 (FA-01)", async () => {
    mockedEntrar.mockResolvedValue(false);
    await enviar("senha-errada");
    expect(await screen.findByRole("alert")).toHaveTextContent(/e-mail ou senha inválidos/i);
    expect(window.location.href).toBe("");
  });

  it("mostra erro genérico em falha de rede", async () => {
    mockedEntrar.mockRejectedValue(new Error("Falha ao entrar (HTTP 500)."));
    await enviar();
    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível entrar/i);
  });

  it("entra e vai para a home", async () => {
    mockedEntrar.mockResolvedValue(true);
    await enviar();
    expect(mockedEntrar).toHaveBeenCalledWith("fulano@teste.com", "senha-correta");
    expect(window.location.href).toBe("/");
  });

  it("volta ao callbackUrl interno depois de entrar", async () => {
    window.location.search = "?callbackUrl=%2Fcasos%2F123";
    mockedEntrar.mockResolvedValue(true);
    await enviar();
    expect(window.location.href).toBe("/casos/123");
  });
});

describe("destinoSeguro", () => {
  it.each([
    [null, "/"],
    ["https://evil.example.com", "/"],
    ["//evil.example.com", "/"],
    ["/clientes", "/clientes"],
  ])("%s → %s", (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado);
  });
});
```

`apps/web/src/paginas/cadastro.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { entrar } from "@/lib/sessao";
import { renderPagina, respostaJson } from "@/lib/test-paginas";
import { PaginaCadastro } from "./cadastro";

jest.mock("@/lib/sessao", () => ({ entrar: jest.fn() }));
jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));

const mockedEntrar = entrar as jest.Mock;

async function preencher(senha = "senha-forte-123", confirmar = senha) {
  const user = userEvent.setup();
  renderPagina(<PaginaCadastro />, { rota: "/cadastro", caminho: "/cadastro" });
  await user.type(screen.getByLabelText("Seu nome"), "Fulano de Tal");
  await user.type(screen.getByLabelText("E-mail"), "fulano@teste.com");
  await user.type(screen.getByLabelText("Senha"), senha);
  await user.type(screen.getByLabelText("Confirmar senha"), confirmar);
  await user.click(screen.getByRole("button", { name: /cadastrar/i }));
}

describe("PaginaCadastro", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    Reflect.deleteProperty(window, "location");
    window.location = { href: "" } as never;
  });

  afterAll(() => {
    window.location = originalLocation as never;
  });

  it("não envia quando a confirmação de senha não bate", async () => {
    await preencher("senha-forte-123", "outra-senha-999");
    expect(await screen.findByRole("alert")).toHaveTextContent(/as senhas não coincidem/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("mostra o erro da API de cadastro", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson({ error: "E-mail já cadastrado." }, 409));
    await preencher();
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail já cadastrado.");
    expect(mockedEntrar).not.toHaveBeenCalled();
  });

  it("cadastra, entra e segue para o onboarding quando não há escritório", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson({ temEscritorio: false }, 201));
    mockedEntrar.mockResolvedValue(true);
    await preencher();
    expect(mockedEntrar).toHaveBeenCalledWith("fulano@teste.com", "senha-forte-123");
    expect(window.location.href).toBe("/onboarding");
  });

  it("vai direto para a home quando o cadastro aceitou um convite", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson({ temEscritorio: true }, 201));
    mockedEntrar.mockResolvedValue(true);
    await preencher();
    expect(window.location.href).toBe("/");
  });

  it("manda ao login se o login automático falhar", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson({ temEscritorio: false }, 201));
    mockedEntrar.mockRejectedValue(new Error("falhou"));
    await preencher();
    expect(window.location.href).toBe("/login");
  });
});
```

`apps/web/src/paginas/onboarding.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina } from "@/lib/test-paginas";
import { PaginaOnboarding } from "./onboarding";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/shell/novo-escritorio-form", () => ({
  NovoEscritorioForm: () => <form aria-label="novo escritório" />,
}));

it("mostra o formulário de criação do primeiro escritório", () => {
  renderPagina(<PaginaOnboarding />, { rota: "/onboarding", caminho: "/onboarding" });
  expect(useTituloPagina).toHaveBeenCalledWith("Criar escritório");
  expect(screen.getByRole("heading", { name: /conte-nos sobre o seu escritório/i })).toBeInTheDocument();
  expect(screen.getByRole("form", { name: "novo escritório" })).toBeInTheDocument();
});
```

Acrescentar ao teste existente da `RotaProtegida` (arquivo da 4a, ao lado do componente), no mesmo estilo dos casos que já existem lá:

```tsx
it("com exigirEscritorio={false}, deixa passar sessão sem escritório (onboarding)", () => {
  mockedUseSessao.mockReturnValue({
    usuario: { id: "u1", nome: "N", email: "n@t.com" },
    escritorioId: null,
    role: null,
  });
  render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route element={<RotaProtegida exigirEscritorio={false} />}>
          <Route path="/onboarding" element={<p>onboarding</p>} />
        </Route>
        <Route path="/login" element={<p>login</p>} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText("onboarding")).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run web:test -- paginas/login paginas/cadastro paginas/onboarding rota-protegida`
Expected: FAIL. As páginas não existem, e o caso novo da `RotaProtegida` falha se ela ainda manda para `/onboarding` sem olhar a prop.

- [ ] **Step 3: Implementar**

`apps/web/src/paginas/layouts/layout-auth.tsx`:

```tsx
import { Link, Outlet } from "react-router";
import { Scale } from "lucide-react";
import { AuthBrandingPanel } from "@/components/auth/auth-branding-panel";

export function LayoutAuth() {
  return (
    <div className="grid min-h-screen gap-4 bg-background p-4 lg:grid-cols-2 lg:p-6">
      <div className="flex flex-col justify-center rounded-[2rem] bg-linear-to-br from-gold-soft from-35% via-gold-soft via-55% to-gold px-6 py-10 sm:px-12 sm:py-12">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8">
          <Link to="/" className="mx-auto flex items-center gap-2.5 font-heading text-lg font-semibold">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="size-5" />
            </span>
            CRM Advocacia
          </Link>

          <Outlet />
        </div>
      </div>

      <AuthBrandingPanel />
    </div>
  );
}
```

`apps/web/src/paginas/login.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { LogIn, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { InputGroupPasswordInput } from "@/components/ui/input-group-password";
import { entrar } from "@/lib/sessao";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

// Só aceita path relativo interno ("/rota"), nunca URL absoluta/protocol-relative
// ("//host" ou "https://host"); evita open redirect via callbackUrl manipulado.
export function destinoSeguro(callbackUrl: string | null): string {
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/";
  }
  return callbackUrl;
}

export function PaginaLogin() {
  useTituloPagina("Entrar");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const formData = new FormData(event.currentTarget);

    try {
      const ok = await entrar(String(formData.get("email") ?? ""), String(formData.get("senha") ?? ""));
      if (!ok) {
        setErro("E-mail ou senha inválidos.");
        return;
      }
      // Navegação dura de propósito: o reload descarta qualquer cache em memória de uma
      // sessão anterior e a SPA relê /api/auth/sessao do zero.
      const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
      window.location.href = destinoSeguro(callbackUrl);
    } catch {
      setErro("Não foi possível entrar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-medium tracking-tight">Bem-vindo(a) de volta</h1>
        <p className="text-sm text-muted-foreground">Acesse o CRM com seu e-mail e senha.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <InputGroup className="h-14 shrink-0 rounded-full border-transparent bg-background shadow-sm">
            <InputGroupAddon className="mr-2 self-stretch border-r border-border pr-3 pl-5">
              <Mail />
            </InputGroupAddon>
            <InputGroupInput id="email" name="email" type="email" autoComplete="email" required />
          </InputGroup>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="senha">Senha</Label>
          <InputGroup className="h-14 shrink-0 rounded-full border-transparent bg-background shadow-sm">
            <InputGroupAddon className="mr-2 self-stretch border-r border-border pr-3 pl-5">
              <Lock />
            </InputGroupAddon>
            <InputGroupPasswordInput id="senha" name="senha" autoComplete="current-password" required />
          </InputGroup>
        </div>
        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        <Button type="submit" disabled={carregando} className="mt-1 h-14 shrink-0 rounded-full text-base">
          <LogIn />
          {carregando ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="font-medium text-foreground underline-offset-4 hover:underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
```

`apps/web/src/paginas/cadastro.tsx` parte do markup de `src/app/(auth)/cadastro/page.tsx` sem mudanças, com estas trocas:
- exportar como `export function PaginaCadastro()`;
- chamar `useTituloPagina("Criar conta")` na primeira linha;
- trocar `import Link from "next/link"` por `import { Link } from "react-router"`, e `href="/login"` por `to="/login"`;
- remover o `import { signIn } from "next-auth/react"` e importar `entrar` de `@/lib/sessao` e `useTituloPagina` de `@/hooks/use-titulo-pagina`;
- substituir o trecho do login automático, do `const loginResult = await signIn(...)` até o `window.location.href = data?.temEscritorio ? ...` final, por:

```tsx
      // Conta criada, mas o login automático falhou: o usuário entra pela tela de login.
      const entrou = await entrar(String(payload.email ?? ""), String(payload.senha ?? "")).catch(() => false);
      if (!entrou) {
        window.location.href = "/login";
        return;
      }

      // Navegação dura: a SPA relê a sessão recém-criada do zero.
      window.location.href = data?.temEscritorio ? "/" : "/onboarding";
```

Também remover os comentários `eslint-disable-next-line @next/next/...`, porque essa regra deixa de existir.

`apps/web/src/paginas/onboarding.tsx`:

```tsx
import { Scale } from "lucide-react";
import { NovoEscritorioForm } from "@/components/shell/novo-escritorio-form";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

// Alcançável pelo cadastro sem convite pendente. Fica sob
// <RotaProtegida exigirEscritorio={false}>: exige sessão, mas não escritório. Criar
// um escritório adicional pelo shell usa o dialog do switcher, não esta página.
export function PaginaOnboarding() {
  useTituloPagina("Criar escritório");

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-brand">
            <Scale className="size-4" />
            CRM Advocacia
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Conte-nos sobre o seu escritório
          </h1>
          <p className="max-w-md text-balance text-muted-foreground">
            Essas informações ajudam colegas e clientes a identificar o seu escritório dentro do CRM.
          </p>
        </div>

        <NovoEscritorioForm />
      </div>
    </div>
  );
}
```

Na `RotaProtegida`, se ela ainda não tiver a prop:
- declarar `exigirEscritorio = true` nas props (`{ exigirEscritorio?: boolean }`);
- trocar a condição do redirect para onboarding por `if (exigirEscritorio && !sessao.escritorioId) return <Navigate to="/onboarding" replace />;`.

Em `apps/web/src/rotas.tsx`:
- as rotas `/login` e `/cadastro` passam a ser filhas de `{ element: <LayoutAuth /> }`, com `element: <PaginaLogin />` e `<PaginaCadastro />`;
- `/onboarding` fica sob `{ element: <RotaProtegida exigirEscritorio={false} /> }` com `element: <PaginaOnboarding />`;
- os imports vêm de `./paginas/layouts/layout-auth`, `./paginas/login`, `./paginas/cadastro` e `./paginas/onboarding`.

- [ ] **Step 4: Remover as páginas Next migradas**

```bash
git rm -r "src/app/(auth)" "src/app/(onboarding)"
```

- [ ] **Step 5: Rodar**

Run: `npm run web:test -- paginas/login paginas/cadastro paginas/onboarding rota-protegida && npx jest --passWithNoTests`
Expected: PASS. O Jest da raiz não encontra mais os testes de `(auth)`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src src/app
git commit -m "feat(web): login, cadastro e onboarding como páginas React"
```

---

### Task 4.25: Shell autenticado — layout do dashboard, troca de escritório e layout de configurações

O layout Next lia a sessão e a lista de escritórios no servidor e mandava `escritorioId` ao `QueryProvider`. Agora a sessão vem de `useSessao()`, a lista vem de `GET /api/escritorios` (Task 4.20) e a data do header é formatada no cliente. O header fica **dentro** do `QueryProvider` por escritório. Assim o `refresh()` do `EscritorioForm` também refaz a lista do switcher (renomear o escritório aparece no header), e a troca de tenant descarta o cache do header junto com o resto.

**Files:**
- Create: `apps/web/src/paginas/layouts/layout-dashboard.tsx`, `apps/web/src/paginas/layouts/layout-configuracoes.tsx`
- Test: `apps/web/src/paginas/layouts/layout-dashboard.test.tsx`, `apps/web/src/paginas/layouts/layout-configuracoes.test.tsx`
- Modify: `apps/web/src/components/shell/escritorio-switcher.tsx`, `apps/web/src/components/shell/escritorio-switcher.test.tsx` (reescrito), `apps/web/src/rotas.tsx`
- Delete: `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/configuracoes/layout.tsx`, `src/app/(dashboard)/configuracoes/page.tsx`

**Interfaces:**
- Consumes: `useSessaoDoEscritorio`, `useMeusEscritorios` (Task 4.23); `trocarEscritorio` de `@/lib/sessao`; `QueryProvider`, `AppSidebar`, `EscritorioSwitcher`, `HeaderData`, `ConfiguracoesNav`.
- Produces: `LayoutDashboard`, `LayoutConfiguracoes` (ambos com `<Outlet />`). `EscritorioSwitcher` troca via `trocarEscritorio(id)` em vez de `fetch` + `router.refresh()`.

- [ ] **Step 1: Testes que falham**

`apps/web/src/paginas/layouts/layout-dashboard.test.tsx`:

```tsx
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { useSessao } from "@/lib/sessao";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { mockApi, SESSAO_OWNER } from "@/lib/test-paginas";
import { LayoutDashboard } from "./layout-dashboard";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));
jest.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
jest.mock("@/components/shell/header-data", () => ({
  HeaderData: ({ data }: { data: string }) => <span data-testid="header-data">{data}</span>,
}));
jest.mock("@/components/shell/app-sidebar", () => ({
  AppSidebar: ({ usuario }: { usuario: { nome: string; email: string } }) => (
    <nav aria-label="sidebar">
      {usuario.nome} {usuario.email}
    </nav>
  ),
}));
jest.mock("@/components/shell/escritorio-switcher", () => ({
  EscritorioSwitcher: ({ escritorios, ativoId }: { escritorios: { id: string; nome: string }[]; ativoId: string }) => (
    <ul aria-label="switcher" data-ativo={ativoId}>
      {escritorios.map((e) => (
        <li key={e.id}>{e.nome}</li>
      ))}
    </ul>
  ),
}));

function renderLayout() {
  const queryClient = criarQueryClientDeTeste();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/clientes"]}>
        <Routes>
          <Route element={<LayoutDashboard />}>
            <Route path="/clientes" element={<p>conteúdo da página</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (useSessao as jest.Mock).mockReturnValue(SESSAO_OWNER);
});

describe("LayoutDashboard", () => {
  it("monta o shell com a página filha, o usuário da sessão e a data de hoje", () => {
    mockApi({ "/api/escritorios": { escritorios: [] } });
    renderLayout();

    expect(screen.getByText("conteúdo da página")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "sidebar" })).toHaveTextContent(
      "Dona Owner owner@teste.com"
    );
    expect(screen.getByTestId("header-data")).not.toBeEmptyDOMElement();
  });

  it("alimenta o switcher com GET /api/escritorios e o escritório ativo da sessão", async () => {
    mockApi({
      "/api/escritorios": {
        escritorios: [
          { id: "esc-1", nome: "Escritório Um", role: "owner" },
          { id: "esc-2", nome: "Escritório Dois", role: "padrao" },
        ],
      },
    });
    renderLayout();

    expect(await screen.findByText("Escritório Dois")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "switcher" })).toHaveAttribute("data-ativo", "esc-1");
  });
});
```

`apps/web/src/paginas/layouts/layout-configuracoes.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { LayoutConfiguracoes } from "./layout-configuracoes";

jest.mock("@/components/configuracoes/configuracoes-nav", () => ({
  ConfiguracoesNav: () => <nav aria-label="configurações" />,
}));

it("mostra a navegação de configurações ao lado da subpágina", () => {
  render(
    <MemoryRouter initialEntries={["/configuracoes/status"]}>
      <Routes>
        <Route path="/configuracoes" element={<LayoutConfiguracoes />}>
          <Route path="status" element={<p>status</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByRole("navigation", { name: "configurações" })).toBeInTheDocument();
  expect(screen.getByText("status")).toBeInTheDocument();
});
```

`apps/web/src/components/shell/escritorio-switcher.test.tsx` (substitui o arquivo inteiro):

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { trocarEscritorio } from "@/lib/sessao";
import { ApiError } from "@/lib/api-client";
import { EscritorioSwitcher } from "./escritorio-switcher";

jest.mock("@/lib/sessao", () => ({ trocarEscritorio: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/components/shell/novo-escritorio-form", () => ({
  NovoEscritorioForm: () => <form aria-label="novo escritório" />,
}));

const mockedTrocar = trocarEscritorio as jest.Mock;
const escritorios = [
  { id: "esc-1", nome: "Escritório Um" },
  { id: "esc-2", nome: "Escritório Dois" },
];

beforeEach(() => jest.clearAllMocks());

describe("EscritorioSwitcher", () => {
  it("mostra o escritório ativo no gatilho", () => {
    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);
    expect(screen.getByRole("button", { name: /selecionar escritório/i })).toHaveTextContent("Escritório Um");
  });

  it("troca a sessão para o escritório escolhido", async () => {
    mockedTrocar.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);

    await user.click(screen.getByRole("button", { name: /selecionar escritório/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Escritório Dois" }));

    await waitFor(() => expect(mockedTrocar).toHaveBeenCalledWith("esc-2"));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("não chama a API ao escolher o escritório já ativo", async () => {
    const user = userEvent.setup();
    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);

    await user.click(screen.getByRole("button", { name: /selecionar escritório/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Escritório Um" }));

    expect(mockedTrocar).not.toHaveBeenCalled();
  });

  it("mostra o erro da API quando a troca é recusada", async () => {
    mockedTrocar.mockRejectedValue(new ApiError("Você não é membro deste escritório.", 403));
    const user = userEvent.setup();
    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);

    await user.click(screen.getByRole("button", { name: /selecionar escritório/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Escritório Dois" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Você não é membro deste escritório.")
    );
  });

  it("abre a dialog de criar escritório em vez de navegar", async () => {
    const user = userEvent.setup();
    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);

    await user.click(screen.getByRole("button", { name: /selecionar escritório/i }));
    await user.click(await screen.findByRole("menuitem", { name: /criar escritório/i }));

    expect(await screen.findByRole("form", { name: "novo escritório" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run web:test -- layout-dashboard layout-configuracoes escritorio-switcher`
Expected: FAIL. Os layouts não existem, e o switcher ainda faz `fetch` e não chama `trocarEscritorio`.

- [ ] **Step 3: Implementar**

`apps/web/src/paginas/layouts/layout-dashboard.tsx`:

```tsx
import { Link, Outlet } from "react-router";
import { Scale } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { EscritorioSwitcher } from "@/components/shell/escritorio-switcher";
import { HeaderData } from "@/components/shell/header-data";
import { formatarDataExtensa } from "@/lib/utils/data";
import { useMeusEscritorios } from "@/hooks/use-escritorios";
import { useSessaoDoEscritorio, type SessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";

// Shell das telas autenticadas. Fica sob <RotaProtegida>, que já redirecionou quem não
// tem sessão (/login) ou escritório ativo (/onboarding).
//
// O QueryProvider nasce por escritório: trocar de tenant (trocarEscritorio → novo
// escritorioId na sessão) cria um client novo e remonta a árvore, descartando o cache
// do escritório anterior. O header fica dentro dele de propósito, porque a lista do
// switcher também é dado da sessão atual.
export function LayoutDashboard() {
  const sessao = useSessaoDoEscritorio();

  return (
    <QueryProvider escritorioId={sessao.escritorioId}>
      <Shell sessao={sessao} />
    </QueryProvider>
  );
}

function Shell({ sessao }: { sessao: SessaoDoEscritorio }) {
  // Enquanto a lista não chega, o switcher mostra o rótulo padrão. Uma falha aqui não
  // derruba a tela: só o switcher fica sem opções.
  const { data: escritorios } = useMeusEscritorios();

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <Link to="/" className="flex items-center" aria-label="CRM Advocacia">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <Scale className="size-4" />
          </span>
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <EscritorioSwitcher
          escritorios={(escritorios ?? []).map(({ id, nome }) => ({ id, nome }))}
          ativoId={sessao.escritorioId}
        />
        <HeaderData data={formatarDataExtensa(new Date())} />
      </header>
      <SidebarProvider className="min-h-0 flex-1">
        <AppSidebar usuario={{ nome: sessao.usuario.nome, email: sessao.usuario.email }} />
        <SidebarInset className="min-h-0 overflow-y-auto">
          <main className="flex flex-1 flex-col gap-4 p-4">
            <Outlet />
          </main>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </div>
  );
}
```

`apps/web/src/paginas/layouts/layout-configuracoes.tsx`:

```tsx
import { Outlet } from "react-router";
import { ConfiguracoesNav } from "@/components/configuracoes/configuracoes-nav";

export function LayoutConfiguracoes() {
  return (
    <div className="grid flex-1 gap-8 md:grid-cols-[220px_1fr]">
      <div className="md:border-r md:border-border md:pr-6">
        <ConfiguracoesNav />
      </div>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
```

Em `apps/web/src/components/shell/escritorio-switcher.tsx`:
- remover o import de `useRouter` (compat) e o `const router = useRouter();`;
- importar `import { trocarEscritorio } from "@/lib/sessao";` e `import { ApiError } from "@/lib/api-client";`;
- substituir o comentário acima do componente e a função `trocarPara` por:

```tsx
// Troca de escritório: trocarEscritorio valida a membership no servidor (RN19) e
// atualiza a sessão. O novo escritorioId remonta o QueryProvider do LayoutDashboard,
// que descarta o cache do tenant anterior.
export function EscritorioSwitcher({ escritorios, ativoId }: EscritorioSwitcherProps) {
  const [trocando, setTrocando] = useState(false);
  const [criarAberto, setCriarAberto] = useState(false);
  const ativo = escritorios.find((escritorio) => escritorio.id === ativoId);

  async function trocarPara(id: string) {
    if (id === ativoId || trocando) return;

    setTrocando(true);
    try {
      await trocarEscritorio(id);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Não foi possível trocar de escritório."
      );
    } finally {
      setTrocando(false);
    }
  }
```

O JSX que vem depois (`return (...)`) não muda.

Em `apps/web/src/rotas.tsx`:
- o elemento de layout das rotas do dashboard (filho de `<RotaProtegida />`) passa a ser `<LayoutDashboard />`;
- `/configuracoes` passa a ser `{ path: "configuracoes", element: <LayoutConfiguracoes />, children: [...] }`, com primeiro filho `{ index: true, element: <Navigate to="/configuracoes/escritorio" replace /> }`;
- `Navigate` vem de `react-router`.

- [ ] **Step 4: Remover os layouts Next migrados**

```bash
git rm "src/app/(dashboard)/layout.tsx" "src/app/(dashboard)/configuracoes/layout.tsx" "src/app/(dashboard)/configuracoes/page.tsx"
```

- [ ] **Step 5: Rodar**

Run: `npm run web:test -- layout-dashboard layout-configuracoes escritorio-switcher && npm run web:typecheck`
Expected: PASS; sem erros de tipo. Se o pacote web não tiver `web:typecheck`, rodar `npx tsc -p apps/web --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src src/app
git commit -m "feat(web): shell do dashboard com troca de escritório pela sessão da API"
```

---

### Task 4.26: Dashboard (`/`)

O Server Component fazia prefetch de três queries (`chaveDashboardResumo`, `chaveCasos(filtrosTabelaDashboard(...))`, `chaveCasosFiltroOpcoes`) e as hidratava, com `Suspense` + `DashboardSkeleton` como fallback de streaming. Na SPA não há servidor para fazer prefetch. O `DashboardView` já busca as três pelos próprios hooks (`useDashboardResumo`, `useCasos`, `useCasoFiltroOpcoes`) e tem estados próprios de loading e erro (`isLoading`/`isError`). Por isso a página só monta a view, e o `DashboardSkeleton` (usado só como fallback do `Suspense`) sai junto.

**Files:**
- Create: `apps/web/src/paginas/inicio.tsx`
- Test: `apps/web/src/paginas/inicio.test.tsx`
- Modify: `apps/web/src/rotas.tsx`
- Delete: `src/app/(dashboard)/page.tsx`, `apps/web/src/components/dashboard/dashboard-skeleton.tsx`, `apps/web/src/components/dashboard/dashboard-skeleton.test.tsx`

**Interfaces:**
- Consumes: `DashboardView({ atorUsuarioId, atorNome, atorRole, dataHoje })`, `useSessaoDoEscritorio`, `formatarDataExtensa`.
- Produces: `PaginaInicio`.

- [ ] **Step 1: Teste que falha**

`apps/web/src/paginas/inicio.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { useSessao } from "@/lib/sessao";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina, SESSAO_PADRAO } from "@/lib/test-paginas";
import { formatarDataExtensa } from "@/lib/utils/data";
import { PaginaInicio } from "./inicio";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));
jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/dashboard/dashboard-view", () => ({
  DashboardView: (props: Record<string, string>) => <pre data-testid="view">{JSON.stringify(props)}</pre>,
}));

it("monta o dashboard com o ator da sessão e a data de hoje", () => {
  (useSessao as jest.Mock).mockReturnValue(SESSAO_PADRAO);
  renderPagina(<PaginaInicio />);

  expect(useTituloPagina).toHaveBeenCalledWith("Dashboard");
  expect(JSON.parse(screen.getByTestId("view").textContent ?? "{}")).toEqual({
    atorUsuarioId: "user-2",
    atorNome: "Colaborador Padrão",
    atorRole: "padrao",
    dataHoje: formatarDataExtensa(new Date()),
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run web:test -- paginas/inicio`
Expected: FAIL. `./inicio` não existe.

- [ ] **Step 3: Implementar**

`apps/web/src/paginas/inicio.tsx`:

```tsx
import { useMemo } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { formatarDataExtensa } from "@/lib/utils/data";

// Sem prefetch: o DashboardView busca resumo, tabela e opções de filtro pelos próprios
// hooks e mostra o próprio esqueleto enquanto carrega.
export function PaginaInicio() {
  useTituloPagina("Dashboard");
  const sessao = useSessaoDoEscritorio();
  const dataHoje = useMemo(() => formatarDataExtensa(new Date()), []);

  return (
    <div className="flex flex-col gap-6">
      <DashboardView
        atorUsuarioId={sessao.usuario.id}
        atorNome={sessao.usuario.nome}
        atorRole={sessao.role}
        dataHoje={dataHoje}
      />
    </div>
  );
}
```

Em `apps/web/src/rotas.tsx`, a rota índice (`index: true`) sob `<LayoutDashboard />` passa a `element: <PaginaInicio />`.

- [ ] **Step 4: Remover o código morto**

```bash
git rm "src/app/(dashboard)/page.tsx" apps/web/src/components/dashboard/dashboard-skeleton.tsx apps/web/src/components/dashboard/dashboard-skeleton.test.tsx
grep -rn "DashboardSkeleton\|query-client-servidor\|HydrationBoundary" apps/web/src
```

Expected do grep: nenhuma ocorrência.

- [ ] **Step 5: Rodar**

Run: `npm run web:test -- paginas/inicio components/dashboard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src src/app
git commit -m "feat(web): dashboard como página React sem prefetch no servidor"
```

---

### Task 4.27: Clientes e Processos

Os nomes do autor dos comentários (`atorNome`) vinham do `auth()` e agora vêm de `useSessao().usuario.nome`.

**Files:**
- Create: `apps/web/src/paginas/clientes.tsx`, `apps/web/src/paginas/casos.tsx`
- Test: `apps/web/src/paginas/clientes.test.tsx`, `apps/web/src/paginas/casos.test.tsx`
- Modify: `apps/web/src/rotas.tsx`
- Delete: `src/app/(dashboard)/clientes/page.tsx`, `src/app/(dashboard)/casos/page.tsx`

**Interfaces:**
- Consumes: `ClientesTable({ atorUsuarioId, atorNome, atorRole })`, `CasosView({ atorUsuarioId, atorNome, atorRole })`.
- Produces: `PaginaClientes`, `PaginaCasos`.

- [ ] **Step 1: Testes que falham**

`apps/web/src/paginas/clientes.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { useSessao } from "@/lib/sessao";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina, SESSAO_OWNER } from "@/lib/test-paginas";
import { PaginaClientes } from "./clientes";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));
jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/clientes/clientes-table", () => ({
  ClientesTable: (props: Record<string, string>) => <pre data-testid="tabela">{JSON.stringify(props)}</pre>,
}));

it("mostra o cabeçalho e passa o ator da sessão à tabela", () => {
  (useSessao as jest.Mock).mockReturnValue(SESSAO_OWNER);
  renderPagina(<PaginaClientes />, { rota: "/clientes", caminho: "/clientes" });

  expect(useTituloPagina).toHaveBeenCalledWith("Clientes");
  expect(screen.getByRole("heading", { name: "Clientes" })).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId("tabela").textContent ?? "{}")).toEqual({
    atorUsuarioId: "user-1",
    atorNome: "Dona Owner",
    atorRole: "owner",
  });
});
```

`apps/web/src/paginas/casos.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { useSessao } from "@/lib/sessao";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina, SESSAO_PADRAO } from "@/lib/test-paginas";
import { PaginaCasos } from "./casos";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));
jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/casos/casos-view", () => ({
  CasosView: (props: Record<string, string>) => <pre data-testid="view">{JSON.stringify(props)}</pre>,
}));

it("mostra o cabeçalho e passa o ator da sessão ao kanban/tabela", () => {
  (useSessao as jest.Mock).mockReturnValue(SESSAO_PADRAO);
  renderPagina(<PaginaCasos />, { rota: "/casos", caminho: "/casos" });

  expect(useTituloPagina).toHaveBeenCalledWith("Processos");
  expect(screen.getByRole("heading", { name: "Processos" })).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId("view").textContent ?? "{}")).toEqual({
    atorUsuarioId: "user-2",
    atorNome: "Colaborador Padrão",
    atorRole: "padrao",
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run web:test -- paginas/clientes paginas/casos`
Expected: FAIL. Os módulos não existem.

- [ ] **Step 3: Implementar**

`apps/web/src/paginas/clientes.tsx`:

```tsx
import { ClientesTable } from "@/components/clientes/clientes-table";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaClientes() {
  useTituloPagina("Clientes");
  const sessao = useSessaoDoEscritorio();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">Cadastro e histórico dos clientes do escritório.</p>
      </div>

      <ClientesTable
        atorUsuarioId={sessao.usuario.id}
        atorNome={sessao.usuario.nome}
        atorRole={sessao.role}
      />
    </div>
  );
}
```

`apps/web/src/paginas/casos.tsx`:

```tsx
import { CasosView } from "@/components/casos/casos-view";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaCasos() {
  useTituloPagina("Processos");
  const sessao = useSessaoDoEscritorio();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Processos</h1>
        <p className="text-sm text-muted-foreground">Kanban e histórico dos processos do escritório.</p>
      </div>

      <CasosView
        atorUsuarioId={sessao.usuario.id}
        atorNome={sessao.usuario.nome}
        atorRole={sessao.role}
      />
    </div>
  );
}
```

Em `apps/web/src/rotas.tsx`, `clientes` → `<PaginaClientes />` e `casos` → `<PaginaCasos />`.

- [ ] **Step 4: Remover e rodar**

```bash
git rm "src/app/(dashboard)/clientes/page.tsx" "src/app/(dashboard)/casos/page.tsx"
npm run web:test -- paginas/clientes paginas/casos
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src src/app
git commit -m "feat(web): páginas de clientes e processos com o ator vindo da sessão"
```

---

### Task 4.28: Agenda

A página só garantia o tenant e envolvia `AgendaView` em `Suspense` (exigência do `useSearchParams` do Next). O `Suspense` sai, porque o `useSearchParams` do React Router não suspende. Os `_components` da agenda (12 arquivos e 5 testes) não foram movidos pela 4a e vêm agora.

**Files:**
- Move: `src/app/(dashboard)/agenda/_components/**` → `apps/web/src/paginas/agenda/_components/**`
- Create: `apps/web/src/paginas/agenda.tsx`
- Test: `apps/web/src/paginas/agenda.test.tsx`
- Modify: `apps/web/src/rotas.tsx`
- Delete: `src/app/(dashboard)/agenda/page.tsx`

**Interfaces:**
- Consumes: `AgendaView` (sem props), que usa `useNavegacaoAgenda`, já no compat pela 4a.
- Produces: `PaginaAgenda`.

- [ ] **Step 1: Mover os componentes e reescrever imports do Next**

```bash
mkdir -p apps/web/src/paginas/agenda
git mv "src/app/(dashboard)/agenda/_components" apps/web/src/paginas/agenda/_components
grep -rlE '"next/(link|navigation|image)"' apps/web/src/paginas/agenda | xargs -r perl -pi -e 's#"next/link"#"\@/compat/next-link"#g; s#"next/navigation"#"\@/compat/next-navigation"#g; s#"next/image"#"\@/compat/next-image"#g'
grep -rn '"next/\|next-auth' apps/web/src/paginas/agenda
```

Expected do último grep: nenhuma ocorrência. Os imports internos são relativos (`./...`) ou `@/...` e continuam válidos.

- [ ] **Step 2: Rodar os testes movidos**

Run: `npm run web:test -- paginas/agenda/_components`
Expected: PASS (`agenda-toolbar`, `evento-form`, `evento-sheet`, `faixa-horas`, `grade-mes`).

- [ ] **Step 3: Teste da página (falha)**

`apps/web/src/paginas/agenda.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina } from "@/lib/test-paginas";
import { PaginaAgenda } from "./agenda";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("./agenda/_components/agenda-view", () => ({ AgendaView: () => <div data-testid="agenda-view" /> }));

it("mostra o cabeçalho da agenda e a visão do calendário", () => {
  renderPagina(<PaginaAgenda />, { rota: "/agenda?visao=semana", caminho: "/agenda" });

  expect(useTituloPagina).toHaveBeenCalledWith("Agenda");
  expect(screen.getByRole("heading", { name: "Agenda" })).toBeInTheDocument();
  expect(screen.getByTestId("agenda-view")).toBeInTheDocument();
});
```

Run: `npm run web:test -- paginas/agenda.test`
Expected: FAIL. `./agenda` não existe.

- [ ] **Step 4: Implementar**

`apps/web/src/paginas/agenda.tsx`:

```tsx
import { AgendaView } from "./agenda/_components/agenda-view";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

// Eventos buscados no cliente: o período depende da visão (mês/semana/dia) que vive na
// URL. O tenant já foi garantido pela RotaProtegida.
export function PaginaAgenda() {
  useTituloPagina("Agenda");

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Agenda</h1>
        <p className="text-sm text-muted-foreground">Audiências, reuniões e compromissos do escritório.</p>
      </div>

      <AgendaView />
    </div>
  );
}
```

Em `apps/web/src/rotas.tsx`, `agenda` → `<PaginaAgenda />`.

- [ ] **Step 5: Remover e rodar**

```bash
git rm "src/app/(dashboard)/agenda/page.tsx"
npm run web:test -- paginas/agenda
```

Expected: PASS (6 suítes).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src src/app
git commit -m "feat(web): agenda como página React com os componentes movidos de src/app"
```

---

### Task 4.29: Campanhas (lista, nova e detalhe)

Três páginas. Na lista e no detalhe, `somenteLeitura = role === "padrao"`. Na nova, o `padrao` é redirecionado para `/campanhas`, porque criar campanha é ação de gestão. O `[id]` vinha de `params` (Promise) e agora vem de `useParams()`.

**Files:**
- Move: `src/app/(dashboard)/campanhas/_components/**` → `apps/web/src/paginas/campanhas/_components/**`; `src/app/(dashboard)/campanhas/nova/_components/**` → `apps/web/src/paginas/campanhas/nova/_components/**`; `src/app/(dashboard)/campanhas/[id]/_components/**` → `apps/web/src/paginas/campanhas/detalhe/_components/**` (mesma profundidade, então o `../../_components/...` do `detalhe-campanha.tsx` continua resolvendo)
- Create: `apps/web/src/paginas/campanhas/lista.tsx`, `apps/web/src/paginas/campanhas/nova.tsx`, `apps/web/src/paginas/campanhas/detalhe.tsx`
- Test: `apps/web/src/paginas/campanhas/paginas-campanhas.test.tsx`
- Modify: `apps/web/src/rotas.tsx`
- Delete: `src/app/(dashboard)/campanhas/page.tsx`, `src/app/(dashboard)/campanhas/nova/page.tsx`, `src/app/(dashboard)/campanhas/[id]/page.tsx`

**Interfaces:**
- Consumes: `ListaCampanhas({ somenteLeitura })`, `FormularioCampanha()`, `DetalheCampanha({ campanhaId, somenteLeitura })`.
- Produces: `PaginaCampanhas`, `PaginaNovaCampanha`, `PaginaCampanha`.

- [ ] **Step 1: Mover os componentes e reescrever imports do Next**

```bash
mkdir -p apps/web/src/paginas/campanhas/nova apps/web/src/paginas/campanhas/detalhe
git mv "src/app/(dashboard)/campanhas/_components" apps/web/src/paginas/campanhas/_components
git mv "src/app/(dashboard)/campanhas/nova/_components" apps/web/src/paginas/campanhas/nova/_components
git mv "src/app/(dashboard)/campanhas/[id]/_components" apps/web/src/paginas/campanhas/detalhe/_components
grep -rlE '"next/(link|navigation|image)"' apps/web/src/paginas/campanhas | xargs -r perl -pi -e 's#"next/link"#"\@/compat/next-link"#g; s#"next/navigation"#"\@/compat/next-navigation"#g; s#"next/image"#"\@/compat/next-image"#g'
grep -rn '"next/\|next-auth' apps/web/src/paginas/campanhas
```

Expected do último grep: nenhuma ocorrência. O `jest.mock("next/navigation", ...)` de `formulario-campanha.test.tsx` vira `jest.mock("@/compat/next-navigation", ...)` pela mesma substituição.

- [ ] **Step 2: Rodar os testes movidos**

Run: `npm run web:test -- paginas/campanhas/`
Expected: PASS em todas as suítes movidas (`controle-campanha`, `lista-campanhas`, `detalhe-campanha`, `status-badge-mensagem`, `botao-criar-campanha`, `config-variavel`, `dialog-mensagem`, `formulario-campanha`, `preview-whatsapp`, `secao-contatos`, `secao-mensagem`, `seletor-instancia`, `tarefas-campanha`).

- [ ] **Step 3: Teste das páginas (falha)**

`apps/web/src/paginas/campanhas/paginas-campanhas.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { useSessao } from "@/lib/sessao";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina, SESSAO_OWNER, SESSAO_PADRAO } from "@/lib/test-paginas";
import { PaginaCampanhas } from "./lista";
import { PaginaNovaCampanha } from "./nova";
import { PaginaCampanha } from "./detalhe";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));
jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("./_components/lista-campanhas", () => ({
  ListaCampanhas: ({ somenteLeitura }: { somenteLeitura: boolean }) => (
    <div data-testid="lista" data-somente-leitura={String(somenteLeitura)} />
  ),
}));
jest.mock("./nova/_components/formulario-campanha", () => ({
  FormularioCampanha: () => <div data-testid="formulario" />,
}));
jest.mock("./detalhe/_components/detalhe-campanha", () => ({
  DetalheCampanha: ({ campanhaId, somenteLeitura }: { campanhaId: string; somenteLeitura: boolean }) => (
    <div data-testid="detalhe" data-id={campanhaId} data-somente-leitura={String(somenteLeitura)} />
  ),
}));

const mockedUseSessao = useSessao as jest.Mock;

describe("PaginaCampanhas", () => {
  it.each([
    [SESSAO_OWNER, "false"],
    [SESSAO_PADRAO, "true"],
  ])("lista em modo somente leitura conforme o papel (%#)", (sessao, esperado) => {
    mockedUseSessao.mockReturnValue(sessao);
    renderPagina(<PaginaCampanhas />, { rota: "/campanhas", caminho: "/campanhas" });
    expect(useTituloPagina).toHaveBeenCalledWith("Campanhas");
    expect(screen.getByTestId("lista")).toHaveAttribute("data-somente-leitura", esperado);
  });
});

describe("PaginaNovaCampanha", () => {
  it("mostra o formulário para owner/admin", () => {
    mockedUseSessao.mockReturnValue(SESSAO_OWNER);
    renderPagina(<PaginaNovaCampanha />, { rota: "/campanhas/nova", caminho: "/campanhas/nova" });
    expect(useTituloPagina).toHaveBeenCalledWith("Nova campanha");
    expect(screen.getByTestId("formulario")).toBeInTheDocument();
  });

  it("devolve o papel padrao para a lista sem montar o formulário", () => {
    mockedUseSessao.mockReturnValue(SESSAO_PADRAO);
    renderPagina(<PaginaNovaCampanha />, {
      rota: "/campanhas/nova",
      caminho: "/campanhas/nova",
      outras: [["/campanhas", <p key="l">lista de campanhas</p>]],
    });
    expect(screen.getByText("lista de campanhas")).toBeInTheDocument();
    expect(screen.queryByTestId("formulario")).not.toBeInTheDocument();
  });
});

describe("PaginaCampanha", () => {
  it("lê o id da URL e aplica somente leitura ao papel padrao", () => {
    mockedUseSessao.mockReturnValue(SESSAO_PADRAO);
    renderPagina(<PaginaCampanha />, { rota: "/campanhas/camp-42", caminho: "/campanhas/:id" });
    expect(useTituloPagina).toHaveBeenCalledWith("Campanha");
    expect(screen.getByTestId("detalhe")).toHaveAttribute("data-id", "camp-42");
    expect(screen.getByTestId("detalhe")).toHaveAttribute("data-somente-leitura", "true");
  });
});
```

Run: `npm run web:test -- paginas-campanhas`
Expected: FAIL. `./lista`, `./nova` e `./detalhe` não existem.

- [ ] **Step 4: Implementar**

`apps/web/src/paginas/campanhas/lista.tsx`:

```tsx
import { PageContainer } from "@/components/shared/page-container";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { ListaCampanhas } from "./_components/lista-campanhas";

export function PaginaCampanhas() {
  useTituloPagina("Campanhas");
  const { role } = useSessaoDoEscritorio();

  return (
    <PageContainer className="max-w-6xl">
      <ListaCampanhas somenteLeitura={role === "padrao"} />
    </PageContainer>
  );
}
```

`apps/web/src/paginas/campanhas/nova.tsx`:

```tsx
import { Navigate } from "react-router";
import { PageContainer } from "@/components/shared/page-container";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { FormularioCampanha } from "./nova/_components/formulario-campanha";

export function PaginaNovaCampanha() {
  useTituloPagina("Nova campanha");
  const { role } = useSessaoDoEscritorio();

  // Criar campanha é ação de gestão (a API recusaria de qualquer forma). Barrar aqui
  // evita mostrar um formulário inteiro que vai falhar no último passo.
  if (role === "padrao") return <Navigate to="/campanhas" replace />;

  return (
    <PageContainer className="max-w-6xl">
      <FormularioCampanha />
    </PageContainer>
  );
}
```

`apps/web/src/paginas/campanhas/detalhe.tsx`:

```tsx
import { useParams } from "react-router";
import { PageContainer } from "@/components/shared/page-container";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { DetalheCampanha } from "./detalhe/_components/detalhe-campanha";

export function PaginaCampanha() {
  useTituloPagina("Campanha");
  const { role } = useSessaoDoEscritorio();
  // A rota é "campanhas/:id", então o parâmetro sempre existe quando a página monta.
  const { id = "" } = useParams<{ id: string }>();

  return (
    <PageContainer className="max-w-5xl">
      {/* Pausar/retomar é ação de gestão (a API recusaria de qualquer forma). */}
      <DetalheCampanha campanhaId={id} somenteLeitura={role === "padrao"} />
    </PageContainer>
  );
}
```

Em `apps/web/src/rotas.tsx`:
- `campanhas` → `<PaginaCampanhas />`;
- `campanhas/nova` → `<PaginaNovaCampanha />`, **declarada antes** de `campanhas/:id` (o React Router ranqueia segmentos estáticos acima dos dinâmicos, mas a ordem explícita documenta a intenção);
- `campanhas/:id` → `<PaginaCampanha />`.

- [ ] **Step 5: Remover e rodar**

```bash
git rm "src/app/(dashboard)/campanhas/page.tsx" "src/app/(dashboard)/campanhas/nova/page.tsx" "src/app/(dashboard)/campanhas/[id]/page.tsx"
npm run web:test -- paginas/campanhas
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src src/app
git commit -m "feat(web): páginas de campanhas com papel e id vindos da sessão e da URL"
```

---

### Task 4.30: Instâncias de WhatsApp

**Files:**
- Move: `src/app/(dashboard)/instancias/_components/**` → `apps/web/src/paginas/instancias/_components/**`
- Create: `apps/web/src/paginas/instancias.tsx`
- Test: `apps/web/src/paginas/instancias.test.tsx`
- Modify: `apps/web/src/rotas.tsx`
- Delete: `src/app/(dashboard)/instancias/page.tsx`

**Interfaces:**
- Consumes: `ListaInstancias({ somenteLeitura })`.
- Produces: `PaginaInstancias`.

- [ ] **Step 1: Mover os componentes**

```bash
mkdir -p apps/web/src/paginas/instancias
git mv "src/app/(dashboard)/instancias/_components" apps/web/src/paginas/instancias/_components
grep -rlE '"next/(link|navigation|image)"' apps/web/src/paginas/instancias | xargs -r perl -pi -e 's#"next/link"#"\@/compat/next-link"#g; s#"next/navigation"#"\@/compat/next-navigation"#g; s#"next/image"#"\@/compat/next-image"#g'
npm run web:test -- paginas/instancias/_components
```

Expected: PASS (`lista-instancias`, `nova-instancia-dialog`, `qrcode-dialog`, `status-badge-instancia`).

- [ ] **Step 2: Teste da página (falha)**

`apps/web/src/paginas/instancias.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { useSessao } from "@/lib/sessao";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina, SESSAO_OWNER, SESSAO_PADRAO } from "@/lib/test-paginas";
import { PaginaInstancias } from "./instancias";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));
jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("./instancias/_components/lista-instancias", () => ({
  ListaInstancias: ({ somenteLeitura }: { somenteLeitura: boolean }) => (
    <div data-testid="lista" data-somente-leitura={String(somenteLeitura)} />
  ),
}));

it.each([
  [SESSAO_OWNER, "false"],
  [SESSAO_PADRAO, "true"],
])("lista instâncias em somente leitura conforme o papel (%#)", (sessao, esperado) => {
  (useSessao as jest.Mock).mockReturnValue(sessao);
  renderPagina(<PaginaInstancias />, { rota: "/instancias", caminho: "/instancias" });
  expect(useTituloPagina).toHaveBeenCalledWith("Instâncias");
  expect(screen.getByTestId("lista")).toHaveAttribute("data-somente-leitura", esperado);
});
```

Run: `npm run web:test -- paginas/instancias.test`
Expected: FAIL. `./instancias` não existe.

- [ ] **Step 3: Implementar**

`apps/web/src/paginas/instancias.tsx`:

```tsx
import { PageContainer } from "@/components/shared/page-container";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { ListaInstancias } from "./instancias/_components/lista-instancias";

export function PaginaInstancias() {
  useTituloPagina("Instâncias");
  const { role } = useSessaoDoEscritorio();

  return (
    <PageContainer className="max-w-5xl">
      <ListaInstancias somenteLeitura={role === "padrao"} />
    </PageContainer>
  );
}
```

Em `apps/web/src/rotas.tsx`, `instancias` → `<PaginaInstancias />`.

- [ ] **Step 4: Remover, rodar e commitar**

```bash
git rm "src/app/(dashboard)/instancias/page.tsx"
npm run web:test -- paginas/instancias
git add apps/web/src src/app
git commit -m "feat(web): página de instâncias de WhatsApp em React"
```

Expected do teste: PASS.

---

### Task 4.31: Perfil

A página lia o perfil do banco porque o JWT não era renovado pelo `PATCH`. Isso continua: os dados vêm de `GET /api/perfil` (Task 4.21), e não da sessão. Depois de salvar, `PerfilForm` e `AvatarUpload` chamam `router.refresh()`, que agora invalida `["perfil"]` (Task 4.23).

**Files:**
- Create: `apps/web/src/paginas/perfil.tsx`
- Test: `apps/web/src/paginas/perfil.test.tsx` (sucessor de `src/app/(dashboard)/perfil/page.test.tsx`)
- Modify: `apps/web/src/rotas.tsx`
- Delete: `src/app/(dashboard)/perfil/page.tsx`, `src/app/(dashboard)/perfil/page.test.tsx`

**Interfaces:**
- Consumes: `usePerfil()`; `PerfilForm({ usuario: { nome, email } })`, `AvatarUpload({ usuario: { nome }, temAvatarInicial })`, `SenhaForm()`.
- Produces: `PaginaPerfil`.

- [ ] **Step 1: Teste que falha**

`apps/web/src/paginas/perfil.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { mockApi, renderPagina } from "@/lib/test-paginas";
import { PaginaPerfil } from "./perfil";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/perfil/perfil-form", () => ({
  PerfilForm: ({ usuario }: { usuario: { nome: string; email: string } }) => (
    <div>
      <span>{usuario.nome}</span>
      <span>{usuario.email}</span>
    </div>
  ),
}));
jest.mock("@/components/perfil/senha-form", () => ({ SenhaForm: () => <div /> }));
jest.mock("@/components/perfil/avatar-upload", () => ({
  AvatarUpload: ({ temAvatarInicial }: { temAvatarInicial: boolean }) => (
    <div data-testid="avatar-upload" data-tem-avatar={String(temAvatarInicial)} />
  ),
}));

function renderPerfil() {
  return renderPagina(<PaginaPerfil />, { rota: "/perfil", caminho: "/perfil" });
}

describe("PaginaPerfil", () => {
  it("mostra os dados vindos de GET /api/perfil, não os da sessão", async () => {
    mockApi({ "/api/perfil": { usuario: { id: "u1", nome: "Nome Novo", email: "novo@teste.com", temAvatar: true } } });
    renderPerfil();

    expect(useTituloPagina).toHaveBeenCalledWith("Perfil");
    expect(await screen.findByText("Nome Novo")).toBeInTheDocument();
    expect(screen.getByText("novo@teste.com")).toBeInTheDocument();
    expect(screen.getByTestId("avatar-upload")).toHaveAttribute("data-tem-avatar", "true");
  });

  it("informa que o usuário não tem avatar", async () => {
    mockApi({ "/api/perfil": { usuario: { id: "u1", nome: "N", email: "n@t.com", temAvatar: false } } });
    renderPerfil();
    expect(await screen.findByTestId("avatar-upload")).toHaveAttribute("data-tem-avatar", "false");
  });

  it("mostra estado de carregamento antes dos dados", () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    renderPerfil();
    expect(screen.getByRole("status", { name: /carregando perfil/i })).toBeInTheDocument();
  });

  it("mostra erro sem detalhe técnico quando a API falha", async () => {
    mockApi({ "/api/perfil": new Error("boom interno") });
    renderPerfil();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar seu perfil.");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run web:test -- paginas/perfil`
Expected: FAIL. `./perfil` não existe.

- [ ] **Step 3: Implementar**

`apps/web/src/paginas/perfil.tsx`:

```tsx
import { PerfilForm } from "@/components/perfil/perfil-form";
import { SenhaForm } from "@/components/perfil/senha-form";
import { AvatarUpload } from "@/components/perfil/avatar-upload";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/shared/page-container";
import { usePerfil } from "@/hooks/use-perfil";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

// Os dados vêm do banco (GET /api/perfil), não da sessão: a sessão guarda o nome do
// login e o PATCH não a renova. Depois de salvar, PerfilForm/AvatarUpload chamam
// refresh(), que invalida esta query.
export function PaginaPerfil() {
  useTituloPagina("Perfil");
  const { data: perfil, isLoading, isError } = usePerfil();

  return (
    <PageContainer>
      <div>
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        <p className="text-muted-foreground">Gerencie seus dados pessoais e sua senha.</p>
      </div>

      {isLoading ? (
        <div role="status" aria-label="Carregando perfil" className="flex flex-col gap-4">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="h-9 w-full max-w-md" />
        </div>
      ) : isError || !perfil ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar seu perfil.
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">Foto</h2>
            <AvatarUpload usuario={{ nome: perfil.nome }} temAvatarInicial={perfil.temAvatar} />
          </section>

          <Separator />

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">Dados pessoais</h2>
            <PerfilForm usuario={{ nome: perfil.nome, email: perfil.email }} />
          </section>

          <Separator />

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">Senha</h2>
            <SenhaForm />
          </section>
        </>
      )}
    </PageContainer>
  );
}
```

Em `apps/web/src/rotas.tsx`, `perfil` → `<PaginaPerfil />`.

- [ ] **Step 4: Remover, rodar e commitar**

```bash
git rm "src/app/(dashboard)/perfil/page.tsx" "src/app/(dashboard)/perfil/page.test.tsx"
npm run web:test -- paginas/perfil components/perfil
git add apps/web/src src/app
git commit -m "feat(web): página de perfil lendo GET /api/perfil com loading e erro explícitos"
```

Expected do teste: PASS. `perfil-form` e `avatar-upload` seguem verdes porque continuam chamando `refresh()`.

---

### Task 4.32: Configurações — escritório, membros, status e tipos de processo

**Files:**
- Create: `apps/web/src/paginas/configuracoes/escritorio.tsx`, `apps/web/src/paginas/configuracoes/membros.tsx`, `apps/web/src/paginas/configuracoes/status.tsx`, `apps/web/src/paginas/configuracoes/tipos-processo.tsx`
- Test: `apps/web/src/paginas/configuracoes/escritorio.test.tsx`, `apps/web/src/paginas/configuracoes/membros.test.tsx` (sucessor de `src/app/(dashboard)/configuracoes/membros/page.test.tsx`), `apps/web/src/paginas/configuracoes/status-e-tipos.test.tsx`
- Modify: `apps/web/src/rotas.tsx`
- Delete: `src/app/(dashboard)/configuracoes/{escritorio,membros,status,tipos-processo}/page.tsx`, `src/app/(dashboard)/configuracoes/membros/page.test.tsx`

**Interfaces:**
- Consumes: `useEscritorioAtual`, `useMembros`, `useConvitesPendentes` (Task 4.23); `EscritorioForm({ escritorio, somenteLeitura })`, `MembrosTable({ membros, atorUsuarioId, atorRole })`, `ConvitesTable({ convites })`, `NovoMembroDrawer()`, `StatusTable({ somenteLeitura })`, `TipoProcessoTable({ somenteLeitura })`.
- Produces: `PaginaConfiguracoesEscritorio`, `PaginaConfiguracoesMembros`, `PaginaConfiguracoesStatus`, `PaginaConfiguracoesTiposProcesso`.

- [ ] **Step 1: Testes que falham**

`apps/web/src/paginas/configuracoes/escritorio.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { useSessao } from "@/lib/sessao";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { mockApi, renderPagina, SESSAO_OWNER, SESSAO_PADRAO } from "@/lib/test-paginas";
import { PaginaConfiguracoesEscritorio } from "./escritorio";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));
jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/configuracoes/escritorio-form", () => ({
  EscritorioForm: ({ escritorio, somenteLeitura }: { escritorio: { nome: string }; somenteLeitura: boolean }) => (
    <div data-testid="form" data-somente-leitura={String(somenteLeitura)}>
      {escritorio.nome}
    </div>
  ),
}));

const escritorio = { id: "esc-1", nome: "Escritório Um", oabResponsavel: "SC 71.025", telefoneWhatsapp: null };

function renderEscritorio() {
  return renderPagina(<PaginaConfiguracoesEscritorio />, {
    rota: "/configuracoes/escritorio",
    caminho: "/configuracoes/escritorio",
  });
}

describe("PaginaConfiguracoesEscritorio", () => {
  it("carrega o escritório ativo e libera edição para owner", async () => {
    (useSessao as jest.Mock).mockReturnValue(SESSAO_OWNER);
    mockApi({ "/api/escritorios/atual": { escritorio } });
    renderEscritorio();

    expect(useTituloPagina).toHaveBeenCalledWith("Escritório");
    expect(await screen.findByText("Escritório Um")).toBeInTheDocument();
    expect(screen.getByTestId("form")).toHaveAttribute("data-somente-leitura", "false");
    expect(screen.getByText(/aparecem nas mensagens e documentos/i)).toBeInTheDocument();
  });

  it("deixa o form em somente leitura para o papel padrao", async () => {
    (useSessao as jest.Mock).mockReturnValue(SESSAO_PADRAO);
    mockApi({ "/api/escritorios/atual": { escritorio } });
    renderEscritorio();

    expect(await screen.findByTestId("form")).toHaveAttribute("data-somente-leitura", "true");
    expect(screen.getByText(/somente owners e admins podem editar/i)).toBeInTheDocument();
  });

  it("mostra erro quando o escritório não carrega", async () => {
    (useSessao as jest.Mock).mockReturnValue(SESSAO_OWNER);
    mockApi({ "/api/escritorios/atual": new Error("x") });
    renderEscritorio();

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar o escritório.");
  });
});
```

`apps/web/src/paginas/configuracoes/membros.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { useSessao } from "@/lib/sessao";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { mockApi, renderPagina, SESSAO_OWNER, SESSAO_PADRAO } from "@/lib/test-paginas";
import { PaginaConfiguracoesMembros } from "./membros";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));
jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/configuracoes/membros-table", () => ({
  MembrosTable: ({
    membros,
    atorUsuarioId,
    atorRole,
  }: {
    membros: { usuario: { nome: string; avatarUrl?: string | null } }[];
    atorUsuarioId: string;
    atorRole: string;
  }) => (
    <div data-testid="membros-table" data-ator={atorUsuarioId} data-role={atorRole}>
      {membros.map((m) => (
        <span key={m.usuario.nome} data-avatar-url={m.usuario.avatarUrl ?? ""}>
          {m.usuario.nome}
        </span>
      ))}
    </div>
  ),
}));
jest.mock("@/components/configuracoes/convites-table", () => ({
  ConvitesTable: ({ convites }: { convites: { email: string }[] }) => (
    <ul aria-label="convites">
      {convites.map((c) => (
        <li key={c.email}>{c.email}</li>
      ))}
    </ul>
  ),
}));
jest.mock("@/components/configuracoes/novo-membro-drawer", () => ({
  NovoMembroDrawer: () => <button type="button">Novo membro</button>,
}));

const membro = {
  id: "membro-1",
  role: "owner",
  usuario: {
    id: "user-1",
    nome: "Dona Owner",
    email: "owner@teste.com",
    telefone: null,
    avatarUrl: "https://bucket.s3.amazonaws.com/signed-get",
  },
};

function renderMembros() {
  return renderPagina(<PaginaConfiguracoesMembros />, {
    rota: "/configuracoes/membros",
    caminho: "/configuracoes/membros",
  });
}

beforeEach(() => jest.clearAllMocks());

describe("PaginaConfiguracoesMembros", () => {
  it("passa à tabela os membros com o avatar já assinado pela API", async () => {
    (useSessao as jest.Mock).mockReturnValue(SESSAO_OWNER);
    mockApi({ "/api/membros": { membros: [membro] }, "/api/convites": { convites: [] } });
    renderMembros();

    expect(useTituloPagina).toHaveBeenCalledWith("Membros");
    expect(await screen.findByText("Dona Owner")).toHaveAttribute(
      "data-avatar-url",
      "https://bucket.s3.amazonaws.com/signed-get"
    );
    expect(screen.getByTestId("membros-table")).toHaveAttribute("data-ator", "user-1");
    expect(screen.getByRole("button", { name: "Novo membro" })).toBeInTheDocument();
  });

  it("mostra os convites pendentes para quem gerencia membros", async () => {
    (useSessao as jest.Mock).mockReturnValue(SESSAO_OWNER);
    mockApi({
      "/api/membros": { membros: [membro] },
      "/api/convites": { convites: [{ id: "c1", email: "novo@teste.com", role: "padrao" }] },
    });
    renderMembros();

    expect(await screen.findByRole("list", { name: "convites" })).toHaveTextContent("novo@teste.com");
  });

  it("papel padrao não busca convites nem vê o botão de novo membro", async () => {
    (useSessao as jest.Mock).mockReturnValue(SESSAO_PADRAO);
    mockApi({ "/api/membros": { membros: [membro] } });
    renderMembros();

    expect(await screen.findByText("Dona Owner")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith("/api/convites", expect.anything());
    expect(screen.queryByRole("button", { name: "Novo membro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "convites" })).not.toBeInTheDocument();
  });

  it("mostra erro quando a lista de membros não carrega", async () => {
    (useSessao as jest.Mock).mockReturnValue(SESSAO_OWNER);
    mockApi({ "/api/membros": new Error("x"), "/api/convites": { convites: [] } });
    renderMembros();

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os membros.");
  });
});
```

`apps/web/src/paginas/configuracoes/status-e-tipos.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { useSessao } from "@/lib/sessao";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina, SESSAO_OWNER, SESSAO_PADRAO } from "@/lib/test-paginas";
import { PaginaConfiguracoesStatus } from "./status";
import { PaginaConfiguracoesTiposProcesso } from "./tipos-processo";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));
jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/configuracoes/status-table", () => ({
  StatusTable: ({ somenteLeitura }: { somenteLeitura: boolean }) => (
    <div data-testid="status" data-somente-leitura={String(somenteLeitura)} />
  ),
}));
jest.mock("@/components/configuracoes/tipo-processo-table", () => ({
  TipoProcessoTable: ({ somenteLeitura }: { somenteLeitura: boolean }) => (
    <div data-testid="tipos" data-somente-leitura={String(somenteLeitura)} />
  ),
}));

it.each([
  [SESSAO_OWNER, "false"],
  [SESSAO_PADRAO, "true"],
])("status do kanban em somente leitura conforme o papel (%#)", (sessao, esperado) => {
  (useSessao as jest.Mock).mockReturnValue(sessao);
  renderPagina(<PaginaConfiguracoesStatus />);
  expect(useTituloPagina).toHaveBeenCalledWith("Status do Kanban");
  expect(screen.getByTestId("status")).toHaveAttribute("data-somente-leitura", esperado);
});

it.each([
  [SESSAO_OWNER, "false"],
  [SESSAO_PADRAO, "true"],
])("tipos de processo em somente leitura conforme o papel (%#)", (sessao, esperado) => {
  (useSessao as jest.Mock).mockReturnValue(sessao);
  renderPagina(<PaginaConfiguracoesTiposProcesso />);
  expect(useTituloPagina).toHaveBeenCalledWith("Tipos de processo");
  expect(screen.getByTestId("tipos")).toHaveAttribute("data-somente-leitura", esperado);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run web:test -- paginas/configuracoes`
Expected: FAIL. As quatro páginas não existem.

- [ ] **Step 3: Implementar**

`apps/web/src/paginas/configuracoes/escritorio.tsx`:

```tsx
import { EscritorioForm } from "@/components/configuracoes/escritorio-form";
import { PageContainer } from "@/components/shared/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { useEscritorioAtual } from "@/hooks/use-escritorios";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaConfiguracoesEscritorio() {
  useTituloPagina("Escritório");
  const { role } = useSessaoDoEscritorio();
  const { data: escritorio, isLoading, isError } = useEscritorioAtual();
  const somenteLeitura = role === "padrao";

  return (
    <PageContainer className="gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dados do escritório</h1>
        <p className="text-sm text-muted-foreground">
          {somenteLeitura
            ? "Somente owners e admins podem editar estes dados."
            : "Essas informações aparecem nas mensagens e documentos do escritório."}
        </p>
      </div>
      {isLoading ? (
        <div role="status" aria-label="Carregando escritório" className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : isError || !escritorio ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar o escritório.
        </p>
      ) : (
        // key: depois do refresh() de um save, o form remonta com o valor salvo (o
        // EscritorioForm guarda máscara de OAB/WhatsApp em estado inicializado das props).
        <EscritorioForm
          key={`${escritorio.id}:${escritorio.nome}:${escritorio.oabResponsavel}:${escritorio.telefoneWhatsapp}`}
          escritorio={{
            nome: escritorio.nome,
            oabResponsavel: escritorio.oabResponsavel,
            telefoneWhatsapp: escritorio.telefoneWhatsapp,
          }}
          somenteLeitura={somenteLeitura}
        />
      )}
    </PageContainer>
  );
}
```

`apps/web/src/paginas/configuracoes/membros.tsx`:

```tsx
import { MembrosTable } from "@/components/configuracoes/membros-table";
import { ConvitesTable } from "@/components/configuracoes/convites-table";
import { NovoMembroDrawer } from "@/components/configuracoes/novo-membro-drawer";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useConvitesPendentes, useMembros } from "@/hooks/use-membros";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

// Membros e convites vêm da API (o avatar já chega assinado). Depois de alterar papel,
// remover membro, convidar ou cancelar convite, os componentes chamam refresh(), que
// invalida estas queries.
export function PaginaConfiguracoesMembros() {
  useTituloPagina("Membros");
  const sessao = useSessaoDoEscritorio();
  const podeGerenciarMembros = sessao.role !== "padrao";
  const membros = useMembros();
  const convites = useConvitesPendentes(podeGerenciarMembros);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Membros</h1>
          <p className="text-sm text-muted-foreground">Gerencie os membros e permissões da sua equipe.</p>
        </div>
        {podeGerenciarMembros ? <NovoMembroDrawer /> : null}
      </div>

      <div className="rounded-xl border border-border">
        {membros.isLoading ? (
          <div role="status" aria-label="Carregando membros" className="flex flex-col gap-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : membros.isError || !membros.data ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            Não foi possível carregar os membros.
          </p>
        ) : (
          <MembrosTable membros={membros.data} atorUsuarioId={sessao.usuario.id} atorRole={sessao.role} />
        )}
        {podeGerenciarMembros && convites.data && convites.data.length > 0 ? (
          <>
            <Separator />
            <ConvitesTable convites={convites.data} />
          </>
        ) : null}
      </div>
    </div>
  );
}
```

`apps/web/src/paginas/configuracoes/status.tsx`:

```tsx
import { PageContainer } from "@/components/shared/page-container";
import { StatusTable } from "@/components/configuracoes/status-table";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaConfiguracoesStatus() {
  useTituloPagina("Status do Kanban");
  const { role } = useSessaoDoEscritorio();

  return (
    <PageContainer className="max-w-5xl">
      <StatusTable somenteLeitura={role === "padrao"} />
    </PageContainer>
  );
}
```

`apps/web/src/paginas/configuracoes/tipos-processo.tsx`:

```tsx
import { PageContainer } from "@/components/shared/page-container";
import { TipoProcessoTable } from "@/components/configuracoes/tipo-processo-table";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaConfiguracoesTiposProcesso() {
  useTituloPagina("Tipos de processo");
  const { role } = useSessaoDoEscritorio();

  return (
    <PageContainer className="max-w-5xl">
      <TipoProcessoTable somenteLeitura={role === "padrao"} />
    </PageContainer>
  );
}
```

Em `apps/web/src/rotas.tsx`, os filhos de `configuracoes` ficam:
- `escritorio` → `<PaginaConfiguracoesEscritorio />`;
- `membros` → `<PaginaConfiguracoesMembros />`;
- `status` → `<PaginaConfiguracoesStatus />`;
- `tipos-processo` → `<PaginaConfiguracoesTiposProcesso />`.

- [ ] **Step 4: Remover, rodar e commitar**

```bash
git rm "src/app/(dashboard)/configuracoes/escritorio/page.tsx" "src/app/(dashboard)/configuracoes/membros/page.tsx" "src/app/(dashboard)/configuracoes/membros/page.test.tsx" "src/app/(dashboard)/configuracoes/status/page.tsx" "src/app/(dashboard)/configuracoes/tipos-processo/page.tsx"
npm run web:test -- paginas/configuracoes components/configuracoes
git add apps/web/src src/app
git commit -m "feat(web): páginas de configurações (escritório, membros, status e tipos de processo)"
```

Expected do teste: PASS.

---

### Task 4.33: Árvore final de rotas, 404 e erro de rota

O Next tinha `not-found` e `error` padrão. A SPA precisa dos equivalentes. Esta task também remove o `PaginaEmMigracao`.

**Files:**
- Create: `apps/web/src/paginas/nao-encontrada.tsx`, `apps/web/src/paginas/erro-rota.tsx`
- Test: `apps/web/src/paginas/nao-encontrada.test.tsx`, `apps/web/src/paginas/erro-rota.test.tsx`
- Modify: `apps/web/src/rotas.tsx`
- Delete: o arquivo do `PaginaEmMigracao` (e o teste dele), localizado com `grep -rln "export function PaginaEmMigracao" apps/web/src`

**Interfaces:**
- Produces: `PaginaNaoEncontrada`, `ErroRota`; a árvore `RouteObject[]` final.

- [ ] **Step 1: Testes que falham**

`apps/web/src/paginas/nao-encontrada.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { renderPagina } from "@/lib/test-paginas";
import { PaginaNaoEncontrada } from "./nao-encontrada";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));

it("informa que a página não existe e oferece voltar ao início", () => {
  renderPagina(<PaginaNaoEncontrada />, { rota: "/nao-existe", caminho: "*" });
  expect(screen.getByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /voltar ao início/i })).toHaveAttribute("href", "/");
});
```

`apps/web/src/paginas/erro-rota.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ErroRota } from "./erro-rota";

it("mostra mensagem amigável sem detalhe técnico quando uma página quebra", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  function Quebra(): never {
    throw new Error("TypeError: cannot read properties of undefined (stack interno)");
  }
  const router = createMemoryRouter([{ path: "/", element: <Quebra />, errorElement: <ErroRota /> }]);
  render(<RouterProvider router={router} />);

  expect(screen.getByRole("heading", { name: "Algo deu errado" })).toBeInTheDocument();
  expect(screen.queryByText(/stack interno/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /recarregar/i })).toBeInTheDocument();
});
```

Run: `npm run web:test -- nao-encontrada erro-rota`
Expected: FAIL. Os módulos não existem.

- [ ] **Step 2: Implementar**

`apps/web/src/paginas/nao-encontrada.tsx`:

```tsx
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaNaoEncontrada() {
  useTituloPagina("Página não encontrada");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-muted-foreground">O endereço acessado não existe ou foi movido.</p>
      <Button render={<Link to="/">Voltar ao início</Link>} />
    </div>
  );
}
```

O `Button` do shadcn/base-ui aceita `render` (padrão usado em `nav-usuario.tsx`). Se o teste não achar o link com esse padrão, usar `<Link to="/" className={buttonVariants()}>Voltar ao início</Link>` com `buttonVariants` de `@/components/ui/button`.

`apps/web/src/paginas/erro-rota.tsx`:

```tsx
import { useEffect } from "react";
import { useRouteError } from "react-router";
import { Button } from "@/components/ui/button";

// errorElement da raiz: qualquer erro de render/loader cai aqui. O detalhe vai para o
// console (e para o New Relic do browser, quando configurado), nunca para a tela.
export function ErroRota() {
  const erro = useRouteError();

  useEffect(() => {
    console.error("Erro não tratado na rota", erro);
  }, [erro]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
      <h1 className="text-2xl font-semibold">Algo deu errado</h1>
      <p className="text-muted-foreground">Não foi possível exibir esta página. Tente recarregar.</p>
      <Button type="button" onClick={() => window.location.reload()}>
        Recarregar
      </Button>
    </div>
  );
}
```

`apps/web/src/rotas.tsx`: a constante de rotas exportada passa a ter exatamente esta forma. Preservar o nome da exportação e o `createBrowserRouter` que a 4a já usa:

```tsx
import { Navigate, type RouteObject } from "react-router";
import { RotaProtegida } from "./componentes/rota-protegida"; // caminho real definido pela 4a
import { LayoutAuth } from "./paginas/layouts/layout-auth";
import { LayoutDashboard } from "./paginas/layouts/layout-dashboard";
import { LayoutConfiguracoes } from "./paginas/layouts/layout-configuracoes";
import { PaginaLogin } from "./paginas/login";
import { PaginaCadastro } from "./paginas/cadastro";
import { PaginaOnboarding } from "./paginas/onboarding";
import { PaginaInicio } from "./paginas/inicio";
import { PaginaClientes } from "./paginas/clientes";
import { PaginaCasos } from "./paginas/casos";
import { PaginaAgenda } from "./paginas/agenda";
import { PaginaCampanhas } from "./paginas/campanhas/lista";
import { PaginaNovaCampanha } from "./paginas/campanhas/nova";
import { PaginaCampanha } from "./paginas/campanhas/detalhe";
import { PaginaInstancias } from "./paginas/instancias";
import { PaginaPerfil } from "./paginas/perfil";
import { PaginaConfiguracoesEscritorio } from "./paginas/configuracoes/escritorio";
import { PaginaConfiguracoesMembros } from "./paginas/configuracoes/membros";
import { PaginaConfiguracoesStatus } from "./paginas/configuracoes/status";
import { PaginaConfiguracoesTiposProcesso } from "./paginas/configuracoes/tipos-processo";
import { PaginaNaoEncontrada } from "./paginas/nao-encontrada";
import { ErroRota } from "./paginas/erro-rota";

export const rotas: RouteObject[] = [
  {
    errorElement: <ErroRota />,
    children: [
      {
        element: <LayoutAuth />,
        children: [
          { path: "login", element: <PaginaLogin /> },
          { path: "cadastro", element: <PaginaCadastro /> },
        ],
      },
      {
        element: <RotaProtegida exigirEscritorio={false} />,
        children: [{ path: "onboarding", element: <PaginaOnboarding /> }],
      },
      {
        element: <RotaProtegida />,
        children: [
          {
            element: <LayoutDashboard />,
            children: [
              { index: true, element: <PaginaInicio /> },
              { path: "clientes", element: <PaginaClientes /> },
              { path: "casos", element: <PaginaCasos /> },
              { path: "agenda", element: <PaginaAgenda /> },
              { path: "campanhas", element: <PaginaCampanhas /> },
              { path: "campanhas/nova", element: <PaginaNovaCampanha /> },
              { path: "campanhas/:id", element: <PaginaCampanha /> },
              { path: "instancias", element: <PaginaInstancias /> },
              { path: "perfil", element: <PaginaPerfil /> },
              {
                path: "configuracoes",
                element: <LayoutConfiguracoes />,
                children: [
                  { index: true, element: <Navigate to="/configuracoes/escritorio" replace /> },
                  { path: "escritorio", element: <PaginaConfiguracoesEscritorio /> },
                  { path: "membros", element: <PaginaConfiguracoesMembros /> },
                  { path: "status", element: <PaginaConfiguracoesStatus /> },
                  { path: "tipos-processo", element: <PaginaConfiguracoesTiposProcesso /> },
                ],
              },
              { path: "*", element: <PaginaNaoEncontrada /> },
            ],
          },
        ],
      },
    ],
  },
];
```

O 404 fica dentro do shell autenticado, como no Next, onde só `/login` e `/cadastro` escapavam do middleware. Uma URL inexistente sem sessão vai para `/login` primeiro.

- [ ] **Step 3: Remover o `PaginaEmMigracao`**

```bash
ARQ=$(grep -rln "export function PaginaEmMigracao" apps/web/src)
git rm $ARQ ${ARQ%.tsx}.test.tsx 2>/dev/null || git rm $ARQ
grep -rn "PaginaEmMigracao" apps/web/src
```

Expected do último grep: nenhuma ocorrência.

- [ ] **Step 4: Rodar toda a suíte web**

Run: `npm run web:test && npx tsc -p apps/web --noEmit`
Expected: PASS em todas as suítes; sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): árvore final de rotas com 404 e tela de erro, sem páginas em migração"
```

---

### Task 4.34: E2E dos fluxos críticos na SPA

Os 8 specs existentes (`agenda`, `cadastro-escritorio`, `casos`, `clientes`, `convite-colaborador`, `status`, `tipos-processo`, `troca-escritorio`) já rodam contra o Vite (Playwright reapontado pela 4a). Este spec novo cobre o que **só existe por causa da SPA**:
- o callbackUrl pós-login feito pela `RotaProtegida` (antes no `proxy.ts`);
- o fallback de deep link e reload;
- a atualização de tela via `refresh()` → `invalidateQueries`;
- o redirect de `/configuracoes`;
- o 404;
- o bloqueio da tela de nova campanha para o papel `padrao` (via convite).

**Files:**
- Create: `e2e/spa-fluxos-criticos.spec.ts`

- [ ] **Step 1: Escrever o spec**

`e2e/spa-fluxos-criticos.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

// Fluxos que dependiam do Next (middleware, Server Components, router.refresh) e agora
// são responsabilidade da SPA: RotaProtegida, fallback de rota, invalidação de queries.
function sufixo() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cadastrarComEscritorio(page: Page, nome: string, nomeEscritorio: string) {
  const email = `e2e-spa-${sufixo()}@teste.com`;
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(nome);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
  await page.getByLabel("Confirmar senha").fill("senha-forte-123");
  await page.getByRole("button", { name: /cadastrar/i }).click();
  await expect(page).toHaveURL("/onboarding");
  await page.getByLabel("Nome do escritório").fill(nomeEscritorio);
  await page.getByRole("button", { name: /criar escritório/i }).click();
  await expect(page).toHaveURL("/");
  return email;
}

async function sair(page: Page, nome: string) {
  await page.getByRole("button", { name: new RegExp(nome) }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe("SPA — fluxos críticos", () => {
  test("deep link sem sessão vai ao login e volta à rota pedida depois de entrar", async ({ page }) => {
    const email = await cadastrarComEscritorio(page, "Advogada Deep Link", "Escritório Deep Link");
    await sair(page, "Advogada Deep Link");

    await page.goto("/configuracoes/membros");
    await expect(page).toHaveURL("/login?callbackUrl=%2Fconfiguracoes%2Fmembros");

    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(page).toHaveURL("/configuracoes/membros");
    await expect(page.getByRole("heading", { name: "Membros" })).toBeVisible();
    await expect(page.getByText("Advogada Deep Link").first()).toBeVisible();
    await expect(page).toHaveTitle(/Membros/);
  });

  test("reload numa rota profunda mantém a página (fallback da SPA)", async ({ page }) => {
    await cadastrarComEscritorio(page, "Advogada Reload", "Escritório Reload");
    await page.goto("/casos");
    await expect(page.getByRole("heading", { name: "Processos" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Processos" })).toBeVisible();
  });

  test("/configuracoes abre a aba do escritório e renomear reflete no switcher", async ({ page }) => {
    await cadastrarComEscritorio(page, "Advogada Renomeia", "Escritório Antigo");
    await page.goto("/configuracoes");
    await expect(page).toHaveURL("/configuracoes/escritorio");

    await page.getByLabel("Nome do escritório").fill("Escritório Renomeado");
    await page.getByRole("button", { name: /salvar/i }).click();
    await expect(page.getByText("Escritório atualizado.")).toBeVisible();

    // Sem reload: o refresh() invalida as queries e o header relê GET /api/escritorios.
    await expect(page.getByRole("button", { name: /selecionar escritório/i })).toContainText(
      "Escritório Renomeado"
    );
  });

  test("editar o perfil reflete na página sem novo login", async ({ page }) => {
    await cadastrarComEscritorio(page, "Nome Antigo", "Escritório Perfil");
    await page.goto("/perfil");
    await expect(page.getByLabel("Nome")).toHaveValue("Nome Antigo");

    await page.getByLabel("Nome").fill("Nome Novo");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Perfil atualizado.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Nome")).toHaveValue("Nome Novo");
  });

  test("rota inexistente mostra a página 404 dentro do shell", async ({ page }) => {
    await cadastrarComEscritorio(page, "Advogada 404", "Escritório 404");
    await page.goto("/rota-que-nao-existe");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await page.getByRole("link", { name: /voltar ao início/i }).click();
    await expect(page).toHaveURL("/");
  });
});
```

O fluxo de papel `padrao` (redirect de `/campanhas/nova`) depende do aceite de convite, que já está em `e2e/convite-colaborador.spec.ts`. Acrescentar ao fim do teste principal desse arquivo, depois que o colaborador `padrao` entra:

```ts
    // Papel padrao não monta o formulário de nova campanha (ação de gestão).
    await page.goto("/campanhas/nova");
    await expect(page).toHaveURL("/campanhas");
```

- [ ] **Step 2: Rodar**

Run: `npm run e2e -- spa-fluxos-criticos convite-colaborador`
Expected: PASS (6 testes novos + o fluxo de convite). Se o teste de deep link falhar com URL `/login` sem `callbackUrl`, a `RotaProtegida` da 4a não está preservando o destino. Corrigi-la para `<Navigate to={`/login?callbackUrl=${encodeURIComponent(pathname + search)}`} replace />` e rodar de novo.

- [ ] **Step 3: Rodar a suíte E2E completa**

Run: `npm run e2e`
Expected: PASS nos 9 specs. Um spec que espere navegar de `troca-escritorio` para `/onboarding` pelo menu "Criar escritório" já diverge do componente, que abre um dialog. Se falhar, ajustar o spec para o dialog (`getByRole("dialog", { name: "Criar escritório" })`) no mesmo commit.

- [ ] **Step 4: Commit**

```bash
git add e2e
git commit -m "test(e2e): fluxos críticos da SPA (callbackUrl, reload, refresh, 404 e papel padrao)"
```

---

### Task 4.35: Remoção do Next.js

Pré-condição: Tasks 4.20–4.34 verdes. Depois desta task, nenhum `next*` resta no código nem nas dependências.

**Files:**
- Delete: `src/app/` (restam `layout.tsx`, `icon.tsx`, `globals.css`, `(dashboard)/_lib/**`), `src/proxy.ts`, `next.config.ts`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, `src/lib/query/query-client-servidor.ts` (ou a cópia em `apps/web`), `src/types/next-auth.d.ts` (se a Fase 3 não removeu), `postcss.config.mjs` (se o web usa `@tailwindcss/vite`)
- Move (se a 4a não moveu): `public/images` → `apps/web/public/images`; `components.json` → `apps/web/components.json`
- Create: `apps/web/public/favicon.svg` (se não existir)
- Modify: `package.json`, `jest.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `playwright.config.ts` (só se ainda usar `next`), `apps/web/src/components/ui/sonner.tsx`, `apps/web/index.html` (favicon, fontes, `lang`)

- [ ] **Step 1: Verificar a pré-condição**

```bash
ls src/app/api 2>/dev/null && echo "PARAR: ainda há rotas Next em src/app/api (Fase 2/3 incompleta)"
grep -rn "PaginaEmMigracao" apps/web/src
find src/app -name "page.tsx" -o -name "layout.tsx" | grep -v "^src/app/layout.tsx$"
grep -rlnE "from \"next(/[a-z-]+)?\"|from \"next-auth|getTenantContextOuRedirect" apps src e2e --include="*.ts" --include="*.tsx"
```

Expected: nenhuma saída nos quatro comandos, a não ser `src/app/(dashboard)/_lib/**` no último. Ele é apagado aqui.

- [ ] **Step 2: Assets, favicon, fontes e idioma no `apps/web`**

```bash
[ -d apps/web/public/images ] || { mkdir -p apps/web/public && git mv public/images apps/web/public/images; }
[ -d public ] && [ -z "$(ls -A public)" ] && rmdir public
grep -n 'rel="icon"\|fonts.googleapis\|<html' apps/web/index.html
```

Se `apps/web/public/favicon.svg` não existir, criá-lo. É o mesmo desenho do `src/app/icon.tsx`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#b3812f"/>
  <g transform="translate(6 6)" fill="none" stroke="#fafafa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <g transform="scale(0.8333)">
      <path d="M12 3v18"/>
      <path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/>
      <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/>
      <path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/>
      <path d="M7 21h10"/>
    </g>
  </g>
</svg>
```

Sem nenhum desses itens no `grep`, ajustar `apps/web/index.html`:
- `<html lang="pt-BR">`;
- no `<head>`, acrescentar:

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style>
      :root { --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif; --font-geist-mono: "Geist Mono", ui-monospace, monospace; }
    </style>
```

Isso substitui o `next/font`, que injetava `--font-sans`/`--font-geist-mono` no `<html>`; o tema em `globals.css` lê essas variáveis.

- [ ] **Step 3: Manter `next-themes`**

O `next-themes` **fica**: o `Provedores` da Task 4.8 usa `ThemeProvider` (tema light fixo) e o `sonner.tsx` lê o tema dele. Não alterar `apps/web/src/components/ui/sonner.tsx`.

Run: `grep -rn "next-themes" apps/web/src | grep -v "^apps/web/src/components/ui/sonner.tsx\|^apps/web/src/app.tsx"`
Expected: nenhuma ocorrência.

- [ ] **Step 4: Apagar o Next**

```bash
git rm -r src/app src/proxy.ts next.config.ts next-env.d.ts src/compat-next   # src/compat-next = ponte da Task 4.3
git rm -q --ignore-unmatch src/lib/query/query-client-servidor.ts apps/web/src/lib/query/query-client-servidor.ts src/types/next-auth.d.ts
grep -q "@tailwindcss/vite" apps/web/vite.config.ts && git rm postcss.config.mjs
[ -f apps/web/components.json ] || git mv components.json apps/web/components.json
rm -rf .next tsconfig.tsbuildinfo
```

Em `apps/web/components.json`:
- `"rsc": false`;
- `"tailwind.css"` com o caminho do CSS global do web, relativo a `apps/web` (o arquivo importado em `apps/web/src/main.tsx`; conferir com `grep -n "\.css" apps/web/src/main.tsx`).

Se o comentário em `src/lib/query/chaves.ts` (ou `apps/web/src/lib/query/chaves.ts`) citar o "prefetch no servidor" como motivo de as keys ficarem fora dos hooks, trocar por: `// Fábricas de query key compartilhadas entre hooks; uma escrita invalida pela raiz.`. O comentário de `opcoes-padrao.ts` sobre o "client efêmero usado no prefetch do servidor" é substituído por `// Defaults do React Query do app.`.

- [ ] **Step 5: `package.json` da raiz**

```bash
npm uninstall next eslint-config-next @tailwindcss/postcss
npm uninstall next-auth 2>/dev/null || true
npm install -D @swc/core @swc/jest typescript-eslint eslint-plugin-react-hooks @eslint/js globals
```

Se o Step 4 não removeu o `postcss.config.mjs`, porque o web ainda usa PostCSS, reinstalar `@tailwindcss/postcss` como devDependency de `apps/web`, e não da raiz.

Em `"scripts"`, substituir `dev`, `build` e `start` por:

```json
"dev": "concurrently -k -n api,web -c magenta,blue \"npm run api:dev\" \"npm run web:dev\"",
"build": "prisma generate && prisma migrate deploy && npm run web:build",
"start": "npm run preview -w @crm/web",
```

Manter `predev` (Docker), `dev:tunnel` (continua chamando `npm run dev`), `test`, `e2e`, `api:*` e `web:*`. O build de produção da API é Fase 5.

- [ ] **Step 6: `jest.config.ts` da raiz sem `next/jest`**

Na raiz agora só há domínio (services, repositories e o `src/lib` de backend); o front tem Jest próprio em `apps/web`.

```ts
import type { Config } from "jest";

// Jest da raiz: só o domínio (services, repositories, lib de backend). O front tem
// suíte própria em apps/web (npm run web:test) e a API em apps/api (npm run api:test).
// Metas de cobertura em docs/testes/estrategia-tdd.md.
const config: Config = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      { jsc: { parser: { syntax: "typescript", tsx: true }, transform: { react: { runtime: "automatic" } } } },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/e2e/", "<rootDir>/node_modules/", "<rootDir>/apps/"],
  collectCoverageFrom: [
    "src/services/**/*.{ts,tsx}",
    "src/repositories/**/*.{ts,tsx}",
    "src/lib/api/**/*.{ts,tsx}",
    "src/lib/external/**/*.{ts,tsx}",
    "src/lib/auth/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/*.test.{ts,tsx}",
  ],
  coverageThreshold: {
    global: {},
    "src/services/**/*.{ts,tsx}": { branches: 90, functions: 90, lines: 90, statements: 90 },
    "src/repositories/**/*.{ts,tsx}": { branches: 70, functions: 70, lines: 70, statements: 70 },
    "src/lib/auth/**/*.{ts,tsx}": { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};

export default config;
```

Os limiares de `src/components`/`src/hooks` (25%) já foram para o Jest do `apps/web` na 4a; conferir com `grep -n coverageThreshold -A12 apps/web/jest.config.*`. Os de `src/app/api` saíram com as rotas (Fase 2: a cobertura dos controllers está no `apps/api`).

- [ ] **Step 7: `tsconfig.json` e ESLint da raiz**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", "**/*.mts"],
  "exclude": ["node_modules", "apps"]
}
```

`eslint.config.mjs`:

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

// Sem eslint-config-next: o front é Vite (apps/web) e a API é Nest (apps/api).
export default defineConfig([
  globalIgnores(["coverage/**", "playwright-report/**", "test-results/**", "**/dist/**", "apps/api/**"]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.jest } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);
```

Remover os comentários `eslint-disable-next-line @next/next/...` que sobraram, porque a regra deixou de existir e o ESLint acusa diretiva sem uso:

```bash
grep -rln "@next/next" apps src e2e | xargs -r perl -ni -e 'print unless m{eslint-disable-next-line \@next/next/}'
```

Em `playwright.config.ts`, se `webServer.command` ainda for `npm run build && npm run start`, trocar pelo comando que a 4a usa para o Vite + API. Se ela não definiu, usar `command: "npm run dev"`, `url: "http://localhost:3000"` (porta do Vite configurada na 4a) e `reuseExistingServer: !process.env.CI`.

- [ ] **Step 8: Varredura final**

```bash
grep -rIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs --exclude=package-lock.json -E "\"next(/[a-z-]+)?\"|next-auth|eslint-config-next|NEXT_PUBLIC_|\.next/|compat-next" .
npm ls next next-auth 2>&1 | grep -E "next(-auth)?@" || echo "sem next no grafo"
```

Expected: o `grep` sem ocorrências fora de `docs/` (a documentação é atualizada na Fase 5), `CLAUDE.md` (bloco "This is NOT the Next.js you know", removido na Fase 5) e `.gitignore`. O `npm ls` imprime `sem next no grafo`. Variáveis `NEXT_PUBLIC_*` que apareçam no `apps/web` viram `VITE_*` no mesmo commit, com o `.env.example` atualizado.

- [ ] **Step 9: Rodar tudo**

```bash
npx jest
npm run web:test
npm run api:test && npm run api:typecheck
npx tsc --noEmit && npx tsc -p apps/web --noEmit
npm run lint
npm run web:build
npm run e2e
```

Expected:
- `npx jest`: PASS só com services, repositories e lib de backend, com os limiares de cobertura atendidos.
- `web:test`, `api:test` e `api:typecheck`: PASS.
- `tsc` (raiz e web) e `lint`: sem erros.
- `web:build`: gera `apps/web/dist` sem warnings de import do Next.
- `e2e`: PASS nos 9 specs.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: remove o Next.js (app router, middleware, configs e dependências)"
```

---

## Fase 5 — Consolidação: domínio, build, deploy, qualidade e docs

Ao fim da Fase 4 o sistema já roda como `apps/api` (NestJS) + `apps/web` (Vite/React), mas os dois ainda importam o domínio de `src/` na raiz por alias (`@/` na API, `@dominio/` no web), a API só roda via `tsx`, o deploy ainda descreve o Next, e lint/cobertura/Sonar apontam para caminhos que não existem mais. Esta fase fecha a migração. Ela move o domínio para dentro da API, extrai para `packages/compartilhado` o que front e back realmente compartilham, leva o Prisma para `apps/api`, cria um build de produção da API que não depende de `tsx` e define a topologia de deploy na Vercel. Também reconfigura cobertura, ESLint, CI e SonarCloud, atualiza a documentação e termina com uma verificação completa e um PR para `dev`.

### Decisões desta fase

- **Alias da API: `@dominio/*` → `apps/api/src/dominio/*`** (substitui o `@/`). Justificativa:
  1. Deixa explícita a fronteira entre a camada Nest (`apps/api/src/<modulo>`, que usa imports relativos) e o domínio. `grep -r "@dominio/" apps/api/src --include=*.controller.ts` mostra exatamente o acoplamento.
  2. O `@/` passa a significar sempre "o `src` do próprio app", que é o que já vale no web.
  3. O alias só existe para o TypeScript, o Jest e o tsup (esbuild lê `paths` do tsconfig). O artefato de produção é um bundle, então o runtime nunca resolve alias.
- **`packages/compartilhado` (`@crm/compartilhado`)**: pacote de workspace só com código-fonte TS (`exports: { "./*": "./src/*.ts" }`). Não tem build próprio: o Vite transpila porque o pacote é link de workspace, o tsup embute (`noExternal`) e o Jest mapeia por `moduleNameMapper`. O conteúdo foi decidido com grep de quem importa cada módulo de `src/` hoje:

  | Módulo (hoje em `src/`) | Importado pelo back | Importado pelo front | Destino |
  |---|---|---|---|
  | `types/*` (DTOs, exceto `next-auth.d.ts`) | `caso`, `evento` | todos | `compartilhado/tipos/*` |
  | `lib/api/schemas-*.ts` (Zod) | sim | sim, a partir da Fase 4 (formulários) | `compartilhado/schemas/*` |
  | `lib/utils/{telefone,cpf,email,cores-status,icones-status,campanha-mensagem,campanha-tratamentos,campanha-status-mensagem}` | sim | sim | `compartilhado/utils/*` |
  | `lib/auth/permissoes.ts` (hierarquia de papéis, puro) | sim | sim (esconde ações na UI) | `compartilhado/auth/permissoes.ts` |
  | `lib/utils/{diff,evento-periodo}` | sim | não | `apps/api/src/dominio/lib/utils` |
  | `lib/utils/{agenda-*,csv-campanha,data,data-input,nome,oab,role,tipo-arquivo,valor,whatsapp-formatacao}` | não | sim | `apps/web/src/lib/utils` |
  | `services/`, `repositories/`, `lib/{api (erros, serializa, payloads, json), auth, external, documentos, prisma.ts}` | sim | não | `apps/api/src/dominio/...` |

- **O compartilhado não depende de `@prisma/client`**: os 4 enums do Prisma que os DTOs e as utils usam (`RoleMembro`, `StatusCampanha`, `StatusInstanciaWhatsapp`, `TipoArquivo`) viram `const` arrays com tipos união em `compartilhado/enums.ts`. Um teste na API compara esses arrays com os enums gerados pelo Prisma, então uma migration que mude um enum quebra o teste.
- **Build da API: tsup (esbuild), ESM, `dist/main.js`**, rodado com `node dist/main.js`. As dependências de `package.json` ficam externas (padrão do tsup), e só o código próprio, o domínio e o compartilhado entram no bundle. O esbuild emite decorators legados (`experimentalDecorators`) mas **não** emite `design:paramtypes`. Isso é seguro porque a convenção da Fase 1 (providers por token com `useValue` e `@Inject(TOKEN)` explícito) já não depende de metadata. Rodar o e2e contra esse bundle prova isso de ponta a ponta. `nest build` (tsc) foi descartado porque não resolve `paths`, não embute o workspace compartilhado e geraria uma árvore de arquivos com imports sem extensão, que é inválida em ESM.
- **Deploy: Vercel Services**, com **um único Project por ambiente**, mantendo os dois Projects atuais `crm-advocacia-pac` e `crm-advocacia-supabase`. Cada deployment contém dois services, `web` (Vite, estático) e `api` (NestJS em Fluid Compute), atrás de uma tabela de rotas (`/api/*` → api, `/*` → web). Isso dá:
  - mesma origem, então o cookie `crm_sessao` funciona sem CORS;
  - deploy e rollback **atômicos** de web+api;
  - previews coerentes, em que cada preview chama a própria API.

  A alternativa pedida inicialmente (um Project web e um Project api por ambiente, com o web reescrevendo `/api/*` para a URL da api) dobra os Projects para quatro, desacopla rollbacks e quebra previews: o web de preview apontaria para a api de produção ou exigiria montar a URL de branch da api com bypass de proteção. Services está em **Beta** (todos os planos). Por isso a Task 5.9 começa com um spike de go/no-go e traz o plano B completo (dois Projects por ambiente).
- **Migrations no deploy só em produção** (`VERCEL_ENV=production`). Hoje o `npm run build` roda `prisma migrate deploy` em todo build, inclusive em preview. Se o Preview usa o mesmo `DATABASE_URL`, um PR migraria o banco de produção. A mudança é consciente e aparece em `docs/deploy/deploy.md`.
- **Variáveis de ambiente da API** saem de `.env`/`.env.local` na raiz para `apps/api/.env`/`apps/api/.env.local`, que é onde ficam o `prisma.config.ts` e o processo que as lê. O web não tem segredos: o Vite só expõe `VITE_*`.

### Global Constraints (Fase 5)

- Node ≥ 24 em CI e na Vercel (local: v26). NestJS fixado em `12.3.2`.
- Nenhum arquivo de `apps/web` importa `apps/api` (e vice-versa). O compartilhado não importa nenhum dos dois nem `@prisma/client`. O codemod da Task 5.2 aborta se encontrar violação, e o ESLint (Task 5.6) mantém a regra.
- Conventional Commits em português; testes no mesmo commit da mudança; branch `feature/migracao-nestjs`; PR para `dev`.
- Durante a fase, `git status` deve mostrar renomeações (`R`) e não remoção mais criação. Sempre `git mv`, nunca `cp` + `rm`, para preservar `git log --follow`.

### Estrutura de arquivos ao fim da Fase 5

```
package.json                               (reescrever: workspaces apps/* + packages/*, scripts agregados)
eslint.config.mjs                          (reescrever: flat config do monorepo, sem eslint-config-next)
playwright.config.ts                       (reescrever: sobe api (dist) + web (vite preview))
sonar-project.properties                   (criar)
vercel.json                                (criar: services web + api)
.github/workflows/ci.yml                   (criar)
scripts/verificar-piso-cobertura.mjs       (criar)
.gitignore                                 (modificar)
apps/api/package.json                      (reescrever)
apps/api/tsconfig.json                     (reescrever: alias @dominio/*)
apps/api/jest.config.cjs                   (reescrever: mapeamentos + cobertura por camada)
apps/api/tsup.config.ts                    (criar)
apps/api/prisma.config.ts                  (git mv da raiz + modificar)
apps/api/prisma/**                         (git mv da raiz)
apps/api/scripts/migrar-no-deploy.mjs      (criar)
apps/api/.env.example                      (git mv da raiz + reescrever)
apps/api/src/main.ts                       (reescrever)
apps/api/src/instrumentacao.ts             (criar: New Relic)
apps/api/src/config/carregar-env.ts        (criar, + .test.ts)
apps/api/src/dominio/{services,repositories,lib/{api,auth,external,documentos,utils},lib/prisma.ts}  (git mv de src/)
apps/api/src/dominio/enums-compartilhados.test.ts   (criar)
apps/web/jest.config.cjs                   (reescrever: cobertura + mapeamento do compartilhado)
apps/web/src/lib/utils/*                   (git mv das utils só de front, se ainda estiverem em src/)
packages/compartilhado/{package.json,tsconfig.json,jest.config.cjs}
packages/compartilhado/src/{enums.ts,tipos/*,schemas/*,utils/*,auth/permissoes.ts}
src/                                       (removido)
CLAUDE.md, README.md, docs/**              (reescrever seções)
```

---

### Task 5.1: Pacote `@crm/compartilhado`, enums sem Prisma e tipos de filtro de caso fora do repository

O schema Zod `schemas-caso.ts` e o teste dele importam `FiltrosCaso`/`SEM_RESPONSAVEL` de `repositories/caso.repository.ts`. Se isso continuasse assim, o compartilhado dependeria da API. Antes de mover qualquer coisa, esses dois símbolos passam para `src/types/caso.ts`, que vira DTO compartilhado, e o repository passa a reexportá-los.

**Files:**
- Create: `packages/compartilhado/package.json`, `packages/compartilhado/tsconfig.json`, `packages/compartilhado/jest.config.cjs`, `packages/compartilhado/src/enums.ts`, `packages/compartilhado/src/enums.test.ts`
- Modify: `package.json` (raiz: `workspaces`), `src/types/caso.ts`, `src/repositories/caso.repository.ts`, `src/lib/api/schemas-caso.ts`, `src/lib/api/schemas-caso.test.ts`

**Interfaces:**
- Produces: `@crm/compartilhado/enums` exportando `ROLES_MEMBRO`, `STATUS_CAMPANHA`, `STATUS_INSTANCIA_WHATSAPP`, `TIPOS_ARQUIVO` (`as const`) e os tipos `RoleMembro`, `StatusCampanha`, `StatusInstanciaWhatsapp`, `TipoArquivo`.
- Produces: `SEM_RESPONSAVEL` e `interface FiltrosCaso` exportados de `src/types/caso.ts`. `caso.repository.ts` continua exportando os dois por reexport, então nenhum importador muda.

- [ ] **Step 1: Declarar o workspace de pacotes**

Em `package.json` (raiz), trocar `"workspaces": ["apps/*"]` por:

```json
"workspaces": ["apps/*", "packages/*"],
```

- [ ] **Step 2: Criar o esqueleto do pacote**

`packages/compartilhado/package.json`:

```json
{
  "name": "@crm/compartilhado",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Código puro compartilhado entre apps/api e apps/web: DTOs, schemas Zod, enums e utilitários de validação/formatação.",
  "exports": {
    "./*": "./src/*.ts"
  },
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@swc/core": "^1.13.0",
    "@swc/jest": "^0.2.39",
    "@types/jest": "^29.5.14",
    "jest": "^29.7.0"
  }
}
```

`packages/compartilhado/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "noEmit": true,
    "types": ["jest"]
  },
  "include": ["src/**/*.ts"]
}
```

`packages/compartilhado/jest.config.cjs`:

```js
// CJS de propósito: o pacote é "type": "module" e o Jest 29 roda em CommonJS.
// O compartilhado é puro (sem I/O), então os testes rodam em ambiente node.
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      { jsc: { parser: { syntax: "typescript" } }, module: { type: "commonjs" } },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  // tipos/ só tem interfaces (sem código executável) e enums.ts é coberto pelo próprio teste.
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts", "!src/tipos/**"],
  coverageReporters: ["text-summary", "lcov", "json-summary"],
  // Grupo "backend" do piso institucional (validação usada pela API): mesma meta
  // interna dos Services, porque tudo aqui é função pura.
  coverageThreshold: {
    global: { branches: 85, functions: 90, lines: 90, statements: 90 },
  },
};
```

- [ ] **Step 3: Escrever o teste que falha**

`packages/compartilhado/src/enums.test.ts`:

```ts
import {
  ROLES_MEMBRO,
  STATUS_CAMPANHA,
  STATUS_INSTANCIA_WHATSAPP,
  TIPOS_ARQUIVO,
} from "./enums";

// A paridade com os enums do Prisma é verificada na API
// (apps/api/src/dominio/enums-compartilhados.test.ts). Aqui só garantimos a ordem
// e os valores esperados pelas telas.
describe("enums compartilhados", () => {
  it("expõe os papéis de membro em ordem de hierarquia decrescente", () => {
    expect(ROLES_MEMBRO).toEqual(["owner", "admin", "padrao"]);
  });

  it("expõe o ciclo de vida de campanha", () => {
    expect(STATUS_CAMPANHA).toEqual(["agendada", "enviando", "pausada", "concluida", "excluindo"]);
  });

  it("expõe os estados de instância de WhatsApp", () => {
    expect(STATUS_INSTANCIA_WHATSAPP).toEqual([
      "disconnected",
      "connecting",
      "connected",
      "hibernated",
    ]);
  });

  it("expõe os tipos de arquivo aceitos (RN18)", () => {
    expect(TIPOS_ARQUIVO).toEqual(["pdf", "docx", "jpg", "png", "jpeg"]);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm install && npm test -w @crm/compartilhado`
Expected: FAIL com `Cannot find module './enums'`.

- [ ] **Step 5: Implementar `enums.ts`**

`packages/compartilhado/src/enums.ts`:

```ts
// Espelho, sem dependência de @prisma/client, dos enums do schema.prisma que
// atravessam a fronteira HTTP (DTOs, permissões, validação de upload). O web não
// pode depender do Prisma. A paridade com o schema é garantida por
// apps/api/src/dominio/enums-compartilhados.test.ts: mudou o enum numa migration,
// esse teste quebra até este arquivo ser atualizado.
export const ROLES_MEMBRO = ["owner", "admin", "padrao"] as const;
export type RoleMembro = (typeof ROLES_MEMBRO)[number];

export const STATUS_CAMPANHA = [
  "agendada",
  "enviando",
  "pausada",
  "concluida",
  "excluindo",
] as const;
export type StatusCampanha = (typeof STATUS_CAMPANHA)[number];

export const STATUS_INSTANCIA_WHATSAPP = [
  "disconnected",
  "connecting",
  "connected",
  "hibernated",
] as const;
export type StatusInstanciaWhatsapp = (typeof STATUS_INSTANCIA_WHATSAPP)[number];

export const TIPOS_ARQUIVO = ["pdf", "docx", "jpg", "png", "jpeg"] as const;
export type TipoArquivo = (typeof TIPOS_ARQUIVO)[number];
```

- [ ] **Step 6: Mover `FiltrosCaso`/`SEM_RESPONSAVEL` para o DTO**

Em `src/types/caso.ts`, acrescentar no topo, depois dos imports:

```ts
// Valor-sentinela do filtro de responsável ("casos sem responsável"), usado pelo
// schema da query string (compartilhado) e pelo repository (Prisma).
export const SEM_RESPONSAVEL = "sem-responsavel";

// Filtros da listagem de casos já validados (saída de parseFiltrosCasoDaQuery).
export interface FiltrosCaso {
  busca?: string;
  statusIds?: string[];
  tipoStatusIds?: string[];
  tipoProcessoIds?: string[];
  clienteIds?: string[];
  responsavelIds?: string[];
  dataInicio?: Date;
  dataFim?: Date;
  arquivado?: boolean;
  skip?: number;
  take?: number;
}
```

Em `src/repositories/caso.repository.ts`, apagar a declaração `export const SEM_RESPONSAVEL = "sem-responsavel";` e o bloco `export interface FiltrosCaso { ... }` (linhas 8–22 hoje). No lugar, colocar:

```ts
import { SEM_RESPONSAVEL, type FiltrosCaso } from "@/types/caso";

// Reexport para não mudar os importadores existentes (services, payloads, testes).
export { SEM_RESPONSAVEL, type FiltrosCaso };
```

Em `src/lib/api/schemas-caso.ts`, trocar `import type { FiltrosCaso } from "@/repositories/caso.repository";` por `import type { FiltrosCaso } from "@/types/caso";`.

Em `src/lib/api/schemas-caso.test.ts`, trocar `import { SEM_RESPONSAVEL } from "@/repositories/caso.repository";` por `import { SEM_RESPONSAVEL } from "@/types/caso";`.

- [ ] **Step 7: Rodar os testes**

Run: `npm test -w @crm/compartilhado`
Expected: PASS (4 testes).

Run: `npm test -w @crm/api -- caso` e `npm run typecheck -w @crm/api`
Expected: PASS, sem erros de tipo. Os testes de `caso.repository`, `caso.service`, `schemas-caso` e dos controllers de casos continuam verdes.

Run: `grep -rn "repositories/caso.repository" src/lib/api/schemas-caso.ts src/lib/api/schemas-caso.test.ts`
Expected: nenhuma saída.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json packages/compartilhado src/types/caso.ts src/repositories/caso.repository.ts src/lib/api/schemas-caso.ts src/lib/api/schemas-caso.test.ts
git commit -m "chore(compartilhado): cria pacote @crm/compartilhado com enums sem Prisma"
```

---

### Task 5.2: Mover o domínio para `apps/api`, o compartilhado para `packages/` e reescrever imports

Um codemod de uso único (não é commitado) classifica cada arquivo versionado em `src/`, faz `git mv` para o destino e reescreve todos os especificadores de import (`from`, `import()`, `import "…"`, `jest.mock`, `jest.requireActual`) de `apps/api`, `apps/web` e `packages/compartilhado`, aplicando as regras de fronteira. Ele valida tudo antes de mover. Se algum arquivo não tiver destino, ou se um destino já existir com conteúdo diferente, aborta sem tocar em nada.

**Files:**
- Create (temporário, apagado no fim): `scripts/consolidar-dominio.mjs`
- Move: todo `src/**` (ver tabela de decisões)
- Modify: `apps/api/tsconfig.json`, `apps/api/jest.config.cjs`, `apps/api/package.json` (dependência do compartilhado), `apps/web/jest.config.cjs`, `apps/web/tsconfig*.json` e `apps/web/vite.config.ts` (remover alias `@dominio`), `apps/web/package.json`
- Create: `apps/api/src/dominio/enums-compartilhados.test.ts`, `packages/compartilhado/src/tipos/` etc. (via `git mv`)

**Interfaces:**
- Consumes: `@crm/compartilhado/enums` e os tipos de `src/types/caso.ts` (Task 5.1).
- Produces: aliases finais. Na API: `@dominio/<caminho>` para o domínio e `@crm/compartilhado/<caminho>` para o compartilhado. No web: `@/<caminho>` para o próprio `src` e `@crm/compartilhado/<caminho>`. O alias `@dominio/` deixa de existir no web.

- [ ] **Step 1: Escrever o codemod**

`scripts/consolidar-dominio.mjs`:

```js
#!/usr/bin/env node
// Uso único (Fase 5 da migração NestJS) — NÃO é commitado.
// 1. Classifica cada arquivo versionado em src/ e calcula o destino.
// 2. Valida tudo (sem destino / destino divergente => aborta sem mover nada).
// 3. git mv de cada arquivo (ou git rm se o destino já existe idêntico, cópia da Fase 4).
// 4. Reescreve os especificadores de import de apps/api, apps/web e packages/compartilhado.
// Uso: node scripts/consolidar-dominio.mjs --dry   (só lista)
//      node scripts/consolidar-dominio.mjs         (executa)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { posix } from "node:path";

const DRY = process.argv.includes("--dry");
const API = "apps/api/src/dominio";
const COMP = "packages/compartilhado/src";
const WEB = "apps/web/src";

const git = (args) => execFileSync("git", args, { stdio: "inherit" });

const COMPARTILHADO = new Map([
  ...["campanha", "caso", "cliente", "comentario", "dashboard", "documento", "evento",
    "instancia-whatsapp", "status", "tipo-processo"].map((n) => [`src/types/${n}`, `${COMP}/tipos/${n}`]),
  ...["campanha", "caso", "cliente", "comuns", "evento", "instancia-whatsapp", "status",
    "tipo-processo"].map((n) => [`src/lib/api/schemas-${n}`, `${COMP}/schemas/${n}`]),
  ...["telefone", "cpf", "email", "cores-status", "icones-status", "campanha-mensagem",
    "campanha-tratamentos", "campanha-status-mensagem"].map((n) => [`src/lib/utils/${n}`, `${COMP}/utils/${n}`]),
  ["src/lib/auth/permissoes", `${COMP}/auth/permissoes`],
]);
const SO_FRONT_UTILS = ["agenda-eventos", "agenda-grade", "agenda-layout", "csv-campanha", "data",
  "data-input", "nome", "oab", "role", "tipo-arquivo", "valor", "whatsapp-formatacao"];
const SO_API_UTILS = ["diff", "evento-periodo"];
// Restos do Next/NextAuth: as Fases 3 e 4 já deveriam tê-los removido.
const RESIDUOS_NEXT = [/^src\/app\//, /^src\/proxy\.ts$/, /^src\/types\/next-auth\.d\.ts$/,
  /^src\/lib\/auth\/config(\.test)?\.ts$/, /^src\/lib\/query\/query-client-servidor\.ts$/];
const PREFIXOS = [
  ["src/services/", `${API}/services/`],
  ["src/repositories/", `${API}/repositories/`],
  ["src/lib/api/", `${API}/lib/api/`],
  ["src/lib/auth/", `${API}/lib/auth/`],
  ["src/lib/external/", `${API}/lib/external/`],
  ["src/lib/documentos/", `${API}/lib/documentos/`],
  ["src/lib/prisma.ts", `${API}/lib/prisma.ts`],
  ["src/lib/query/", `${WEB}/lib/query/`],
  ["src/lib/api-client", `${WEB}/lib/api-client`],
  ["src/lib/site-config", `${WEB}/lib/site-config`],
  ["src/lib/test-utils", `${WEB}/lib/test-utils`],
  ["src/lib/utils.ts", `${WEB}/lib/utils.ts`],
  ["src/hooks/", `${WEB}/hooks/`],
  ["src/components/", `${WEB}/components/`],
];

function destino(arquivo) {
  if (arquivo.endsWith("/.gitkeep")) return null;
  if (RESIDUOS_NEXT.some((r) => r.test(arquivo))) {
    throw new Error(`${arquivo}: resíduo do Next/NextAuth — deveria ter saído nas Fases 3/4`);
  }
  const ext = arquivo.match(/(\.test)?\.tsx?$/)?.[0] ?? "";
  const base = ext ? arquivo.slice(0, -ext.length) : arquivo;
  if (COMPARTILHADO.has(base)) return COMPARTILHADO.get(base) + ext;
  const util = base.match(/^src\/lib\/utils\/(.+)$/)?.[1];
  if (util && SO_FRONT_UTILS.includes(util)) return `${WEB}/lib/utils/${util}${ext}`;
  if (util && SO_API_UTILS.includes(util)) return `${API}/lib/utils/${util}${ext}`;
  for (const [de, para] of PREFIXOS) {
    if (arquivo.startsWith(de)) return para + arquivo.slice(de.length);
  }
  throw new Error(`${arquivo}: sem destino definido — classifique no codemod antes de continuar`);
}

// ---- 1 e 2: classificar e validar -------------------------------------------------
const arquivos = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" }).split("\n").filter(Boolean);
const plano = arquivos.map((de) => {
  const para = destino(de);
  if (para && existsSync(para) && readFileSync(para, "utf8") !== readFileSync(de, "utf8")) {
    throw new Error(`${para} já existe e difere de ${de} — resolva à mão antes de rodar`);
  }
  return { de, para, duplicado: Boolean(para && existsSync(para)) };
});
for (const { de, para, duplicado } of plano) {
  console.log(para === null ? `rm  ${de}` : duplicado ? `=   ${de} (idêntico a ${para})` : `mv  ${de} -> ${para}`);
}
if (DRY) process.exit(0);

// ---- 3: mover ----------------------------------------------------------------------
const novoPorAntigo = new Map();
const antigoPorNovo = new Map();
for (const { de, para, duplicado } of plano) {
  if (para === null || duplicado) {
    git(["rm", "-q", de]);
    if (para) novoPorAntigo.set(de, para);
    continue;
  }
  mkdirSync(posix.dirname(para), { recursive: true });
  git(["mv", de, para]);
  novoPorAntigo.set(de, para);
  antigoPorNovo.set(para, de);
}

// ---- 4: reescrever imports ---------------------------------------------------------
const pacoteDe = (p) =>
  p.startsWith("apps/api/") ? "api" : p.startsWith("apps/web/") ? "web" : p.startsWith("packages/compartilhado/") ? "comp" : "?";
const semExt = (p) => p.replace(/\.tsx?$/, "");
const relativo = (de, para) => {
  const r = posix.relative(posix.dirname(de), semExt(para));
  return r.startsWith(".") ? r : `./${r}`;
};
const resolverAntigo = (base) => {
  for (const e of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (novoPorAntigo.has(base + e)) return novoPorAntigo.get(base + e);
  }
  return undefined;
};

function novoEspecificador(arquivo, espec) {
  const antigo = antigoPorNovo.get(arquivo) ?? arquivo;
  const pacote = pacoteDe(arquivo);
  if (espec === "@prisma/client" && pacote !== "api") {
    return pacote === "comp" ? relativo(arquivo, `${COMP}/enums.ts`) : "@crm/compartilhado/enums";
  }
  let alvoAntigo;
  if (espec.startsWith("@dominio/")) alvoAntigo = `src/${espec.slice("@dominio/".length)}`;
  else if (espec.startsWith("@/") && (pacote === "api" || antigo.startsWith("src/"))) alvoAntigo = `src/${espec.slice(2)}`;
  else if (espec.startsWith(".")) {
    const r = posix.normalize(posix.join(posix.dirname(antigo), espec));
    if (!r.startsWith("src/")) return espec;
    alvoAntigo = r;
  } else return espec;

  const novo = resolverAntigo(alvoAntigo);
  if (!novo) throw new Error(`${arquivo}: import "${espec}" aponta para ${alvoAntigo}, que não foi movido`);
  const pacoteAlvo = pacoteDe(novo);
  if (espec.startsWith(".") && pacoteAlvo === pacote) return relativo(arquivo, novo);
  if (pacoteAlvo === "comp") {
    return pacote === "comp" ? relativo(arquivo, novo) : `@crm/compartilhado/${semExt(novo.slice(COMP.length + 1))}`;
  }
  if (pacote === "comp") throw new Error(`${arquivo}: o compartilhado não pode importar ${novo}`);
  if (pacoteAlvo !== pacote) throw new Error(`${arquivo}: import de ${pacote} para ${pacoteAlvo} (${novo}) viola a fronteira`);
  if (pacote === "api") {
    if (!novo.startsWith(`${API}/`)) return relativo(arquivo, novo);
    return `@dominio/${semExt(novo.slice(API.length + 1))}`;
  }
  return `@/${semExt(novo.slice(WEB.length + 1))}`;
}

function listar(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((nome) => {
    const caminho = `${dir}/${nome}`;
    if (nome === "node_modules" || nome === "dist" || nome === "coverage") return [];
    if (statSync(caminho).isDirectory()) return listar(caminho);
    return /\.(tsx?|mts)$/.test(nome) ? [caminho] : [];
  });
}

const ESPEC = /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\bjest\.(?:mock|requireActual|doMock|unmock)\s*\(\s*)(["'])([^"']+)\2/g;
let alterados = 0;
for (const arquivo of ["apps/api/src", "apps/api/test", "apps/web/src", COMP].flatMap(listar)) {
  const original = readFileSync(arquivo, "utf8");
  const novo = original.replace(ESPEC, (_m, prefixo, aspas, espec) => `${prefixo}${aspas}${novoEspecificador(arquivo, espec)}${aspas}`);
  if (novo !== original) {
    writeFileSync(arquivo, novo);
    alterados += 1;
  }
}
console.log(`\n${novoPorAntigo.size} arquivos movidos; ${alterados} arquivos com imports reescritos.`);
```

- [ ] **Step 2: Rodar em modo simulação**

Run: `node scripts/consolidar-dominio.mjs --dry`
Expected: uma linha `mv`/`rm`/`=` por arquivo de `src/` e saída 0. Se aparecer `resíduo do Next/NextAuth` ou `sem destino definido`, a Fase 3/4 deixou um arquivo para trás. Nesse caso, apagar o resíduo (Next) ou acrescentar a regra que falta ao codemod, e repetir até a simulação passar limpa.

- [ ] **Step 3: Executar**

Run: `node scripts/consolidar-dominio.mjs && git ls-files src | wc -l`
Expected: `... arquivos movidos; ... arquivos com imports reescritos.` e `0`.

Run: `rm -rf src && rm scripts/consolidar-dominio.mjs`
Expected: diretório `src/` e o codemod removidos. Só sobravam diretórios vazios e não versionados em `src/`.

- [ ] **Step 4: Ajustar os aliases da API**

`apps/api/tsconfig.json` (arquivo completo):

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "noEmit": true,
    "types": ["node", "jest"],
    "paths": {
      "@dominio/*": ["./src/dominio/*"]
    }
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "tsup.config.ts", "prisma.config.ts"]
}
```

`apps/api/jest.config.cjs` (arquivo completo, já com a cobertura por camada da Task 5.5):

```js
// CJS de propósito: o pacote é "type": "module", e o Jest 29 roda em CommonJS.
// O @swc/jest transpila o código da API, o domínio (src/dominio), o pacote
// @crm/compartilhado e os pacotes ESM (Nest 12, jose) para CJS.
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.(t|j|mj)s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!(@nestjs|jose)/)"],
  moduleNameMapper: {
    "^@dominio/(.*)$": "<rootDir>/src/dominio/$1",
    "^@crm/compartilhado/(.*)$": "<rootDir>/../../packages/compartilhado/src/$1",
  },
  moduleFileExtensions: ["ts", "js", "mjs", "json"],

  // Piso institucional: 75% no grupo backend (docs/testes/estrategia-tdd.md),
  // conferido por scripts/verificar-piso-cobertura.mjs somando api + compartilhado.
  // As metas abaixo são as internas, por camada.
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.d.ts",
    // Bootstrap do processo (listen, dotenv, agente APM): exercitado pelo e2e
    // contra o build de produção, não por teste unitário.
    "!src/main.ts",
    "!src/instrumentacao.ts",
    // Declaração de módulos Nest (só metadata de wiring), sem lógica.
    "!src/**/*.module.ts",
    "!src/**/tokens.ts",
    "!src/dominio/lib/prisma.ts",
  ],
  coverageReporters: ["text-summary", "lcov", "json-summary"],
  coverageThreshold: {
    global: { branches: 70, functions: 75, lines: 75, statements: 75 },
    "./src/dominio/services/": { branches: 90, functions: 90, lines: 90, statements: 90 },
    "./src/dominio/repositories/": { branches: 70, functions: 70, lines: 70, statements: 70 },
    "./src/dominio/lib/auth/": { branches: 90, functions: 90, lines: 90, statements: 90 },
    "./src/**/*.controller.ts": { branches: 70, functions: 70, lines: 70, statements: 70 },
    "./src/comum/": { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
```

Run: `npm pkg set "dependencies.@crm/compartilhado=*" -w @crm/api && npm pkg set "dependencies.@crm/compartilhado=*" -w @crm/web && npm install`
Expected: `ls -l node_modules/@crm` mostra `api`, `compartilhado` e `web` como links.

- [ ] **Step 5: Ajustar o web**

Em `apps/web/tsconfig.json` (ou `apps/web/tsconfig.app.json`, onde a Fase 4 declarou `paths`), remover a entrada `"@dominio/*": ["../../src/*"]` de `compilerOptions.paths` e manter só `"@/*": ["./src/*"]`. Em `apps/web/vite.config.ts`, remover do objeto `resolve.alias` a chave `"@dominio"`. O compartilhado é resolvido pelo `exports` do pacote, sem alias.

`apps/web/jest.config.cjs` (arquivo completo; substitui o da Fase 4. Se a Fase 4 tiver `jest.config.ts`, apagar com `git rm` e manter este):

```js
// CJS de propósito: o pacote é "type": "module" e o Jest 29 roda em CommonJS.
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          transform: { react: { runtime: "automatic" } },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  moduleNameMapper: {
    "\\.(css|svg|png|jpg)$": "<rootDir>/test/arquivo-estatico.cjs",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@crm/compartilhado/(.*)$": "<rootDir>/../../packages/compartilhado/src/$1",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "json"],

  // Piso institucional frontend: 25% (docs/testes/estrategia-tdd.md).
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/main.tsx",
    // Primitivas geradas pelo shadcn CLI (docs/app/design-system.md), sem lógica própria.
    "!src/components/ui/**",
  ],
  coverageReporters: ["text-summary", "lcov", "json-summary"],
  coverageThreshold: {
    global: { branches: 25, functions: 25, lines: 25, statements: 25 },
    "./src/components/": { branches: 25, functions: 25, lines: 25, statements: 25 },
    "./src/hooks/": { branches: 25, functions: 25, lines: 25, statements: 25 },
  },
};
```

Se a Fase 4 ainda não tem `apps/web/test/arquivo-estatico.cjs`, criar:

```js
// Stub para imports de CSS/imagem nos testes de componente.
module.exports = "arquivo-estatico";
```

- [ ] **Step 6: Teste de paridade dos enums (falha primeiro)**

`apps/api/src/dominio/enums-compartilhados.test.ts`:

```ts
import { RoleMembro, StatusCampanha, StatusInstanciaWhatsapp, TipoArquivo } from "@prisma/client";
import {
  ROLES_MEMBRO,
  STATUS_CAMPANHA,
  STATUS_INSTANCIA_WHATSAPP,
  TIPOS_ARQUIVO,
} from "@crm/compartilhado/enums";

// O web não depende do Prisma: os enums que atravessam a fronteira HTTP são
// espelhados em @crm/compartilhado/enums. Este teste quebra quando uma migration
// muda um desses enums sem atualizar o espelho.
describe("paridade dos enums compartilhados com o schema Prisma", () => {
  it.each([
    ["RoleMembro", Object.values(RoleMembro), ROLES_MEMBRO],
    ["StatusCampanha", Object.values(StatusCampanha), STATUS_CAMPANHA],
    ["StatusInstanciaWhatsapp", Object.values(StatusInstanciaWhatsapp), STATUS_INSTANCIA_WHATSAPP],
    ["TipoArquivo", Object.values(TipoArquivo), TIPOS_ARQUIVO],
  ])("%s tem os mesmos valores", (_nome, doPrisma, compartilhado) => {
    expect([...doPrisma].sort()).toEqual([...compartilhado].sort());
  });
});
```

Run: `npm test -w @crm/api -- enums-compartilhados`
Expected: PASS (4 casos). Para provar que o teste pega divergência, remover temporariamente `"hibernated"` de `STATUS_INSTANCIA_WHATSAPP` e rodar de novo. Expected: FAIL em `StatusInstanciaWhatsapp`. Desfazer a alteração.

- [ ] **Step 7: Verificar fronteiras, tipos e testes**

Run: `grep -rnE "from \"(next|next-auth)|@dominio/" apps/web/src packages; grep -rn "@prisma/client" apps/web/src packages; grep -rnE "from \"@/" apps/api/src`
Expected: nenhuma saída nos três greps.

Run: `npm run typecheck --workspaces --if-present`
Expected: sem erros nos três pacotes.

Run: `npm test --workspaces --if-present`
Expected: todas as suítes de `@crm/api`, `@crm/web` e `@crm/compartilhado` passando, com o mesmo total de testes de antes da task mais os 4 de paridade e os 4 de enums.

- [ ] **Step 8: Commit**

```bash
git add -A src apps packages package.json package-lock.json
git commit -m "refactor: move o domínio para apps/api e o código comum para @crm/compartilhado"
```

---

### Task 5.3: Prisma, variáveis de ambiente e scripts dentro de `apps/api`

**Files:**
- Move: `prisma/` → `apps/api/prisma/`, `prisma.config.ts` → `apps/api/prisma.config.ts`, `.env.example` → `apps/api/.env.example`
- Modify: `apps/api/prisma.config.ts`, `apps/api/prisma/schema.prisma` (`binaryTargets`), `apps/api/package.json`, `package.json` (raiz), `.gitignore`
- Create: `apps/api/scripts/migrar-no-deploy.mjs`, `apps/api/src/config/carregar-env.ts`, `apps/api/src/config/carregar-env.test.ts`

**Interfaces:**
- Produces: `carregarEnvLocal(diretorioDaApi: string): void`. Carrega `.env.local` e depois `.env` de `apps/api`. Não faz nada quando `process.env.VERCEL` está definido. Nunca sobrescreve variável já presente.
- Produces: scripts `prisma:generate`, `prisma:migrate`, `prisma:deploy`, `vercel-build`, `build`, `start` em `@crm/api`, que a raiz repassa.

- [ ] **Step 1: Mover os arquivos**

```bash
git mv prisma apps/api/prisma
git mv prisma.config.ts apps/api/prisma.config.ts
git mv .env.example apps/api/.env.example
mv .env apps/api/.env 2>/dev/null; mv .env.local apps/api/.env.local 2>/dev/null; true
```

Expected: `git status` mostra `renamed:` para `prisma/**`, `prisma.config.ts` e `.env.example`. Os `.env*` locais, que não são versionados, ficam agora em `apps/api/`.

- [ ] **Step 2: `prisma.config.ts` lendo o `.env` da API**

`apps/api/prisma.config.ts` (arquivo completo):

```ts
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Os comandos do Prisma rodam com cwd = apps/api (npm run -w @crm/api ...).
// .env.local tem prioridade sobre .env, igual ao main.ts. Na Vercel/CI as
// variáveis já vêm do ambiente e o dotenv não as sobrescreve.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
```

Em `apps/api/prisma/schema.prisma`, trocar o bloco `generator client` por:

```prisma
generator client {
  provider = "prisma-client-js"
  // native: máquina local/CI. rhel-openssl-3.0.x: runtime das Vercel Functions
  // (Amazon Linux 2023), garantido mesmo se o build rodar em outra imagem.
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```

Alterar só `binaryTargets` não muda o banco, então não gera migration. Conferir com `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$DIRECT_URL"` (em `apps/api`), que deve responder `No difference detected.`.

- [ ] **Step 3: `.env.example` da API**

`apps/api/.env.example` (arquivo completo):

```bash
# Copie para apps/api/.env (ou .env.local) — lido pelo main.ts (dev) e pelo prisma.config.ts.
# Em produção as variáveis vêm do Vercel Project (docs/deploy/deploy.md); nada aqui é lido lá.

# DIRECT_URL: obrigatória. Em bancos sem connection pooler (Docker local, RDS), repita o
# mesmo valor de DATABASE_URL. Com pooler (ex.: Supavisor do Supabase), DATABASE_URL aponta
# pro endpoint pooled (porta 6543) e DIRECT_URL pro endpoint session (porta 5432) —
# migrations do Prisma sempre usam DIRECT_URL.
DATABASE_URL="postgresql://crm_user:crm_password@localhost:5432/crm_advocacia?schema=public"
DIRECT_URL="postgresql://crm_user:crm_password@localhost:5432/crm_advocacia?schema=public"

# AUTH_SECRET: chave HS256 do cookie de sessão crm_sessao. Gere com `openssl rand -base64 32`.
AUTH_SECRET="troque-por-um-valor-aleatorio-gerado-com-openssl-rand-base64-32"

# Porta da API em dev/start local. Na Vercel quem define é a plataforma (PORT).
API_PORT=3001

AWS_ACCESS_KEY_ID="troque-pelo-access-key-do-usuario-iam"
AWS_SECRET_ACCESS_KEY="troque-pelo-secret-key-do-usuario-iam"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="troque-pelo-nome-do-bucket"
AWS_S3_PREFIX="development"
# AWS_S3_ENDPOINT: opcional. Vazio = S3 real da AWS. Preencha para um provedor
# S3-compatível (ex.: Supabase Storage) — exige credenciais e bucket desse provedor.
AWS_S3_ENDPOINT=""

# UAZAPI_SERVER_URL: URL base do servidor UAZAPI da conta (ex.: https://SEUSERVIDOR.uazapi.com).
UAZAPI_SERVER_URL="https://lucasklemke2.uazapi.com"
# UAZAPI_ADMIN_TOKEN: admintoken da conta UAZAPI — usado só server-side para criar instâncias.
UAZAPI_ADMIN_TOKEN="troque-pelo-admintoken-da-conta-uazapi"

# New Relic (opcional; só produção — docs/qualidade/observabilidade.md). Sem a
# license key o agente nem é carregado.
NEW_RELIC_LICENSE_KEY=""
NEW_RELIC_APP_NAME="crm-advocacia-api (local)"
```

- [ ] **Step 4: Teste do carregador de env (falha primeiro)**

`apps/api/src/config/carregar-env.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carregarEnvLocal } from "./carregar-env";

describe("carregarEnvLocal", () => {
  const original = { ...process.env };
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "crm-env-"));
    delete process.env.VERCEL;
    delete process.env.CRM_TESTE_A;
    delete process.env.CRM_TESTE_B;
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it("lê .env.local com prioridade sobre .env", () => {
    writeFileSync(join(dir, ".env"), "CRM_TESTE_A=do-env\nCRM_TESTE_B=so-no-env\n");
    writeFileSync(join(dir, ".env.local"), "CRM_TESTE_A=do-local\n");

    carregarEnvLocal(dir);

    expect(process.env.CRM_TESTE_A).toBe("do-local");
    expect(process.env.CRM_TESTE_B).toBe("so-no-env");
  });

  it("não sobrescreve variável já definida no ambiente", () => {
    process.env.CRM_TESTE_A = "do-ambiente";
    writeFileSync(join(dir, ".env"), "CRM_TESTE_A=do-arquivo\n");

    carregarEnvLocal(dir);

    expect(process.env.CRM_TESTE_A).toBe("do-ambiente");
  });

  it("não lê arquivo nenhum na Vercel", () => {
    process.env.VERCEL = "1";
    writeFileSync(join(dir, ".env"), "CRM_TESTE_A=do-arquivo\n");

    carregarEnvLocal(dir);

    expect(process.env.CRM_TESTE_A).toBeUndefined();
  });
});
```

Run: `npm test -w @crm/api -- carregar-env`
Expected: FAIL com `Cannot find module './carregar-env'`.

- [ ] **Step 5: Implementar**

`apps/api/src/config/carregar-env.ts`:

```ts
import { resolve } from "node:path";
import { config } from "dotenv";

// Dev e `npm start` local leem apps/api/.env.local e apps/api/.env. Na Vercel as
// variáveis vêm do Project e não existe arquivo .env no bundle, então não há
// nada a carregar.
export function carregarEnvLocal(diretorioDaApi: string): void {
  if (process.env.VERCEL) return;
  config({
    path: [resolve(diretorioDaApi, ".env.local"), resolve(diretorioDaApi, ".env")],
    quiet: true,
  });
}
```

Run: `npm test -w @crm/api -- carregar-env`
Expected: PASS (3 testes).

- [ ] **Step 6: Script de migration no deploy**

`apps/api/scripts/migrar-no-deploy.mjs`:

```js
// Roda no build da Vercel (npm run vercel-build). Aplica as migrations SÓ em
// produção: um build de preview nunca pode migrar o banco configurado no
// Project (hoje o mesmo de produção). Falha de migration falha o build, então
// a versão nova não é publicada sobre um schema incompatível.
import { spawnSync } from "node:child_process";

const ambiente = process.env.VERCEL_ENV ?? "indefinido";
if (ambiente !== "production") {
  console.log(`[migrations] VERCEL_ENV=${ambiente} — prisma migrate deploy ignorado`);
  process.exit(0);
}

console.log("[migrations] produção — aplicando migrations pendentes");
const resultado = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
process.exit(resultado.status ?? 1);
```

- [ ] **Step 7: `package.json` da API e da raiz**

`apps/api/package.json` (arquivo completo). Se as Fases 2–4 acrescentaram alguma dependência que não aparece aqui (ex.: `cookie-parser`), mantê-la. Conferir com `git diff apps/api/package.json` antes do commit:

```json
{
  "name": "@crm/api",
  "version": "0.2.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsup",
    "start": "node --enable-source-maps dist/main.js",
    "vercel-build": "prisma generate && node scripts/migrar-no-deploy.mjs && tsup",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.1115.0",
    "@aws-sdk/s3-request-presigner": "^3.1115.0",
    "@crm/compartilhado": "*",
    "@nestjs/common": "12.3.2",
    "@nestjs/core": "12.3.2",
    "@nestjs/platform-express": "12.3.2",
    "@prisma/client": "^6.19.3",
    "archiver": "^8.0.0",
    "bcrypt": "^6.0.0",
    "dotenv": "^17.4.2",
    "jose": "^6.1.0",
    "newrelic": "^13.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@nestjs/testing": "12.3.2",
    "@swc/core": "^1.13.0",
    "@swc/jest": "^0.2.39",
    "@types/archiver": "^8.0.0",
    "@types/bcrypt": "^6.0.0",
    "@types/express": "^5.0.3",
    "@types/jest": "^29.5.14",
    "@types/newrelic": "^9.14.8",
    "@types/supertest": "^6.0.3",
    "aws-sdk-client-mock": "^4.1.0",
    "jest": "^29.7.0",
    "prisma": "^6.19.3",
    "supertest": "^7.3.1",
    "tsup": "^8.5.0",
    "tsx": "^4.20.0"
  }
}
```

`package.json` (raiz, arquivo completo). As dependências de runtime saem da raiz: cada app declara as suas.

```json
{
  "name": "crm-advocacia",
  "version": "0.2.0",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=24" },
  "scripts": {
    "predev": "docker compose up -d",
    "dev": "concurrently -k -n api,web -c blue,green \"npm run dev -w @crm/api\" \"npm run dev -w @crm/web\"",
    "dev:tunnel": "concurrently -k -n dev,ngrok -c blue,green \"npm run dev\" \"ngrok http 5173 --log=stdout\"",
    "ngrok:start": "bash scripts/ngrok-start.sh",
    "ngrok:stop": "bash scripts/ngrok-stop.sh",
    "build": "npm run build -w @crm/api && npm run build -w @crm/web",
    "start": "concurrently -k -n api,web -c blue,green \"npm run start -w @crm/api\" \"npm run preview -w @crm/web\"",
    "lint": "eslint .",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm test --workspaces --if-present",
    "test:coverage": "npm run test:coverage --workspaces --if-present && node scripts/verificar-piso-cobertura.mjs",
    "e2e": "npm run build && playwright test",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "prisma:generate": "npm run prisma:generate -w @crm/api",
    "prisma:migrate": "npm run prisma:migrate -w @crm/api"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.0",
    "@playwright/test": "^1.62.1",
    "@types/node": "^24",
    "concurrently": "^10.0.5",
    "eslint": "^9.39.0",
    "eslint-plugin-jest": "^29.0.1",
    "eslint-plugin-jsx-a11y": "^6.10.2",
    "eslint-plugin-playwright": "^2.2.2",
    "eslint-plugin-react-hooks": "^7.0.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^16.4.0",
    "typescript": "^5.9.0",
    "typescript-eslint": "^8.46.0"
  }
}
```

Em `ngrok-start.sh`, trocar a porta `3000` por `5173`: `sed -i '' 's/3000/5173/g' scripts/ngrok-start.sh`. O web é a origem em dev e faz proxy de `/api`.

Em `.gitignore`, acrescentar ao fim:

```gitignore
# monorepo (apps/*, packages/*)
/apps/*/dist
/apps/*/coverage
/packages/*/coverage
/apps/api/.env
/apps/api/.env.local
```

e trocar a regra `!.env.example` por `!**/.env.example`.

- [ ] **Step 8: Verificar**

Run: `rm -rf node_modules apps/*/node_modules packages/*/node_modules && npm install`
Expected: instala sem erro, e o `postinstall` de `@crm/api` imprime `Generated Prisma Client`.

Run: `npm run db:up && npm run prisma:migrate -- --name verificacao_fase5 --create-only`
Expected: `Already in sync, no schema change or pending migration was found.` Nenhuma pasta nova em `apps/api/prisma/migrations`.

Run: `npm test` e `npm run typecheck`
Expected: tudo verde.

- [ ] **Step 9: Commit**

```bash
git add -A apps/api package.json package-lock.json .gitignore scripts/ngrok-start.sh prisma prisma.config.ts .env.example
git commit -m "chore(api): move Prisma, env e scripts de banco para apps/api"
```

---

### Task 5.4: Build de produção da API (tsup) e instrumentação New Relic

**Files:**
- Create: `apps/api/tsup.config.ts`, `apps/api/src/instrumentacao.ts`
- Modify: `apps/api/src/main.ts`

**Interfaces:**
- Consumes: `carregarEnvLocal` (Task 5.3), `configurarApp`/`AppModule` (Fase 1).
- Produces: `apps/api/dist/main.js` (ESM, um arquivo e sourcemap). É executável com `node dist/main.js`, escuta em `PORT ?? API_PORT ?? 3001` e serve `/api/*`.

- [ ] **Step 1: Configuração do tsup**

`apps/api/tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

// Build de produção da API. esbuild (via tsup):
// - resolve os aliases do tsconfig (@dominio/*) e o @crm/compartilhado;
// - deixa externas as dependências do package.json (Nest, Prisma, bcrypt, AWS SDK,
//   newrelic...), que a Vercel rastreia e empacota junto com a função;
// - emite decorators legados (experimentalDecorators). NÃO emite design:paramtypes:
//   a injeção é sempre por token explícito (@Inject(TOKEN)), ver docs/arquitetura/migracao-nestjs.md.
export default defineConfig({
  entry: { main: "src/main.ts" },
  format: ["esm"],
  platform: "node",
  target: "node24",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  bundle: true,
  // O compartilhado é só TypeScript-fonte (exports → .ts), então precisa ser embutido.
  noExternal: [/^@crm\//],
  tsconfig: "tsconfig.json",
});
```

- [ ] **Step 2: Instrumentação New Relic**

`apps/api/src/instrumentacao.ts`:

```ts
// Primeiro import do main.ts: o agente precisa ser carregado antes do Express e do
// @prisma/client para instrumentá-los (transações por rota e tempo de query).
// Sem NEW_RELIC_LICENSE_KEY (dev, CI, testes) o agente nem é importado.
// Configuração toda por env (NEW_RELIC_NO_CONFIG_FILE=true): ver
// docs/qualidade/observabilidade.md.
if (process.env.NEW_RELIC_LICENSE_KEY) {
  await import("newrelic");
}

export {};
```

- [ ] **Step 3: `main.ts` de produção**

`apps/api/src/main.ts` (arquivo completo; mantém o que a Fase 3 acrescentou ao `configurarApp`, que continua em `criar-app.ts`):

```ts
import "./instrumentacao";
import "reflect-metadata";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { carregarEnvLocal } from "./config/carregar-env";
import { configurarApp } from "./criar-app";

// src/main.ts (tsx) e dist/main.js (build) ficam ambos um nível abaixo de apps/api.
carregarEnvLocal(resolve(import.meta.dirname, ".."));

const app = configurarApp(await NestFactory.create(AppModule, { bufferLogs: false }));
// Na Vercel a plataforma define PORT; localmente vale API_PORT (padrão 3001).
const porta = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
await app.listen(porta);
console.log(`[api] ouvindo em http://localhost:${porta}/api`);
```

- [ ] **Step 4: Gerar o build e rodar sem tsx**

Run: `npm run build -w @crm/api && ls apps/api/dist`
Expected: `main.js  main.js.map`, sem erros do esbuild.

Run: `grep -c "@dominio\|@crm/compartilhado\|from \"tsx" apps/api/dist/main.js`
Expected: `0`. Os aliases foram resolvidos e o compartilhado foi embutido.

Run: `npm run start -w @crm/api` num terminal e, em outro, `curl -s localhost:3001/api/saude && curl -s -o /dev/null -w "%{http_code}\n" localhost:3001/api/status`
Expected: `{"ok":true}` e `401`. A rota de tenant exige sessão, o que mostra que guard e injeção por token funcionam no bundle. Encerrar o processo.

- [ ] **Step 5: Commit**

```bash
git add apps/api/tsup.config.ts apps/api/src/instrumentacao.ts apps/api/src/main.ts
git commit -m "build(api): bundle de produção com tsup e agente New Relic opcional"
```

---

### Task 5.5: Cobertura: piso institucional e testes dos schemas sem cobertura

As configurações de cobertura por app já foram escritas na Task 5.2. Esta task acrescenta a checagem do **piso institucional por grupo** (o `coverageThreshold` do Jest só mede por arquivo/glob, não o total do grupo) e os testes dos schemas que antes eram cobertos indiretamente pelos route handlers do Next e agora, isolados no compartilhado, ficariam a 0%.

**Files:**
- Create: `scripts/verificar-piso-cobertura.mjs`
- Create: `packages/compartilhado/src/schemas/cliente.test.ts`, `packages/compartilhado/src/schemas/comuns.test.ts`, `packages/compartilhado/src/schemas/status.test.ts`, `packages/compartilhado/src/schemas/instancia-whatsapp.test.ts`

**Interfaces:**
- Consumes: `coverage/coverage-summary.json` de cada pacote (reporter `json-summary`).
- Produces: `node scripts/verificar-piso-cobertura.mjs`, que sai com 1 se o backend (api + compartilhado) ficar abaixo de 75% de linhas ou o frontend (web) abaixo de 25%.

- [ ] **Step 1: Testes dos schemas**

`packages/compartilhado/src/schemas/cliente.test.ts`:

```ts
import { edicaoClienteSchema, novoClienteSchema } from "./cliente";

const valido = { nome: "Maria da Silva", cpf: "529.982.247-25" };

describe("novoClienteSchema", () => {
  it("aceita nome e CPF válidos, com opcionais vazios", () => {
    const r = novoClienteSchema.safeParse({ ...valido, email: "", telefone: "" });
    expect(r.success).toBe(true);
  });

  it("rejeita CPF inválido com mensagem por campo", () => {
    const r = novoClienteSchema.safeParse({ ...valido, cpf: "111.111.111-11" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({ path: ["cpf"] });
  });

  it("rejeita e-mail e telefone malformados", () => {
    const r = novoClienteSchema.safeParse({ ...valido, email: "sem-arroba", telefone: "123" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["email", "telefone"]);
  });

  it("rejeita nome curto", () => {
    expect(novoClienteSchema.safeParse({ ...valido, nome: "Jo" }).success).toBe(false);
  });
});

describe("edicaoClienteSchema", () => {
  it("aceita PATCH parcial (campos ausentes não mexem)", () => {
    expect(edicaoClienteSchema.safeParse({ profissao: "Professora" }).success).toBe(true);
  });
});
```

`packages/compartilhado/src/schemas/comuns.test.ts`:

```ts
import { nomeArquivoSchema } from "./comuns";

describe("nomeArquivoSchema (anti path traversal)", () => {
  it("aceita nome simples", () => {
    expect(nomeArquivoSchema.parse(" contrato.pdf ")).toBe("contrato.pdf");
  });

  it.each(["../etc/passwd", "pasta/arquivo.pdf", "pasta\\arquivo.pdf", ".oculto", ""])(
    "rejeita %p",
    (nome) => {
      expect(nomeArquivoSchema.safeParse(nome).success).toBe(false);
    }
  );
});
```

`packages/compartilhado/src/schemas/status.test.ts`:

```ts
import { CORES_STATUS_PERMITIDAS } from "../utils/cores-status";
import { ICONES_STATUS_PERMITIDOS } from "../utils/icones-status";
import { edicaoStatusSchema, novoStatusSchema } from "./status";

const valido = {
  nome: "Em análise",
  tipoStatusId: "0b8a4c2e-6f1d-4a3b-9c5e-7d2f1a0b3c4d",
  icone: ICONES_STATUS_PERMITIDOS[0],
  cor: CORES_STATUS_PERMITIDAS[0],
};

describe("novoStatusSchema", () => {
  it("aceita status com ícone e cor da lista permitida", () => {
    expect(novoStatusSchema.safeParse(valido).success).toBe(true);
  });

  it("rejeita ícone e cor fora da lista", () => {
    const r = novoStatusSchema.safeParse({ ...valido, icone: "nao-existe", cor: "#123456" });
    expect(r.error?.issues.map((i) => i.message).sort()).toEqual(["Cor inválida.", "Ícone inválido."]);
  });

  it("rejeita tipoStatusId que não é uuid", () => {
    expect(novoStatusSchema.safeParse({ ...valido, tipoStatusId: "abc" }).success).toBe(false);
  });
});

describe("edicaoStatusSchema", () => {
  it("aceita só a descrição (PATCH parcial)", () => {
    expect(edicaoStatusSchema.safeParse({ descricao: null }).success).toBe(true);
  });
});
```

`packages/compartilhado/src/schemas/instancia-whatsapp.test.ts`:

```ts
import { novaInstanciaWhatsappSchema } from "./instancia-whatsapp";

describe("novaInstanciaWhatsappSchema", () => {
  it("aceita nome e remove espaços", () => {
    expect(novaInstanciaWhatsappSchema.parse({ nome: "  Recepção " })).toEqual({ nome: "Recepção" });
  });

  it("rejeita nome vazio com a mensagem da UI", () => {
    const r = novaInstanciaWhatsappSchema.safeParse({ nome: "   " });
    expect(r.error?.issues[0]?.message).toBe("Nome é obrigatório");
  });
});
```

Run: `npm test -w @crm/compartilhado`
Expected: PASS. Se o CPF de exemplo não for válido para `cpfValido`, o primeiro teste falha. Nesse caso, trocar pelo CPF válido usado em `utils/cpf.test.ts`.

- [ ] **Step 2: Script do piso institucional**

`scripts/verificar-piso-cobertura.mjs`:

```js
// Piso institucional da linha Web Apps (docs/testes/estrategia-tdd.md): 75% de
// linhas no backend e 25% no frontend, medidos por GRUPO. O coverageThreshold do
// Jest mede por arquivo/glob; este script soma os totais de cada grupo.
// Roda depois de `npm run test:coverage --workspaces`.
import { readFileSync } from "node:fs";

const GRUPOS = [
  { nome: "backend", minimo: 75, resumos: ["apps/api", "packages/compartilhado"] },
  { nome: "frontend", minimo: 25, resumos: ["apps/web"] },
];

let falhou = false;
for (const { nome, minimo, resumos } of GRUPOS) {
  let cobertas = 0;
  let total = 0;
  for (const pacote of resumos) {
    const { total: t } = JSON.parse(readFileSync(`${pacote}/coverage/coverage-summary.json`, "utf8"));
    cobertas += t.lines.covered;
    total += t.lines.total;
  }
  const pct = total === 0 ? 0 : (cobertas / total) * 100;
  const ok = pct >= minimo;
  falhou ||= !ok;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}: ${pct.toFixed(2)}% de linhas (piso ${minimo}%) — ${resumos.join(" + ")}`);
}
process.exit(falhou ? 1 : 0);
```

- [ ] **Step 3: Rodar a cobertura completa**

Run: `npm run test:coverage`
Expected: as três suítes passam dentro dos thresholds e o script imprime `OK   backend: …%` (≥ 75) e `OK   frontend: …%` (≥ 25).

Se algum glob ficar abaixo da meta interna, o Jest lista o arquivo. Escrever o teste que falta para o comportamento dele (TDD), e nunca baixar o threshold.

- [ ] **Step 4: Commit**

```bash
git add scripts/verificar-piso-cobertura.mjs packages/compartilhado/src/schemas
git commit -m "test: piso de cobertura por grupo e testes dos schemas compartilhados"
```

---

### Task 5.6: ESLint do monorepo (sem `eslint-config-next`)

**Files:**
- Modify: `eslint.config.mjs` (raiz, reescrever)
- Delete: `apps/web/eslint.config.js` (se a Fase 4 tiver criado o do template do Vite)

**Interfaces:**
- Produces: `npm run lint` (raiz) cobrindo `apps/api`, `apps/web`, `packages/compartilhado` e `e2e`. As regras de fronteira entre pacotes valem como erro de lint.

- [ ] **Step 1: Escrever a configuração**

`eslint.config.mjs` (arquivo completo):

```js
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import jest from "eslint-plugin-jest";
import jsxA11y from "eslint-plugin-jsx-a11y";
import playwright from "eslint-plugin-playwright";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/coverage/**",
    "**/node_modules/**",
    "playwright-report/**",
    "test-results/**",
    "apps/api/prisma/migrations/**",
    // Gerados pelo shadcn CLI, nunca editados à mão (docs/app/design-system.md).
    "apps/web/src/components/ui/**",
  ]),

  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },

  // API + compartilhado + scripts: Node.
  {
    files: ["apps/api/**/*.{ts,mjs,cjs}", "packages/**/*.{ts,cjs}", "scripts/**/*.mjs", "*.{ts,mjs}"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  // Fronteiras entre pacotes (docs/app/estrutura-codigo.md — "Regra de fronteira").
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@prisma/client", "@prisma/*"], message: "O web não acessa o banco: use DTOs/enums de @crm/compartilhado." },
            { group: ["@dominio/*", "**/apps/api/**"], message: "O web fala com a API só por HTTP (lib/api-client)." },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/compartilhado/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@prisma/*", "@nestjs/*", "react", "react-*"], message: "O compartilhado é puro: sem Prisma, Nest ou React." },
            { group: ["@dominio/*", "@/*", "**/apps/**"], message: "O compartilhado não depende de nenhum app." },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/api/src/**/*.controller.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@dominio/repositories/*"], message: "Controller nunca chama Repository: passe pelo Service." }] },
      ],
    },
  },

  // Web: React, hooks e acessibilidade (RNF de acessibilidade em CLAUDE.md).
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
    languageOptions: {
      ...jsxA11y.flatConfigs.recommended.languageOptions,
      globals: { ...globals.browser },
    },
    plugins: {
      ...jsxA11y.flatConfigs.recommended.plugins,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // Testes: nenhum .only/.skip esquecido passa no CI (docs/testes/estrategia-tdd.md).
  {
    files: ["**/*.test.{ts,tsx}"],
    ...jest.configs["flat/recommended"],
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      ...jest.configs["flat/recommended"].rules,
      "jest/no-focused-tests": "error",
      "jest/no-disabled-tests": "error",
    },
  },
  {
    files: ["e2e/**/*.ts"],
    ...playwright.configs["flat/recommended"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      "playwright/no-focused-test": "error",
      "playwright/no-skipped-test": "error",
    },
  },
]);
```

- [ ] **Step 2: Remover configs antigas e rodar**

Run: `git rm -q --ignore-unmatch apps/web/eslint.config.js && npm install && npm run lint`
Expected: sem erros. Avisos (`warn`) são aceitos. Se aparecerem erros de regras novas (ex.: `jsx-a11y/label-has-associated-control`), corrigir o código apontado (são problemas reais de acessibilidade ou de fronteira) e rodar de novo.

Run: `echo 'import { prisma } from "@dominio/lib/prisma"; export const x = prisma;' > apps/web/src/violacao.ts && npm run lint; rm apps/web/src/violacao.ts`
Expected: o lint falha com `O web fala com a API só por HTTP`. Isso mostra que a regra de fronteira está ativa.

- [ ] **Step 3: Commit**

```bash
git add eslint.config.mjs package.json package-lock.json apps/web
git commit -m "chore(lint): ESLint do monorepo com regras de fronteira, a11y e testes"
```

---

### Task 5.7: Playwright contra o build de produção local

**Files:**
- Modify: `playwright.config.ts` (reescrever)

**Interfaces:**
- Consumes: `npm run start -w @crm/api` (`dist/main.js` em :3001) e `npm run preview -w @crm/web` (Vite preview em :4173). O `preview.proxy` herda o `server.proxy` da Fase 4 (`/api` → :3001), então o browser fala com uma única origem, como na Vercel.

- [ ] **Step 1: Reescrever a configuração**

`playwright.config.ts` (arquivo completo):

```ts
import { defineConfig, devices } from "@playwright/test";

// Fluxos críticos: docs/testes/estrategia-tdd.md. Roda contra o BUILD DE PRODUÇÃO
// (api em dist/main.js + web em vite preview), nunca contra o dev server: é o
// que prova que o bundle do tsup funciona sem tsx e sem decorator metadata.
// `npm run e2e` builda antes; no CI o build é um passo separado.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run start -w @crm/api",
      url: "http://localhost:3001/api/saude",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "npm run preview -w @crm/web -- --port 4173 --strictPort",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
```

- [ ] **Step 2: Conferir o proxy do preview**

Run: `grep -n "proxy" apps/web/vite.config.ts`
Expected: a entrada `server.proxy` com `"/api"` apontando para `http://localhost:3001` (Fase 4). O `vite preview` usa `server.proxy` quando não há `preview.proxy`, então não precisa de mudança. Se a Fase 4 definiu `preview.proxy` com outro alvo, alinhar para `http://localhost:3001`.

- [ ] **Step 3: Rodar**

Run: `npm run db:up && npm run e2e`
Expected: build dos dois apps e depois todos os specs de `e2e/` passando (`8 passed` ou o total atual), sem `flaky`.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts
git commit -m "test(e2e): Playwright contra o build de produção da api e do web"
```

---

### Task 5.8: CI no GitHub Actions e SonarCloud

**Files:**
- Create: `.github/workflows/ci.yml`, `sonar-project.properties`

**Interfaces:**
- Consumes: secret `SONAR_TOKEN` do repositório. Scripts `lint`, `typecheck`, `test:coverage`, `build`, `e2e` (raiz) e `prisma:deploy` (`@crm/api`).
- Produces: checks obrigatórios de PR `qualidade`, `testes`, `e2e` e `sonarcloud`.

- [ ] **Step 1: Workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [dev, main]
  push:
    branches: [dev, main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

# Valores só de CI (banco efêmero do service container); nada de produção aqui.
env:
  NODE_VERSION: "24"
  DATABASE_URL: postgresql://crm_user:crm_password@localhost:5432/crm_advocacia?schema=public
  DIRECT_URL: postgresql://crm_user:crm_password@localhost:5432/crm_advocacia?schema=public
  AUTH_SECRET: segredo-apenas-para-ci-nao-usar-em-producao-0000
  API_PORT: "3001"
  AWS_ACCESS_KEY_ID: ci
  AWS_SECRET_ACCESS_KEY: ci
  AWS_REGION: us-east-1
  AWS_S3_BUCKET: ci
  AWS_S3_PREFIX: ci
  UAZAPI_SERVER_URL: http://localhost:9
  UAZAPI_ADMIN_TOKEN: ci

jobs:
  qualidade:
    name: lint e typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  testes:
    name: testes com cobertura
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: crm_user
          POSTGRES_PASSWORD: crm_password
          POSTGRES_DB: crm_advocacia
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U crm_user"
          --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run prisma:deploy -w @crm/api
      # Thresholds por camada (jest.config de cada pacote) + piso por grupo
      # (scripts/verificar-piso-cobertura.mjs) — qualquer um abaixo falha o job.
      - run: npm run test:coverage
      - uses: actions/upload-artifact@v4
        with:
          name: cobertura
          path: |
            apps/api/coverage/lcov.info
            apps/web/coverage/lcov.info
            packages/compartilhado/coverage/lcov.info
          retention-days: 7

  e2e:
    name: e2e (build de produção)
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: crm_user
          POSTGRES_PASSWORD: crm_password
          POSTGRES_DB: crm_advocacia
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U crm_user"
          --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run prisma:deploy -w @crm/api
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7

  sonarcloud:
    name: SonarCloud
    needs: testes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0 # blame/new code precisam do histórico completo
      - uses: actions/download-artifact@v5
        with:
          name: cobertura
          path: .
      - uses: SonarSource/sonarqube-scan-action@v5
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

O `download-artifact` restaura os três `lcov.info` nos caminhos originais, porque o upload preserva a árvore relativa ao ancestral comum, a raiz.

- [ ] **Step 2: Propriedades do SonarCloud**

`sonar-project.properties`:

```properties
sonar.projectKey=LucasKlemke_crm-advocacia
sonar.organization=lucasklemke
sonar.projectName=CRM Advocacia

# Código-fonte: API (Nest + domínio), web (React) e o pacote compartilhado.
sonar.sources=apps/api/src,apps/web/src,packages/compartilhado/src
sonar.tests=apps/api/src,apps/web/src,packages/compartilhado/src,e2e
sonar.test.inclusions=**/*.test.ts,**/*.test.tsx,e2e/**/*.spec.ts
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,apps/api/prisma/migrations/**,apps/web/src/components/ui/**

# Mesmas exclusões de cobertura dos jest.config (bootstrap, wiring Nest, tipos).
sonar.coverage.exclusions=**/*.test.ts,**/*.test.tsx,e2e/**,apps/api/src/main.ts,apps/api/src/instrumentacao.ts,apps/api/src/**/*.module.ts,apps/api/src/**/tokens.ts,apps/api/src/dominio/lib/prisma.ts,apps/web/src/main.tsx,packages/compartilhado/src/tipos/**

sonar.javascript.lcov.reportPaths=apps/api/coverage/lcov.info,apps/web/coverage/lcov.info,packages/compartilhado/coverage/lcov.info
sonar.sourceEncoding=UTF-8
```

- [ ] **Step 3: Validar localmente**

Run: `npx --yes @action-validator/cli .github/workflows/ci.yml`
Expected: sem erros de schema.

Run: `npm ci && npm run lint && npm run typecheck && npm run test:coverage`
Expected: verde. É a mesma sequência dos jobs `qualidade` e `testes`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml sonar-project.properties
git commit -m "ci: pipeline com lint, typecheck, cobertura, e2e e SonarCloud"
```

Depois do primeiro push, em GitHub → Settings → Branches, exigir os checks `lint e typecheck`, `testes com cobertura`, `e2e (build de produção)` e `SonarCloud Code Analysis` em `dev` e `main`. Esse passo é manual e fica para o usuário.

---

### Task 5.9: Deploy na Vercel com Services (web + api no mesmo Project, por ambiente)

**Topologia:**

| Ambiente | Vercel Project (já existe) | Services no deployment | Banco / Storage |
|---|---|---|---|
| Produção acadêmica | `crm-advocacia-pac` | `web` (Vite estático) + `api` (NestJS, Fluid Compute) | RDS + S3 |
| Produção real | `crm-advocacia-supabase` | `web` + `api` | Supabase Postgres + Supabase Storage |

As rotas são as mesmas nos dois: `/api/*` vai para o service `api` (que recebe o path original e já tem prefixo global `api`) e o resto vai para `web`, com fallback de SPA para `index.html`. Mesma origem, então o cookie `crm_sessao` é first-party e não há CORS. Cada deployment publica web e api juntos, então rollback e preview são sempre coerentes.

**Files:**
- Create: `vercel.json`

**Interfaces:**
- Consumes: `npm run build -w @crm/web` (→ `apps/web/dist`), `npm run vercel-build -w @crm/api` (→ migrations em produção e `apps/api/dist/main.js`).

- [ ] **Step 1: Configuração**

`vercel.json` (raiz):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "web": {
      "root": "apps/web",
      "framework": "vite",
      "installCommand": "cd ../.. && npm ci",
      "buildCommand": "npm run build",
      "outputDirectory": "dist",
      "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
    },
    "api": {
      "root": "apps/api",
      "framework": "nestjs",
      "entrypoint": "dist/main.js",
      "installCommand": "cd ../.. && npm ci",
      "buildCommand": "npm run vercel-build"
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "api" } },
    { "source": "/(.*)", "destination": { "service": "web" } }
  ]
}
```

Notas:
- O `installCommand` sobe até a raiz porque o lockfile e os workspaces estão lá: `@crm/compartilhado` precisa estar linkado para os dois builds.
- O fallback de SPA fica **dentro** do service `web`. Arquivos estáticos existentes (`/assets/*`) são servidos antes do rewrite.
- O `entrypoint` aponta para o bundle do tsup, então a Vercel executa exatamente o artefato testado pelo e2e.

- [ ] **Step 2: Configurar os dois Projects (manual, com o usuário)**

Para cada Project (`crm-advocacia-pac` e `crm-advocacia-supabase`), em Settings → Build and Deployment:
- **Root Directory:** `.` (a raiz do repositório, onde está o `vercel.json`).
- **Framework Preset:** "Other". O `framework` de cada service vem do `vercel.json`.
- **Build/Install/Output overrides:** desligados. Hoje há `next build`; remover qualquer override.
- **Node.js Version:** 24.x.

Variáveis de ambiente (Settings → Environment Variables), valendo para os dois services do Project:

| Variável | `crm-advocacia-pac` | `crm-advocacia-supabase` | Ambientes |
|---|---|---|---|
| `DATABASE_URL` | RDS :5432 | Supavisor transaction :6543 `?pgbouncer=true` | Production (+ Preview só se houver banco de preview) |
| `DIRECT_URL` | igual a `DATABASE_URL` | Supavisor session :5432 | idem |
| `AUTH_SECRET` | valor próprio (`openssl rand -base64 32`) | valor próprio | Production, Preview |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM do bucket S3 | S3 Connection do Supabase Storage | Production, Preview |
| `AWS_REGION` / `AWS_S3_BUCKET` | região/bucket S3 | região Supabase / `arquivos` | Production, Preview |
| `AWS_S3_ENDPOINT` | — | endpoint S3 do Supabase Storage | Production, Preview |
| `AWS_S3_PREFIX` | `production` (Preview: `preview`) | idem | Production, Preview |
| `UAZAPI_SERVER_URL` / `UAZAPI_ADMIN_TOKEN` | conta UAZAPI | conta UAZAPI | Production, Preview |
| `NEW_RELIC_LICENSE_KEY` | license key | license key | Production |
| `NEW_RELIC_APP_NAME` | `crm-advocacia-api (pac)` | `crm-advocacia-api (supabase)` | Production |
| `NEW_RELIC_NO_CONFIG_FILE` | `true` | `true` | Production |
| `NEW_RELIC_LOG` | `stdout` | `stdout` | Production |
| `NEW_RELIC_DISTRIBUTED_TRACING_ENABLED` | `true` | `true` | Production |
| `NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED` | `true` | `true` | Production |

Remover `NEXTAUTH_SECRET` e `NEXTAUTH_URL` dos dois Projects depois que o primeiro deploy novo estiver no ar.

Comandos de apoio (no diretório do repo, um Project por vez):

```bash
vercel link --project crm-advocacia-pac --scope lucas-klemkes-projects --yes
vercel env add AUTH_SECRET production
vercel env add NEW_RELIC_LICENSE_KEY production
vercel env rm NEXTAUTH_SECRET production --yes
vercel env rm NEXTAUTH_URL production --yes
vercel env ls
```

- [ ] **Step 3: Spike de go/no-go (preview)**

Run: `vercel link --project crm-advocacia-pac --scope lucas-klemkes-projects --yes && vercel build && ls .vercel/output && cat .vercel/output/config.json | head -40`
Expected:
- o build local dos dois services termina sem erro;
- `.vercel/output` contém o estático do web e uma função para `api`;
- `config.json` tem as rotas `/api/(.*)` e o catch-all.

Se a CLI recusar `services` (plano/beta) ou o `entrypoint: dist/main.js`, ir para o **plano B** (Step 6).

Run: `vercel deploy --prebuilt` e, com a URL de preview impressa (`$URL`):
`curl -s "$URL/api/saude"` e `curl -s -o /dev/null -w "%{http_code}\n" "$URL/clientes"`
Expected: `{"ok":true}` e `200` (o deep link resolve para o `index.html`). Previews com Deployment Protection exigem estar logado ou usar `vercel curl`.

Teste manual no preview: cadastrar, logar, criar cliente e subir um documento (S3 com URL assinada) no deploy acadêmico. Confirmar no DevTools que o cookie `crm_sessao` é `HttpOnly; Secure; SameSite=Lax` e que não há requisição cross-origin.

- [ ] **Step 4: Migrations e rollback**

As migrations rodam no `vercel-build` do service `api`, **somente** com `VERCEL_ENV=production`, contra o banco do Project (`DIRECT_URL`). Se a migration falhar, o build falha e nada é publicado.

Para o rollback, `vercel rollback` (ou "Instant Rollback" no painel) volta web+api juntos, por Project. O schema **não** volta. Por isso toda mudança de schema segue expand/contract: a migration só acrescenta, e a remoção de colunas e tabelas vai num PR posterior. Assim o código anterior continua compatível com o schema migrado (ver `docs/database/migrations-prisma.md`).

- [ ] **Step 5: Commit**

```bash
git add vercel.json
git commit -m "chore(deploy): Vercel Services com web e api no mesmo Project por ambiente"
```

- [ ] **Step 6 (só se o spike reprovar): Plano B — dois Projects por ambiente**

Criar `crm-advocacia-pac-api` e `crm-advocacia-supabase-api` (Root Directory `apps/api`) e repontar os Projects atuais para o web (Root Directory `apps/web`). As variáveis de banco, S3, UAZAPI, AUTH e New Relic migram para os Projects `-api`. Os Projects web recebem só `API_ORIGEM` (ex.: `https://crm-advocacia-pac-api.vercel.app`). Apagar `vercel.json` da raiz e criar:

`apps/web/vercel.ts`:

```ts
import { routes, type VercelConfig } from "@vercel/config/v1";

// Plano B (sem Vercel Services): o web faz proxy de /api/* para o Project da API,
// mantendo mesma origem no browser (cookie first-party, sem CORS).
// API_ORIGEM é definida por Project e por ambiente (Production/Preview).
const apiOrigem = process.env.API_ORIGEM;
if (!apiOrigem) {
  throw new Error("API_ORIGEM não definida neste Project (ex.: https://crm-advocacia-pac-api.vercel.app)");
}

export const config: VercelConfig = {
  framework: "vite",
  installCommand: "cd ../.. && npm ci",
  buildCommand: "npm run build",
  outputDirectory: "dist",
  rewrites: [
    routes.rewrite("/api/(.*)", `${apiOrigem}/api/$1`),
    routes.rewrite("/(.*)", "/index.html"),
  ],
};
```

`apps/api/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nestjs",
  "installCommand": "cd ../.. && npm ci",
  "buildCommand": "npm run vercel-build"
}
```

A detecção zero-config da Vercel procura `src/main.ts` antes de qualquer outro entrypoint e o compilaria por conta própria, sem resolver `@dominio/*`. Para usar o bundle, renomear `apps/api/src/main.ts` para `apps/api/src/servidor.ts` e, no `tsup.config.ts`, trocar `entry: { main: "src/main.ts" }` por `entry: { server: "src/servidor.ts" }` e `outDir: "dist"` por `outDir: "."` com `clean: false`. O resultado é `apps/api/server.js`, que está na lista de detecção (`server.{js,mjs}`). Ajustar `start` para `node --enable-source-maps server.js` e acrescentar `/apps/api/server.js*` ao `.gitignore`.

Instalar `npm i -D @vercel/config -w @crm/web`. O custo do plano B: previews do web apontam para a `API_ORIGEM` de Preview (definir uma api de preview fixa) e o rollback precisa ser feito nos dois Projects, api primeiro.

Commit: `chore(deploy): plano B com Projects separados para web e api`.

---

### Task 5.10: Documentação

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/README.md`, `docs/app/estrutura-codigo.md`, `docs/deploy/deploy.md`, `docs/arquitetura/visao-geral.md`, `docs/arquitetura/migracao-nestjs.md`, `docs/testes/estrategia-tdd.md`, `docs/qualidade/analise-estatica.md`, `docs/qualidade/observabilidade.md`, `docs/database/migrations-prisma.md`, `docs/database/docker-setup.md`

- [ ] **Step 1: `CLAUDE.md`**

Substituir o parágrafo de abertura ("Este projeto ainda não possui código-fonte implementado…") por:

```markdown
Monorepo npm com a API em NestJS (`apps/api`), o front em React + Vite (`apps/web`) e o código puro compartilhado entre os dois (`packages/compartilhado`). Este arquivo é a especificação do produto, evoluída a partir do RFC original do projeto (PAC Extensionista VII — Engenharia de Software, Católica SC). RFC original (base): https://github.com/LucasKlemke/PAC-Extensionista-VII---RFC---CRM-Advocacia/blob/main/README.md
```

No bloco "Documentação completa", trocar "estrutura do app Next.js" por "estrutura do monorepo (API Nest, web React, pacote compartilhado)".

Substituir a seção `## Stack tecnológica` inteira por:

```markdown
## Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Backend (API) | NestJS 12 (ESM, Express 5) + TypeScript — `apps/api`; build de produção com tsup (esbuild) |
| Frontend | React 19 + Vite + React Router v7 + TypeScript — `apps/web` (SPA) |
| Código compartilhado | `@crm/compartilhado` (`packages/compartilhado`): DTOs, schemas Zod, enums e utilitários puros |
| Estado assíncrono no cliente | TanStack Query (React Query) |
| Estilo | Tailwind CSS |
| Autenticação | Sessão própria da API: cookie httpOnly `crm_sessao` (JWT HS256 via `jose`, `AUTH_SECRET`); `role` sempre lido do banco |
| Validação | Zod — mesmos schemas no formulário (web) e no pipe da API |
| Banco de dados | PostgreSQL + Prisma ORM (`apps/api/prisma`) — RDS (deploy acadêmico) ou Supabase (deploy real), mesmo schema, ver [docs/deploy/deploy.md](docs/deploy/deploy.md) |
| Armazenamento de arquivos | S3 ou provedor S3-compatível (URL assinada) — Amazon S3 (deploy acadêmico) ou Supabase Storage (deploy real) |
| Jobs assíncronos | AWS Lambda + Amazon EventBridge Scheduler (ainda não implementado) |
| WhatsApp | Uazapi (API não-oficial via QR Code, apenas envio) |
| Hosting | Vercel com Services: cada Project de produção publica `web` (estático) + `api` (Fluid Compute) na mesma origem — ver [docs/deploy/deploy.md](docs/deploy/deploy.md) |
| CI/CD | GitHub Actions (lint, typecheck, cobertura, e2e, SonarCloud) |
| Análise estática | ESLint (flat config do monorepo) + SonarCloud |
| Monitoramento | New Relic (agente Node na API) |
| Testes | Jest + `@swc/jest` (+ supertest na API, Testing Library no web) e Playwright (E2E contra o build de produção) |
| Componentes de UI | shadcn/ui sobre Tailwind, sempre via tokens de tema — ver [docs/app/design-system.md](docs/app/design-system.md) |
```

Substituir a seção `## Arquitetura (camadas do backend)` até antes de `Serviço assíncrono separado` por:

```markdown
## Arquitetura (camadas do backend)

O browser fala com uma única origem: `/api/*` vai para a API Nest, o resto para a SPA (proxy do Vite em dev, Vercel Services em produção). Todo request da API segue: **Auth (TenantGuard) → Tenant Context → Controller → Service → Repository** (persistência), ou **Service → Cliente Externo** (integrações).

- **Auth / TenantGuard** (`apps/api/src/comum/tenant`): lê e valida o cookie `crm_sessao` e resolve `usuarioId` + `escritorioId`; o `role` vem sempre do banco (RN19). Toda rota de tenant usa `@UseGuards(TenantGuard)` + `@Tenant() ctx`.
- **Tenant Context**: o `TenantContext` produzido pelo guard é o único jeito de chamar um Service — nenhum Repository é chamado sem ele.
- **Controllers** (Nest, `apps/api/src/<modulo>/*.controller.ts`): recebem HTTP, validam com `ValidacaoZodPipe(schema)` (schemas de `@crm/compartilhado/schemas`), delegam a Services e traduzem erros com `ErrosHttpFilter`. Nunca importam Repository (regra de lint).
- **Services** (`apps/api/src/dominio/services`): regras de negócio (isolamento entre tenants, CPF único por escritório, papéis, templates, retentativas etc.). Entram no container do Nest por token (`useValue` + `@Inject(TOKEN)`).
- **Repositories** (`apps/api/src/dominio/repositories`, Prisma): único ponto de acesso ao banco; toda query filtra por `escritorio_id`.
- **Clientes externos** (`apps/api/src/dominio/lib/external`): `UazapiClient` (WhatsApp), `S3Client` (documentos), `EmailClient` (SMTP).
- **Front** (`apps/web`): componentes → hooks TanStack Query (`hooks/`) → `apiFetch` (`lib/api-client.ts`) → `/api/*`. Nunca importa `@prisma/client` nem código da API (regra de lint); compartilha só `@crm/compartilhado`.
```

Inserir depois da seção de arquitetura:

```markdown
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
| `npm run dev` | Postgres (Docker) + API em :3001 (`tsx watch`) + web em :5173 (proxy `/api`) |
| `npm test` / `npm run test:coverage` | Jest de todos os pacotes / com cobertura + piso institucional |
| `npm run lint` / `npm run typecheck` | ESLint do monorepo / `tsc --noEmit` em cada pacote |
| `npm run build` / `npm start` | `apps/api/dist/main.js` (tsup) + `apps/web/dist` / serve os dois builds |
| `npm run e2e` | Build + Playwright contra o build de produção |
| `npm run prisma:migrate` | `prisma migrate dev` em `apps/api` |
```

Na seção `## Desenvolvimento: testes e Git`, substituir o primeiro bullet por:

```markdown
- **Test-driven**: toda regra de negócio ou componente com lógica tem teste escrito antes da implementação, ao lado do arquivo (`*.test.ts(x)`). Meta de cobertura institucional (linha Web Apps do Portfólio, cobrada na prova de autoria): **75% backend (`apps/api` + `packages/compartilhado`) / 25% frontend (`apps/web`)**, conferida por `scripts/verificar-piso-cobertura.mjs`; metas internas por camada nos `jest.config.cjs` de cada pacote (Services ~90%, Repositories/Controllers ~70-80%), gate de CI. Ferramentas: Jest + `@swc/jest` (supertest na API, Testing Library no web) e Playwright (E2E contra o build de produção). Detalhes em [docs/testes/estrategia-tdd.md](docs/testes/estrategia-tdd.md).
```

E no bullet **Estrutura de código e UI**, trocar "convenções de pastas/nomes por camada" por "convenções de pastas/nomes por pacote e camada (API Nest, domínio, web, compartilhado)".

Apagar do fim do arquivo o bloco `# This is NOT the Next.js you know` inteiro. Era gerado pelo `next dev`, que não existe mais no projeto.

- [ ] **Step 2: `README.md` (arquivo completo)**

```markdown
# CRM Advocacia

CRM multi-tenant para escritórios de advocacia. Visão de produto, stack e regras de negócio: **[CLAUDE.md](CLAUDE.md)**. Documentação técnica detalhada por área: **[docs/README.md](docs/README.md)**.

## Contexto acadêmico

> **Projeto sem fins lucrativos.** Este é um projeto de portfólio desenvolvido como **Trabalho de Conclusão de Curso (TCC) — 2026, 8º semestre**, no **Centro Universitário Católica de Santa Catarina**, por Lucas Affonso Klemke.

Não há qualquer finalidade comercial: o sistema não é vendido, licenciado ou monetizado. Ele nasceu de uma necessidade real (o escritório do Dr. Lucas Quintino, OAB/SC 71.025) e é mantido exclusivamente como exercício acadêmico e demonstração técnica de portfólio.

## Arquitetura em uma linha

Monorepo npm: API **NestJS** (`apps/api`, com o domínio e o Prisma), SPA **React + Vite** (`apps/web`) e o pacote **`@crm/compartilhado`** (DTOs, schemas Zod, enums). Em produção os dois apps sobem no mesmo Project da Vercel (Services), na mesma origem. Detalhes em [docs/arquitetura/visao-geral.md](docs/arquitetura/visao-geral.md).

## Setup local

Pré-requisitos: Node.js 24+, Docker (para o Postgres local) e npm.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # DATABASE_URL já aponta para o docker-compose; gere AUTH_SECRET com `openssl rand -base64 32`
docker compose up -d                     # Postgres local (docs/database/docker-setup.md)
npm run prisma:migrate                   # aplica migrations e gera o client
npm run dev                              # API em :3001 + web em :5173
```

O app fica disponível em [http://localhost:5173](http://localhost:5173). O Vite encaminha `/api/*` para a API.

## Scripts (raiz)

| Comando | Descrição |
|---|---|
| `npm run dev` | API (`tsx watch`) + web (Vite) em desenvolvimento |
| `npm run build` / `npm start` | Build de produção (api: tsup → `apps/api/dist`; web: `apps/web/dist`) / servir os dois builds |
| `npm run lint` / `npm run typecheck` | ESLint do monorepo / checagem de tipos de cada pacote |
| `npm test` / `npm run test:coverage` | Jest em todos os pacotes / com cobertura e piso institucional (75% backend, 25% frontend) |
| `npm run e2e` | Playwright contra o build de produção — ver [docs/testes/estrategia-tdd.md](docs/testes/estrategia-tdd.md) |
| `npm run prisma:generate` / `npm run prisma:migrate` | Prisma client / migrations em `apps/api/prisma` — ver [docs/database/migrations-prisma.md](docs/database/migrations-prisma.md) |

## Estrutura

Layout de pastas e regras de fronteira entre pacotes em [docs/app/estrutura-codigo.md](docs/app/estrutura-codigo.md). Fluxo de branches/commits em [docs/git/commits-e-branches.md](docs/git/commits-e-branches.md); deploy em [docs/deploy/deploy.md](docs/deploy/deploy.md).
```

- [ ] **Step 3: `docs/app/estrutura-codigo.md` (arquivo completo)**

A árvore de `apps/web/src` abaixo segue a estrutura criada na Fase 4. Antes de commitar, conferir com `ls apps/web/src` e alinhar os nomes das pastas de página se forem diferentes.

```markdown
# Estrutura de Código — Monorepo (API NestJS + Web React + Compartilhado)

Mapeia as camadas definidas em [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md) (Auth/TenantGuard → Tenant Context → Controller → Service → Repository) para pacotes, pastas e arquivos concretos. Ver também [design-system.md](design-system.md) e [modularizacao.md](modularizacao.md) para as regras de UI, e [../arquitetura/migracao-nestjs.md](../arquitetura/migracao-nestjs.md) para o histórico da migração a partir do Next.js.

## Pacotes

```
apps/
├── api/                          # @crm/api — NestJS 12 (ESM)
│   ├── prisma/                   # schema.prisma + migrations/ (histórico auditável)
│   ├── prisma.config.ts
│   ├── tsup.config.ts            # build de produção → dist/main.js
│   ├── scripts/migrar-no-deploy.mjs
│   └── src/
│       ├── main.ts               # bootstrap (instrumentação → env → Nest → listen)
│       ├── instrumentacao.ts     # agente New Relic (só com license key)
│       ├── criar-app.ts          # prefixo /api, filtros, cookies — compartilhado com os testes
│       ├── app.module.ts
│       ├── comum/                # TenantGuard, @Tenant(), ErrosHttpFilter, ValidacaoZodPipe, sessão
│       ├── config/               # carregarEnvLocal
│       ├── <modulo>/             # um por grupo de rota: clientes, casos, status, campanhas, ...
│       │   ├── <modulo>.module.ts
│       │   ├── <modulo>.controller.ts (+ .test.ts com supertest)
│       │   └── tokens.ts         # tokens de injeção dos services do domínio
│       └── dominio/              # regras de negócio — independentes do Nest
│           ├── services/         # <entidade>.service.ts (+ .test.ts)
│           ├── repositories/     # <entidade>.repository.ts (+ .test.ts contra Postgres real)
│           └── lib/
│               ├── api/          # tradutores de erro, serializadores, payloads
│               ├── auth/         # sessão (jose), escritório ativo, resolver de tenant
│               ├── external/     # UazapiClient, S3Client, EmailClient
│               ├── documentos/   # zip, URLs públicas
│               ├── utils/        # utilitários só do back (diff, período de evento)
│               └── prisma.ts     # instância única do PrismaClient
└── web/                          # @crm/web — React 19 + Vite + React Router v7
    └── src/
        ├── main.tsx              # monta router + QueryClientProvider
        ├── rotas.tsx             # árvore de rotas (públicas, onboarding, dashboard)
        ├── paginas/              # uma pasta por tela (clientes, casos, agenda, configuracoes, ...)
        ├── components/
        │   ├── ui/               # shadcn/ui (gerados via CLI)
        │   ├── shell/            # AppSidebar, NavUsuario, EscritorioSwitcher
        │   └── <modulo>/         # componentes de feature
        ├── hooks/                # use-<entidade>.ts — TanStack Query
        └── lib/
            ├── api-client.ts     # apiFetch + ApiError
            ├── query/            # query keys e opções padrão
            ├── utils/            # utilitários só do front (datas, agenda, CSV, formatação)
            └── utils.ts          # cn()
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

Dentro de `apps/api/src` (camada Nest) e dentro do compartilhado, imports entre arquivos do mesmo pacote são relativos. O alias `@dominio/` marca explicitamente o acesso da camada Nest ao domínio.

## Convenção de nomes por entidade

| Camada | Padrão de arquivo | Exemplo |
|---|---|---|
| Controller (Nest) | `apps/api/src/<modulo>/<entidade>.controller.ts` | `apps/api/src/clientes/clientes.controller.ts` |
| Service | `apps/api/src/dominio/services/<entidade>.service.ts` | `cliente.service.ts` |
| Repository | `apps/api/src/dominio/repositories/<entidade>.repository.ts` | `cliente.repository.ts` |
| Schema Zod | `packages/compartilhado/src/schemas/<entidade>.ts` | `schemas/cliente.ts` |
| DTO | `packages/compartilhado/src/tipos/<entidade>.ts` | `tipos/cliente.ts` |
| Hook de dados (web) | `apps/web/src/hooks/use-<entidade>.ts` | `use-clientes.ts` |

## Tenant Context na prática

Toda rota de tenant declara `@UseGuards(TenantGuard)` e recebe `@Tenant() ctx: TenantContext`. O guard lê o cookie `crm_sessao`, valida o JWT e resolve a membership no banco (o `role` nunca vem do token). O controller repassa `ctx` ao Service como primeiro parâmetro, e o Service nunca busca o tenant sozinho nem confia em `escritorioId` vindo do corpo da requisição. Ver [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md#isolamento-de-tenant-defesa-em-profundidade).

Services e repositories do domínio são objetos (não classes) e entram no Nest por token: `{ provide: CLIENTE_SERVICE, useValue: clienteService }` + `@Inject(CLIENTE_SERVICE)`. Isso dispensa `emitDecoratorMetadata`, que o build com esbuild não gera, e permite `overrideProvider` nos testes.

## TanStack Query no web

- Hooks de query/mutation ficam em `apps/web/src/hooks/`, um arquivo por entidade, nunca `useQuery`/`useMutation` solto numa página.
- Query keys seguem `[entidade, ...filtros]` e ficam centralizadas em `lib/query/chaves.ts` para invalidação previsível.
- Toda chamada HTTP passa por `apiFetch` (`lib/api-client.ts`), que centraliza base URL relativa (`/api`), credenciais e o erro tipado `ApiError` (`status`, `detalhes` por campo).
- Em testes de componente, `renderComQuery` (`lib/test-utils.tsx`) envolve a árvore num `QueryClientProvider` com `retry: false`.

## Regra de fronteira (não negociável — verificada pelo ESLint)

- `apps/web` nunca importa `@prisma/client` nem código da API. O único caminho de uma tela até o banco é: componente → hook → `apiFetch` → `/api/*` → Controller → Service → Repository.
- `packages/compartilhado` não importa nenhum app, nem Prisma, Nest ou React. Só TypeScript puro + Zod.
- Controllers nunca importam Repositories, sempre passam pelo Service.
- Código novo usado pelos dois lados vai para o compartilhado. Usado por um lado só, fica no app dele.
```

- [ ] **Step 4: `docs/deploy/deploy.md` (arquivo completo)**

```markdown
# Deploy

Instruções de deploy exigidas pela documentação mínima da linha Web Apps ([directions-webapp.md](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-webapp.md)). Complementa [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md) (decisão de stack) e [../database/docker-setup.md](../database/docker-setup.md) (banco local).

## Por que dois deploys de produção

O curso (PAC Extensionista VII, Católica SC) exige um ambiente público e estável, mas **não permite Supabase** como parte da stack avaliada. Ao mesmo tempo, o produto nasceu de uma necessidade real (escritório do Dr. Lucas Quintino) e a versão que vai pro cliente final prioriza velocidade/DX, o que torna Supabase a escolha certa para produção de verdade. O projeto mantém **os dois em paralelo**, a partir do mesmo código-fonte:

| Deploy (Vercel Project) | Backend | Público |
|---|---|---|
| `crm-advocacia-pac` | Amazon RDS (PostgreSQL) + Amazon S3 | Avaliação acadêmica (professor/banca) |
| `crm-advocacia-supabase` | Supabase (PostgreSQL) + Supabase Storage | Cliente final / produção real |

Nenhum dos dois é "o ambiente de teste do outro". Ambos rodam a mesma `main`, migrada e com dados próprios. O que muda entre eles é o par de banco e bucket configurado por variável de ambiente, nunca o código.

## Topologia: um Project por ambiente, dois services por deployment

Cada Project usa **Vercel Services** (`vercel.json` na raiz). Todo deployment publica juntos:

| Service | Raiz | Framework | Build | Executa como |
|---|---|---|---|---|
| `web` | `apps/web` | Vite | `npm run build` → `dist/` | Estático na CDN, com fallback de SPA para `index.html` |
| `api` | `apps/api` | NestJS | `npm run vercel-build` → `dist/main.js` (tsup) | Uma Vercel Function em Fluid Compute |

Rotas públicas (ordem importa): `/api/*` vai para `api`, que recebe o path original e usa o prefixo global `api` do Nest, e todo o resto vai para `web`. Consequências:
- **Mesma origem**: o cookie de sessão `crm_sessao` (httpOnly, Secure, SameSite=Lax) é first-party, sem CORS e sem cookie cross-site.
- **Deploy e rollback atômicos**: web e api de um deployment sempre são da mesma versão. Nunca há front novo falando com API velha.
- **Preview coerente**: cada PR ganha um preview com o próprio web e a própria api.

Os dois Projects apontam pro mesmo repositório (`LucasKlemke/crm-advocacia`), com `main` como Production Branch e Root Directory `.`. Um push em `main` dispara os dois builds. Nenhuma lógica de aplicação faz `if (ambiente === 'aws')`: a escolha de backend acontece inteiramente nas env vars.

## S3Client compatível com múltiplos provedores

`apps/api/src/dominio/lib/external/s3-client.ts` é o único ponto de contato com armazenamento de arquivos (RN17/RN18). O mesmo client usa o `@aws-sdk/client-s3` apontado para um endpoint customizável:

- **Sem `AWS_S3_ENDPOINT`**: endpoint padrão da AWS (deploy acadêmico).
- **Com `AWS_S3_ENDPOINT`**: o client usa esse endpoint com `forcePathStyle: true`, funcionando contra qualquer storage S3-compatível. É assim que o deploy de produção real aponta pro Supabase Storage (`https://<project-ref>.storage.supabase.co/storage/v1/s3`), com Access Key/Secret de Supabase → Storage → S3 Connection.

## Prisma: `DATABASE_URL` vs `DIRECT_URL`

`apps/api/prisma/schema.prisma` declara as duas (e `binaryTargets = ["native", "rhel-openssl-3.0.x"]` para o runtime das Functions):

- **RDS (deploy acadêmico)**: sem pooler. `DATABASE_URL` e `DIRECT_URL` apontam pro mesmo host, porta 5432.
- **Supabase (deploy real)**: `DATABASE_URL` usa o pooler **transaction** do Supavisor (porta `6543`, `?pgbouncer=true`) no runtime. `DIRECT_URL` usa o pooler **session** (porta `5432`) para `prisma migrate deploy`. O endpoint direto (`db.<ref>.supabase.co`) só resolve em IPv6 e não é alcançável do build da Vercel. Usar sempre `*.pooler.supabase.com`.

## Variáveis de ambiente (por Vercel Project, valem para os dois services)

| Variável | `crm-advocacia-pac` (AWS) | `crm-advocacia-supabase` |
|---|---|---|
| `DATABASE_URL` | RDS, porta 5432 | Supavisor transaction, 6543, `?pgbouncer=true` |
| `DIRECT_URL` | igual a `DATABASE_URL` | Supavisor session, 5432 |
| `AUTH_SECRET` | valor próprio | valor próprio |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM user com acesso ao bucket | Access Key/Secret do Supabase Storage |
| `AWS_REGION` | região do bucket S3 | região do projeto Supabase |
| `AWS_S3_BUCKET` | nome do bucket S3 | `arquivos` |
| `AWS_S3_ENDPOINT` | não definida | endpoint S3-compatível do Supabase Storage |
| `AWS_S3_PREFIX` | `production` | `production` |
| `UAZAPI_SERVER_URL` / `UAZAPI_ADMIN_TOKEN` | conta UAZAPI do desenvolvedor | mesma conta |
| `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_APP_NAME`, `NEW_RELIC_NO_CONFIG_FILE=true`, `NEW_RELIC_LOG=stdout`, `NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true`, `NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED=true` | Production | Production |

O web não tem segredos: o Vite só embute variáveis `VITE_*`, e nenhuma é usada. Localmente as variáveis ficam em `apps/api/.env` / `apps/api/.env.local` (fora do git, com `apps/api/.env.example` como referência).

Variáveis de **Preview**: as de banco só devem existir em Preview se apontarem para um banco de preview próprio. Sem `DATABASE_URL` de Preview, o preview sobe mas as rotas que tocam o banco falham.

## Pipeline de deploy

1. **Push/PR** (base `dev` ou `main`): GitHub Actions roda lint, typecheck, `npm run test:coverage` (thresholds por camada e piso institucional), Playwright contra o build de produção e o scan do SonarCloud. Ver [../qualidade/analise-estatica.md](../qualidade/analise-estatica.md).
2. **Merge em `main`** (via PR, squash): a Vercel builda os dois Projects em paralelo.
3. **Build de cada Project**: o service `web` roda `vite build`. O service `api` roda `npm run vercel-build` = `prisma generate` → `scripts/migrar-no-deploy.mjs` → `tsup`. O script aplica `prisma migrate deploy` **somente quando `VERCEL_ENV=production`**, no banco daquele Project. Previews nunca migram. Migration que falha derruba o build e nada é publicado.
4. A Vercel publica o deployment (web na CDN, api como Function). Deployments anteriores ficam disponíveis para rollback instantâneo.

## Rollback

- **Aplicação**: `vercel rollback` ou "Instant Rollback" no painel, por Project. Volta **web e api juntos**.
- **Banco**: migrations não têm rollback automático. Toda mudança de schema segue **expand/contract**: a migration do PR só acrescenta (coluna nullable, tabela nova), e a remoção do que ficou obsoleto entra num PR posterior. Assim, voltar o app para o deployment anterior nunca o deixa incompatível com o schema já migrado. Reverter um schema de fato exige uma migration corretiva nova. Ver [../database/migrations-prisma.md](../database/migrations-prisma.md).

## Observabilidade pós-deploy

Todo deploy em produção é acompanhado pelo New Relic (latência, taxa de erro por rota da API) e pelos Runtime Logs/Observability da Vercel. Ver [../qualidade/observabilidade.md](../qualidade/observabilidade.md). Um pico de erro logo após deploy é o primeiro sinal para rollback. O `NotificacaoScheduler` (Lambda + EventBridge) ainda não está implementado em nenhum dos dois ambientes.
```

- [ ] **Step 5: `docs/arquitetura/visao-geral.md`**

Substituir a tabela `## Containers` e a linha de fluxo logo abaixo por:

```markdown
| Container | Tecnologia | Responsabilidade |
|---|---|---|
| Aplicação Web (SPA) | React 19 + Vite + React Router v7, Tailwind CSS (`apps/web`) | Interface do usuário: telas de cadastro de escritório, gestão de usuários, clientes, kanban, agenda, campanhas |
| API | NestJS 12 (`apps/api`) | Backend HTTP: sessão → contexto de tenant → regras de negócio → Prisma |
| Código compartilhado | `@crm/compartilhado` | DTOs, schemas Zod e enums usados pelos dois lados da fronteira HTTP |
| Agendador de Notificações | AWS Lambda + EventBridge Scheduler | Consulta prazos de todos os escritórios e dispara WhatsApp/e-mail nos intervalos definidos, isolando por tenant |
| Banco de Dados | PostgreSQL (Amazon RDS ou Supabase) | Persistência relacional multi-tenant (isolamento lógico por `escritorio_id`) |
| Armazenamento de Arquivos | Amazon S3 ou Supabase Storage (S3-compatível) | Documentos anexados a casos, particionados por escritório (prefixo `escritorio_id/`) |

Fluxo: Browser → mesma origem (Vercel) → `/api/*` → API Nest (REST/JSON) → Prisma (TCP) → Postgres; API → AWS SDK → S3; Lambda → consulta Postgres (todos os tenants) → aciona Uazapi/SMTP por tenant.
```

Renomear `## Componentes internos das API Routes` para `## Componentes internos da API` e substituir as linhas `Auth Middleware`, `Tenant Context` e `Controllers` da tabela por:

```markdown
| Auth (TenantGuard) | Nest guard + `jose` | Valida o cookie `crm_sessao` (JWT HS256); extrai `usuarioId` e `escritorioId`; `role` é relido do banco a cada requisição |
| Tenant Context | `@Tenant()` + `TenantContext` | Injeta o contexto resolvido pelo guard em todo Service chamado na requisição; nenhuma query roda sem ele |
| Controllers | Controllers NestJS | Recebem HTTP, validam com `ValidacaoZodPipe` (schemas compartilhados), delegam para Services e traduzem erros com `ErrosHttpFilter` |
```

Em `### Isolamento de tenant`, item 1, trocar "JWT carrega `escritorioId`" por "O cookie de sessão (JWT assinado pela API) carrega `escritorioId`".

Na tabela `## Decisões de stack e motivação`, substituir as linhas `Next.js (App Router) para front + back`, `Next.js API Routes como backend`, `NextAuth.js com sessão multi-tenant` e `Vercel, dois Projects` por:

```markdown
| React + Vite (SPA) no front | Telas são todas autenticadas (sem necessidade de SEO/SSR); build estático simples e rápido; TanStack Query cuida de cache e sincronização |
| NestJS como backend separado | Camadas explícitas (guard → controller → service), injeção por token testável com `overrideProvider`, e o domínio fica independente do framework web — a migração do Next preservou services/repositories sem reescrever regra de negócio ([migracao-nestjs.md](migracao-nestjs.md)) |
| Sessão própria em cookie httpOnly | JWT HS256 emitido pela API (`jose`), sem dependência de NextAuth; `role` sempre relido do banco para refletir rebaixamento/remoção na hora (RN19) |
| Monorepo com `@crm/compartilhado` | Os mesmos schemas Zod validam o formulário e a requisição; DTOs tipam os dois lados sem o web depender do Prisma |
| Vercel Services, dois Projects | Web e API no mesmo deployment e na mesma origem (sem CORS, rollback atômico); um Project usa RDS+S3 (avaliação acadêmica), outro Supabase (produção real) — mesma `main`, env vars diferentes, ver [../deploy/deploy.md](../deploy/deploy.md) |
```

- [ ] **Step 6: `docs/arquitetura/migracao-nestjs.md` (arquivo completo)**

```markdown
# Migração para React + NestJS

**Status:** concluída (Fases 1–5, branch `feature/migracao-nestjs`, PR para `dev`).

## Contexto
O sistema nasceu como um app Next.js único (App Router + Route Handlers + NextAuth). A migração separou a API (NestJS) do front (React + Vite) sem reescrever regra de negócio: services e repositories foram reaproveitados como estavam e só mudaram de lugar na última fase.

## Estratégia: strangler
- A Fase 1 subiu `apps/api` ao lado do Next. Cada grupo de rota migrado passava a ser respondido pelo Nest via `rewrites` do Next, com o mesmo contrato HTTP.
- O domínio ficou em `src/` na raiz até a Fase 5, importado pela API via alias. Nada foi copiado.
- A sessão do NextAuth foi lida pelo `TenantGuard` até a Fase 3, quando a API passou a emitir o próprio cookie (`crm_sessao`).
- Na Fase 4 o front virou uma SPA Vite e o Next saiu do projeto.

## Fases
1. Fundação da API + módulo-piloto `status`/`tipos-status` ✅
2. Demais módulos da API ✅
3. Autenticação nativa no Nest; remoção do NextAuth ✅
4. Front React + Vite; remoção do Next ✅
5. Consolidação: domínio em `apps/api/src/dominio`, `@crm/compartilhado`, Prisma em `apps/api`, build com tsup, Vercel Services, CI/SonarCloud, documentação ✅

## Estado final
- `apps/api`: NestJS 12 (ESM). Dev com `tsx watch`, produção com o bundle do tsup (`dist/main.js`, executado por `node`).
- `apps/web`: React 19 + Vite + React Router v7. Em dev, proxy `/api` → :3001.
- `packages/compartilhado`: DTOs, schemas Zod, enums sem Prisma (paridade garantida por teste na API) e utilitários puros.
- Deploy: um Vercel Project por ambiente (acadêmico e real), cada um com os services `web` e `api` na mesma origem ([../deploy/deploy.md](../deploy/deploy.md)).

## Convenções da API (permanecem)
- Services do domínio entram no container por token (`useValue` + `@Inject(TOKEN)`). Nunca dependa de `emitDecoratorMetadata`: o build de produção (esbuild) não o emite.
- Toda rota de tenant: `@UseGuards(TenantGuard)` + `@Tenant() ctx`. `role` sempre do banco.
- Erros: `@UseFilters(new ErrosHttpFilter([tradutoresDoModulo]))`; validação com `ValidacaoZodPipe(schema)` usando schemas de `@crm/compartilhado/schemas`.
- Erro inesperado responde 500 `{ error: "Não foi possível concluir a operação." }`.

## Decisões da consolidação
- **Alias `@dominio/*`** na API (em vez de `@/`): deixa explícito o acesso da camada Nest ao domínio. Resolvido só em tempo de build/teste (tsc, Jest, tsup).
- **tsup em vez de `nest build`**: resolve aliases, embute o pacote compartilhado (que é TS-fonte) e gera um único arquivo ESM válido. `nest build`/tsc emitiria imports sem extensão, inválidos em ESM.
- **Vercel Services em vez de Projects separados para web e api**: mesma origem, rollback atômico e previews coerentes (plano B documentado no plano da Fase 5, caso Services, hoje em Beta, deixe de atender).
- **Migrations só no build de produção**: previews nunca migram o banco.
```

- [ ] **Step 7: Demais docs (textos novos)**

`docs/testes/estrategia-tdd.md`: substituir a tabela de "Metas de cobertura" e o parágrafo seguinte por:

```markdown
| Grupo (piso institucional) | Pacotes/camadas incluídos | Meta interna do projeto | Meta institucional (piso) |
|---|---|---|---|
| **Backend** | `apps/api/src/dominio/services/**`, `apps/api/src/dominio/repositories/**`, controllers (`apps/api/src/**/*.controller.ts`), `apps/api/src/comum/**`, `apps/api/src/dominio/lib/**` e `packages/compartilhado/src/**` | Services e `lib/auth` 90%, Repositories/Controllers 70%, `comum` 80%, compartilhado 90%, global da API 75% | **75%** |
| **Frontend** | `apps/web/src/**` (exceto `components/ui/**` e `main.tsx`) | `components/**` e `hooks/**` ≥ 25% por glob, global ≥ 25% | **25%** |

Cada pacote tem o próprio `jest.config.cjs` com `coverageThreshold` (metas internas por camada). Como o Jest mede por arquivo/glob e não por grupo, `scripts/verificar-piso-cobertura.mjs` soma as linhas de `apps/api` + `packages/compartilhado` (backend) e de `apps/web` (frontend) e falha abaixo de 75%/25%. `npm run test:coverage` (raiz) roda os três pacotes e o script. É o gate do CI e o número apresentado na prova de autoria. Os três `coverage/lcov.info` alimentam o SonarCloud ([../qualidade/analise-estatica.md](../qualidade/analise-estatica.md)).
```

e em "Onde os testes vivem", trocar o primeiro bullet por:

```markdown
- Unit/integração: colocation em cada pacote — `apps/api/src/dominio/services/cliente.service.test.ts` ao lado do service, `apps/api/src/clientes/clientes.controller.test.ts` (supertest) ao lado do controller, `apps/web/src/components/...test.tsx` ao lado do componente, `packages/compartilhado/src/schemas/cliente.test.ts` ao lado do schema.
```

e em "CI", trocar o segundo bullet por:

```markdown
- Playwright roda como job separado contra o **build de produção** (`apps/api/dist/main.js` + `vite preview`, com Postgres de serviço) e também é gate obrigatório antes de merge.
```

`docs/qualidade/analise-estatica.md`: substituir a seção `## Configuração` e o primeiro parágrafo de `## Quando roda` por:

```markdown
## Configuração

- **`sonar-project.properties`** na raiz: `sonar.sources=apps/api/src,apps/web/src,packages/compartilhado/src`, `sonar.tests` com os mesmos diretórios + `e2e`, `sonar.test.inclusions=**/*.test.ts,**/*.test.tsx,e2e/**/*.spec.ts`, `sonar.javascript.lcov.reportPaths` com os três relatórios (`apps/api/coverage/lcov.info`, `apps/web/coverage/lcov.info`, `packages/compartilhado/coverage/lcov.info`), exclusões (`dist`, `coverage`, `apps/api/prisma/migrations`, `apps/web/src/components/ui/**` — gerados pelo shadcn CLI) e as mesmas exclusões de cobertura dos `jest.config.cjs`.
- **ESLint** (`eslint.config.mjs`, flat config do monorepo) complementa o Sonar no PR: regras de fronteira entre pacotes (web não importa Prisma/API; compartilhado não importa apps; controller não importa repository), acessibilidade (`jsx-a11y`) e proibição de `.only`/`.skip` em testes.
- **`SONAR_TOKEN`**: secret do repositório GitHub, usado apenas no job de CI, nunca em runtime.

## Quando roda

Job `sonarcloud` em `.github/workflows/ci.yml`, disparado em todo PR contra `dev`/`main` e em todo push nessas branches (via `SonarSource/sonarqube-scan-action`). Depende do job `testes`, de onde baixa os três `lcov.info` como artefato.
```

e no último parágrafo de "Security hotspots", trocar "geração/validação de JWT (NextAuth.js)" por "geração/validação do JWT de sessão (`jose`, cookie `crm_sessao`)".

`docs/qualidade/observabilidade.md`: substituir a seção `## Onde o agente roda` por:

```markdown
## Onde o agente roda

- **API NestJS (service `api` nos dois Projects da Vercel)**: agente APM do New Relic (pacote `newrelic`), carregado por `apps/api/src/instrumentacao.ts`, que é o **primeiro import** do `main.ts`, antes do Express e do `@prisma/client`, para que ambos sejam instrumentados. O agente só é importado quando `NEW_RELIC_LICENSE_KEY` existe. A configuração é 100% por variável de ambiente (`NEW_RELIC_NO_CONFIG_FILE=true`, `NEW_RELIC_APP_NAME`, `NEW_RELIC_LOG=stdout`, distributed tracing e encaminhamento de logs ligados). As transações aparecem por rota do Express (ex.: `GET /api/clientes/:id`), que é a granularidade das metas de NFR. Como o bundle do tsup deixa as dependências externas, `express` e `@prisma/client` são carregados de `node_modules` e instrumentáveis normalmente.
- **SPA (`apps/web`)**: não tem agente. A latência percebida é medida pela API e, se necessário, pelo Browser agent do New Relic num passo futuro.
- **`NotificacaoScheduler` (AWS Lambda, ainda não implementado)**: quando existir, New Relic Lambda Layer, monitorado separadamente.
- **Vercel Observability**: complementar e sem configuração. Invocações, erros e duração da Function `api`, e Runtime Logs por deployment.

Em Fluid Compute a instância pode ser congelada entre requisições. O ciclo de envio do agente (harvest) pode atrasar dados de instâncias ociosas, mas não perde transações de instâncias ativas. Se os dashboards mostrarem lacunas, avaliar o encaminhamento de logs/traces via Vercel Drains (OpenTelemetry) para o New Relic.

`NEW_RELIC_LICENSE_KEY` só existe no ambiente Production dos Projects ([../deploy/deploy.md](../deploy/deploy.md)). Não roda localmente nem em preview, para não gerar ruído nos dashboards.
```

e na tabela "O que é monitorado", trocar `API Routes (\`app/api/**\`)` por `Rotas da API Nest (\`/api/**\`)`.

`docs/database/migrations-prisma.md` e `docs/database/docker-setup.md`: atualizar caminhos e o passo de deploy:

```bash
sed -i '' 's#`prisma/#`apps/api/prisma/#g; s#prisma/seed.ts#apps/api/prisma/seed.ts#g' docs/database/migrations-prisma.md docs/database/docker-setup.md
```

Em `docs/database/migrations-prisma.md`, substituir o bullet que começa com "O passo `prisma migrate deploy` roda dentro do próprio `npm run build`" por:

```markdown
- O passo `prisma migrate deploy` roda no build do service `api` na Vercel (`npm run vercel-build` → `apps/api/scripts/migrar-no-deploy.mjs`), **somente em produção** (`VERCEL_ENV=production`), em cada um dos dois Projects ([../deploy/deploy.md](../deploy/deploy.md)). Previews nunca migram. Toda mudança de schema segue expand/contract, para que o rollback do app nunca fique incompatível com o schema já migrado. Localmente: `npm run prisma:migrate` (raiz) = `prisma migrate dev` em `apps/api`.
```

`docs/README.md`:
- Na linha de `arquitetura/visao-geral.md`, trocar "camadas do backend (Auth Middleware → Tenant Context → Controller → Service → Repository)" por "camadas do backend (TenantGuard → Tenant Context → Controller → Service → Repository)".
- Na linha de `deploy/deploy.md`, trocar "por que dois deploys Vercel a partir do mesmo repositório" por "por que dois deploys Vercel a partir do mesmo repositório, cada um com os services web e api (Vercel Services)".
- A linha de `migracao-nestjs.md` (criada na Fase 1) passa a terminar com "— concluída; decisões da consolidação (alias, tsup, Services)".

- [ ] **Step 8: Verificar links e resíduos**

Run: `grep -rnE "next\.config|NextAuth|next-auth|NEXTAUTH|Route Handlers?|app/api/|src/services|src/repositories|src/lib/" CLAUDE.md README.md docs --include=*.md | grep -v "docs/superpowers" | grep -v "migracao-nestjs.md"`
Expected: nenhuma saída. Se sobrar referência ao Next em outros docs (ex.: `docs/app/modularizacao.md`, `docs/produto/*`), reescrever a frase com o caminho novo correspondente (tabela de destinos da Task 5.2).

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md README.md docs
git commit -m "docs: atualiza arquitetura, estrutura, deploy e qualidade para a stack React + NestJS"
```

---

### Task 5.11: Verificação completa e Pull Request para `dev`

**Files:** nenhum novo (só verificação). O PR inclui o plano da Fase 5 em `docs/superpowers/plans/`.

- [ ] **Step 1: Instalação limpa**

Run: `rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/*/dist apps/*/coverage packages/*/coverage && npm ci`
Expected: sem erros. O `postinstall` gera o Prisma Client e `ls node_modules/@crm` mostra `api compartilhado web`.

- [ ] **Step 2: Lint, tipos e testes com cobertura**

Run: `npm run db:up && npm run prisma:migrate && npm run lint && npm run typecheck && npm run test:coverage`
Expected:
- lint sem erros e typecheck sem erros nos três pacotes;
- todas as suítes passam dentro dos thresholds;
- `OK   backend: ≥75%` e `OK   frontend: ≥25%`.

- [ ] **Step 3: Build dos dois apps e smoke do build**

Run: `npm run build && ls apps/api/dist apps/web/dist`
Expected: `main.js main.js.map` e `index.html assets`.

Run: `npm start` num terminal. Em outro: `curl -s localhost:3001/api/saude; curl -s localhost:4173/api/saude; curl -s -o /dev/null -w "%{http_code}\n" localhost:4173/clientes`
Expected: `{"ok":true}`, `{"ok":true}` (pelo proxy do preview, mesma origem) e `200` (fallback de SPA). Encerrar.

- [ ] **Step 4: E2E contra o build de produção**

Run: `npx playwright test`
Expected: todos os specs de `e2e/` passando.

- [ ] **Step 5: Conferir que nada ficou para trás**

Run: `test ! -d src && test ! -e prisma && test ! -e next.config.ts && ! grep -rqE "\"next\"|next-auth|eslint-config-next" package.json apps/*/package.json packages/*/package.json && echo LIMPO`
Expected: `LIMPO`.

Run: `git status --short`
Expected: árvore limpa (tudo commitado nas tasks anteriores).

- [ ] **Step 6: Push e PR**

```bash
git add docs/superpowers/plans
git commit -m "docs(plano): plano da Fase 5 da migração para NestJS"
git push -u origin feature/migracao-nestjs
```

Abrir o PR para `dev` com a skill `create-pr` do repositório. A descrição deve citar: domínio em `apps/api/src/dominio`, `@crm/compartilhado`, Prisma em `apps/api`, build tsup, Vercel Services, CI + SonarCloud, docs. Também deve citar as ações manuais pendentes: secrets e variáveis nos Projects, configuração dos Projects (Root Directory `.`, preset Other), `SONAR_TOKEN` e checks obrigatórios.

Expected: os checks `lint e typecheck`, `testes com cobertura`, `e2e (build de produção)` e `SonarCloud` aparecem no PR e passam. O preview da Vercel de cada Project mostra web e api no mesmo domínio (`/api/saude` → `{"ok":true}`).
