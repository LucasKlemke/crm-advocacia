/**
 * @jest-environment node
 */
import {
  documentoService,
  DocumentoNaoEncontradoError,
  PermissaoDocumentoError,
  TamanhoInvalidoError,
} from "./documento.service";
import { documentoRepository } from "@/repositories/documento.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { clienteService, ClienteNaoEncontradoError } from "@/services/cliente.service";
import { casoService, CasoNaoEncontradoError } from "@/services/caso.service";
import { logService } from "@/services/log.service";
import { s3Client } from "@/lib/external/s3-client";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Documento, Membro } from "@prisma/client";

jest.mock("@/repositories/documento.repository");
jest.mock("@/repositories/membro.repository");
jest.mock("@/services/log.service");
jest.mock("@/lib/external/s3-client");
jest.mock("@/services/cliente.service", () => ({
  clienteService: { obter: jest.fn() },
  ClienteNaoEncontradoError: class ClienteNaoEncontradoError extends Error {},
}));
jest.mock("@/services/caso.service", () => ({
  casoService: { obter: jest.fn() },
  CasoNaoEncontradoError: class CasoNaoEncontradoError extends Error {},
}));
jest.mock("@/lib/prisma", () => ({
  prisma: { $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));

const repo = documentoRepository as jest.Mocked<typeof documentoRepository>;
const membros = membroRepository as jest.Mocked<typeof membroRepository>;
const clientes = clienteService as jest.Mocked<typeof clienteService>;
const casos = casoService as jest.Mocked<typeof casoService>;
const logs = logService as jest.Mocked<typeof logService>;
const s3 = s3Client as jest.Mocked<typeof s3Client>;

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

function documentoFake(over: Partial<Documento> = {}): Documento {
  return {
    id: "doc-1",
    escritorioId: "esc-1",
    escopo: "cliente",
    escopoId: "cli-1",
    autorMembroId: "membro-1",
    nomeOriginal: "contrato.pdf",
    tipoArquivo: "pdf",
    tamanhoKb: 100,
    storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    softDeletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function membroFake(over: Partial<Membro> = {}): Membro {
  return {
    id: "membro-1",
    usuarioId: "user-1",
    escritorioId: "esc-1",
    role: "padrao",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  clientes.obter.mockResolvedValue({ id: "cli-1", nome: "Maria Silva" } as never);
  casos.obter.mockResolvedValue({ id: "caso-1", titulo: "Ação de Cobrança" } as never);
  membros.findByUsuarioEEscritorio.mockResolvedValue(membroFake());
  logs.registrar.mockResolvedValue({} as never);
  s3.gerarUrlUpload.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-put");
});

describe("documentoService.gerarUrlUpload", () => {
  it("valida o tenant do alvo, monta a key e devolve a URL assinada de PUT", async () => {
    const resultado = await documentoService.gerarUrlUpload(ctx, {
      escopo: "cliente",
      escopoId: "cli-1",
      nomeArquivo: "contrato.pdf",
      tipoArquivo: "pdf",
      tamanhoKb: 100,
    });

    expect(clientes.obter).toHaveBeenCalledWith(ctx, "cli-1");
    expect(resultado.uploadUrl).toBe("https://bucket.s3.amazonaws.com/signed-put");
    expect(resultado.storageKey).toContain("esc-1/documentos/cliente/cli-1/");
    expect(resultado.storageKey).toContain("contrato.pdf");
    expect(s3.gerarUrlUpload).toHaveBeenCalledWith(
      resultado.storageKey,
      "application/pdf",
      100 * 1024
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  // RN17: arquivo maior que 10MB é rejeitado antes de gerar a URL, sem round-trip ao S3.
  it("recusa arquivo maior que 10MB antes de chamar o S3", async () => {
    await expect(
      documentoService.gerarUrlUpload(ctx, {
        escopo: "cliente",
        escopoId: "cli-1",
        nomeArquivo: "grande.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 10241,
      })
    ).rejects.toThrow(TamanhoInvalidoError);
    expect(s3.gerarUrlUpload).not.toHaveBeenCalled();
  });

  it("recusa anexar em cliente de outro escritório", async () => {
    clientes.obter.mockRejectedValue(new ClienteNaoEncontradoError());
    await expect(
      documentoService.gerarUrlUpload(ctx, {
        escopo: "cliente",
        escopoId: "cli-alheio",
        nomeArquivo: "x.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
      })
    ).rejects.toThrow(ClienteNaoEncontradoError);
    expect(s3.gerarUrlUpload).not.toHaveBeenCalled();
  });

  it("valida o caso quando o escopo é caso", async () => {
    await documentoService.gerarUrlUpload(ctx, {
      escopo: "caso",
      escopoId: "caso-1",
      nomeArquivo: "peticao.docx",
      tipoArquivo: "docx",
      tamanhoKb: 200,
    });
    expect(casos.obter).toHaveBeenCalledWith(ctx, "caso-1");
  });
});

describe("documentoService.confirmarUpload", () => {
  const input = {
    escopo: "cliente" as const,
    escopoId: "cli-1",
    nomeArquivo: "contrato.pdf",
    tipoArquivo: "pdf" as const,
    tamanhoKb: 100,
    storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
  };

  it("cria a linha do documento ancorada no membro autor e registra log", async () => {
    repo.create.mockResolvedValue(documentoFake());

    await documentoService.confirmarUpload(ctx, "doc-1", input);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "doc-1",
        escopo: "cliente",
        escopoId: "cli-1",
        nomeOriginal: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
        storageKey: input.storageKey,
        escritorio: { connect: { id: "esc-1" } },
        autor: { connect: { id: "membro-1" } },
      }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        acao: "criar",
        entidade: "documento",
        entidadeId: "doc-1",
        resumo: 'Documento "contrato.pdf" anexado ao cliente Maria Silva',
      }),
      expect.anything()
    );
  });

  it("recusa confirmar upload maior que 10MB", async () => {
    await expect(
      documentoService.confirmarUpload(ctx, "doc-1", { ...input, tamanhoKb: 99999 })
    ).rejects.toThrow(TamanhoInvalidoError);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("documentoService.obter", () => {
  it("devolve o documento do tenant", async () => {
    repo.findById.mockResolvedValue(documentoFake());
    await expect(documentoService.obter(ctx, "doc-1")).resolves.toMatchObject({ id: "doc-1" });
  });

  it("trata documento de outro escritório como não encontrado (RN19)", async () => {
    repo.findById.mockResolvedValue(documentoFake({ escritorioId: "esc-2" }));
    await expect(documentoService.obter(ctx, "doc-1")).rejects.toThrow(DocumentoNaoEncontradoError);
  });

  it("trata documento já excluído como não encontrado", async () => {
    repo.findById.mockResolvedValue(documentoFake({ softDeletedAt: new Date() }));
    await expect(documentoService.obter(ctx, "doc-1")).rejects.toThrow(DocumentoNaoEncontradoError);
  });
});

describe("documentoService.listarPorEscopo", () => {
  it("valida o alvo antes de listar e escopa ao escritório", async () => {
    repo.listarPorEscopo.mockResolvedValue([]);

    await documentoService.listarPorEscopo(ctx, "cliente", "cli-1");

    expect(clientes.obter).toHaveBeenCalledWith(ctx, "cli-1");
    expect(repo.listarPorEscopo).toHaveBeenCalledWith("esc-1", "cliente", "cli-1");
  });
});

describe("documentoService.excluir", () => {
  it("o autor exclui o próprio documento (soft delete + log)", async () => {
    repo.findById.mockResolvedValue(documentoFake({ autorMembroId: "membro-1" }));
    repo.marcarExcluido.mockResolvedValue(documentoFake());
    membros.findByUsuarioEEscritorio.mockResolvedValue(membroFake({ id: "membro-1" }));

    await documentoService.excluir(ctx, "doc-1");

    expect(repo.marcarExcluido).toHaveBeenCalledWith("doc-1", expect.any(Date), expect.anything());
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ acao: "excluir", entidade: "documento", entidadeId: "doc-1" }),
      expect.anything()
    );
  });

  it("owner exclui documento de qualquer membro", async () => {
    const owner: TenantContext = { usuarioId: "user-9", escritorioId: "esc-1", role: "owner" };
    repo.findById.mockResolvedValue(documentoFake({ autorMembroId: "membro-1" }));
    repo.marcarExcluido.mockResolvedValue(documentoFake());
    membros.findByUsuarioEEscritorio.mockResolvedValue(membroFake({ id: "membro-9", usuarioId: "user-9" }));

    await expect(documentoService.excluir(owner, "doc-1")).resolves.toBeUndefined();
  });

  it("membro padrão não exclui documento alheio", async () => {
    const outroPadrao: TenantContext = { usuarioId: "user-2", escritorioId: "esc-1", role: "padrao" };
    repo.findById.mockResolvedValue(documentoFake({ autorMembroId: "membro-1" }));
    membros.findByUsuarioEEscritorio.mockResolvedValue(membroFake({ id: "membro-2", usuarioId: "user-2" }));

    await expect(documentoService.excluir(outroPadrao, "doc-1")).rejects.toThrow(
      PermissaoDocumentoError
    );
    expect(repo.marcarExcluido).not.toHaveBeenCalled();
  });

  it("trata documento de outro escritório como não encontrado (RN19)", async () => {
    repo.findById.mockResolvedValue(documentoFake({ escritorioId: "esc-2" }));
    await expect(documentoService.excluir(ctx, "doc-1")).rejects.toThrow(DocumentoNaoEncontradoError);
  });
});

describe("documentoService.gerarUrlDownload", () => {
  it("valida o tenant e devolve a URL assinada de GET", async () => {
    repo.findById.mockResolvedValue(documentoFake());
    s3.gerarUrlDownload.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");

    const url = await documentoService.gerarUrlDownload(ctx, "doc-1");

    expect(s3.gerarUrlDownload).toHaveBeenCalledWith(
      "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf"
    );
    expect(url).toBe("https://bucket.s3.amazonaws.com/signed-get");
  });

  it("trata documento de outro escritório como não encontrado (RN19)", async () => {
    repo.findById.mockResolvedValue(documentoFake({ escritorioId: "esc-2" }));
    await expect(documentoService.gerarUrlDownload(ctx, "doc-1")).rejects.toThrow(
      DocumentoNaoEncontradoError
    );
  });
});
