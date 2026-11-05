import type { INestApplication, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { OPCOES_APP, configurarApp } from "../src/criar-app";
import { TenantModule } from "../src/comum/tenant/tenant.module";
import { RESOLVEDOR_TENANT, RESOLVEDOR_USUARIO } from "../src/comum/tenant/ler-sessao";
import type { TenantContext } from "@dominio/lib/auth/resolver-tenant";

export const CTX_OWNER: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" };

interface OpcoesAppDeTeste {
  imports?: Type<unknown>[];
  controllers?: Type<unknown>[];
  // Contexto que o guard devolve, ou o erro que ele lança (ex.: NaoAutenticadoError).
  ctx?: TenantContext | Error;
  // Usuário que o UsuarioGuard devolve, ou o erro que ele lança. Padrão: "user-1"
  // (o mesmo usuarioId de CTX_OWNER).
  usuarioId?: string | Error;
  // Substitui providers por token — ex.: [[STATUS_SERVICE, { listar: jest.fn() }]].
  overrides?: [symbol, unknown][];
}

// App Nest de teste com a mesma configuração do main.ts e o resolver de tenant
// substituído — os testes de controller nunca leem cookie nem banco.
export async function criarAppDeTeste(opcoes: OpcoesAppDeTeste): Promise<INestApplication> {
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

  for (const [token, valor] of opcoes.overrides ?? []) {
    builder = builder.overrideProvider(token).useValue(valor);
  }

  const modulo = await builder.compile();
  const app = configurarApp(modulo.createNestApplication(OPCOES_APP));
  await app.init();
  return app;
}
