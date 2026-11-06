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
} from "@dominio/services/usuario.service";
import { NaoAutenticadoError, SemEscritorioAtivoError } from "@dominio/lib/auth/resolver-tenant";

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

  it("responde 400 para JSON malformado", async () => {
    await request(await subir())
      .patch("/api/perfil/senha")
      .set("content-type", "application/json")
      .send("{x")
      .expect(400, { error: "Dados inválidos" });
    expect(service.alterarSenha).not.toHaveBeenCalled();
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
