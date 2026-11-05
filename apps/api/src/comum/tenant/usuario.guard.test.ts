import { Controller, Get, UseGuards } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../../test/utils";
import { UsuarioGuard } from "./usuario.guard";
import { UsuarioId } from "./usuario.decorator";
import { NaoAutenticadoError, SemEscritorioAtivoError } from "@dominio/lib/auth/resolver-tenant";

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
