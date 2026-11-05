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
