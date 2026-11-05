import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { Documento } from "@prisma/client";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { DocumentosModule } from "./documentos.module";
import { DOCUMENTO_SERVICE } from "../comum/tokens-documentos";
import {
  DocumentoConflitanteError,
  DocumentoNaoEncontradoError,
  PermissaoDocumentoError,
  TamanhoInvalidoError,
  TipoInvalidoError,
} from "@dominio/services/documento.service";
import { ClienteNaoEncontradoError } from "@dominio/services/cliente.service";
import { NaoAutenticadoError } from "@dominio/lib/auth/resolver-tenant";

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
    [new DocumentoNaoEncontradoError(), 404],
    [new DocumentoConflitanteError(), 409],
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

  it("mapeia DocumentoNaoEncontradoError para 404", async () => {
    service.excluir.mockRejectedValue(new DocumentoNaoEncontradoError());

    await request(await subir()).delete("/api/documentos/doc-alheio").expect(404);
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).delete("/api/documentos/doc-1").expect(401);
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

  it("mapeia DocumentoConflitanteError para 409", async () => {
    service.confirmarUpload.mockRejectedValue(new DocumentoConflitanteError());

    await request(await subir()).post("/api/documentos/doc-1/confirmar").send(CORPO_UPLOAD).expect(409);
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
