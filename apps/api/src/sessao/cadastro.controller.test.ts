import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../test/utils";
import { setCookieDaSessao } from "../../test/sessao";
import { SessaoModule } from "./sessao.module";
import { USUARIO_SERVICE } from "./tokens";
import { EmailJaCadastradoError } from "@dominio/services/usuario.service";

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

describe("POST /api/cadastro — falha inesperada", () => {
  it("não traduz erros desconhecidos como 409 (responde 500 genérico)", async () => {
    usuarioService.cadastrarUsuario.mockRejectedValue(new Error("banco fora do ar"));
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      const res = await request(await subir()).post("/api/cadastro").send(payloadValido).expect(500);
      expect(res.body.error).toBe("Não foi possível concluir a operação.");
    } finally {
      erro.mockRestore();
    }
  });
});
