/**
 * @jest-environment node
 */
import {
  documentoService,
  DocumentoNaoEncontradoError,
  DocumentoConflitanteError,
  PermissaoDocumentoError,
  TamanhoInvalidoError,
  TipoInvalidoError,
} from "./documento.service";
import { documentoRepository } from "@/repositories/documento.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { clienteService, ClienteNaoEncontradoError } from "@/services/cliente.service";
import { casoService } from "@/services/caso.service";
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
      tamanhoBytes: 102_312,
    });

    expect(clientes.obter).toHaveBeenCalledWith(ctx, "cli-1");
    expect(resultado.uploadUrl).toBe("https://bucket.s3.amazonaws.com/signed-put");
    // Key completa (não só `toContain`): uma regressão que perdesse o prefixo e gerasse
    // "undefined/..." precisa quebrar aqui.
    expect(resultado.storageKey).toBe(
      `development/esc-1/documentos/cliente/cli-1/${resultado.documentoId}-contrato.pdf`
    );
    // Bytes exatos (não arredondados para KB) repassados ao S3: é o Content-Length
    // assinado na URL, e precisa bater com o PUT real do navegador (senão 403).
    expect(s3.gerarUrlUpload).toHaveBeenCalledWith(
      resultado.storageKey,
      "application/pdf",
      102_312
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
        tamanhoBytes: 10 * 1024 * 1024 + 1,
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
        tamanhoBytes: 100 * 1024,
      })
    ).rejects.toThrow(ClienteNaoEncontradoError);
    expect(s3.gerarUrlUpload).not.toHaveBeenCalled();
  });

  // RN18 na Service, não só no zod da rota: extensão precisa casar com o tipo declarado.
  it("recusa nome de arquivo cuja extensão não casa com o tipo declarado", async () => {
    await expect(
      documentoService.gerarUrlUpload(ctx, {
        escopo: "cliente",
        escopoId: "cli-1",
        nomeArquivo: "malware.exe",
        tipoArquivo: "pdf",
        tamanhoBytes: 100 * 1024,
      })
    ).rejects.toThrow(TipoInvalidoError);
    expect(clientes.obter).not.toHaveBeenCalled();
    expect(s3.gerarUrlUpload).not.toHaveBeenCalled();
  });

  it("recusa tipo fora da lista aceita (RN18)", async () => {
    await expect(
      documentoService.gerarUrlUpload(ctx, {
        escopo: "cliente",
        escopoId: "cli-1",
        nomeArquivo: "planilha.xlsx",
        tipoArquivo: "xlsx" as never,
        tamanhoBytes: 100 * 1024,
      })
    ).rejects.toThrow(TipoInvalidoError);
    expect(s3.gerarUrlUpload).not.toHaveBeenCalled();
  });

  it("falha explicitamente quando AWS_S3_PREFIX não está configurado", async () => {
    const original = process.env.AWS_S3_PREFIX;
    delete process.env.AWS_S3_PREFIX;
    try {
      await expect(
        documentoService.gerarUrlUpload(ctx, {
          escopo: "cliente",
          escopoId: "cli-1",
          nomeArquivo: "contrato.pdf",
          tipoArquivo: "pdf",
          tamanhoBytes: 100 * 1024,
        })
      ).rejects.toThrow("AWS_S3_PREFIX não configurado.");
      expect(s3.gerarUrlUpload).not.toHaveBeenCalled();
    } finally {
      process.env.AWS_S3_PREFIX = original;
    }
  });

  it("valida o caso quando o escopo é caso", async () => {
    await documentoService.gerarUrlUpload(ctx, {
      escopo: "caso",
      escopoId: "caso-1",
      nomeArquivo: "peticao.docx",
      tipoArquivo: "docx",
      tamanhoBytes: 200 * 1024,
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
    tamanhoBytes: 100 * 1024,
  };

  beforeEach(() => {
    repo.findById.mockResolvedValue(null);
  });

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
        // Key derivada no servidor a partir do id da URL, com a mesma fórmula de
        // gerarUrlUpload — nada aqui veio do body do request.
        storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
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
      documentoService.confirmarUpload(ctx, "doc-1", {
        ...input,
        tamanhoBytes: 10 * 1024 * 1024 + 1,
      })
    ).rejects.toThrow(TamanhoInvalidoError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  // A coluna tamanhoKb é só para exibição/estatística; o valor que precisa bater
  // byte-a-byte com o PUT real é tamanhoBytes (usado na assinatura da URL do S3).
  it("arredonda para cima o tamanho em KB armazenado, a partir do tamanho exato em bytes", async () => {
    repo.create.mockResolvedValue(documentoFake());

    await documentoService.confirmarUpload(ctx, "doc-1", { ...input, tamanhoBytes: 84_887 });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tamanhoKb: 83 }),
      expect.anything()
    );
  });

  it("recusa nome de arquivo cuja extensão não casa com o tipo declarado", async () => {
    await expect(
      documentoService.confirmarUpload(ctx, "doc-1", { ...input, nomeArquivo: "malware.exe" })
    ).rejects.toThrow(TipoInvalidoError);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("falha explicitamente quando AWS_S3_PREFIX não está configurado", async () => {
    const original = process.env.AWS_S3_PREFIX;
    delete process.env.AWS_S3_PREFIX;
    try {
      await expect(documentoService.confirmarUpload(ctx, "doc-1", input)).rejects.toThrow(
        "AWS_S3_PREFIX não configurado."
      );
      expect(repo.create).not.toHaveBeenCalled();
    } finally {
      process.env.AWS_S3_PREFIX = original;
    }
  });

  // Duplo clique / retry do cliente: a segunda confirmação devolve a linha já criada, sem
  // segundo create (que estouraria a unique do id como 500) e sem segundo log.
  it("é idempotente em confirmação repetida do mesmo documento", async () => {
    repo.create.mockResolvedValue(documentoFake());

    const primeiro = await documentoService.confirmarUpload(ctx, "doc-1", input);

    repo.findById.mockResolvedValue(documentoFake());
    const segundo = await documentoService.confirmarUpload(ctx, "doc-1", input);

    expect(segundo).toEqual(primeiro);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(logs.registrar).toHaveBeenCalledTimes(1);
  });

  it("trata id já usado por outro escritório como não encontrado (RN19)", async () => {
    repo.findById.mockResolvedValue(documentoFake({ escritorioId: "esc-2" }));

    await expect(documentoService.confirmarUpload(ctx, "doc-1", input)).rejects.toThrow(
      DocumentoNaoEncontradoError
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("recusa confirmar o mesmo id apontando para outro alvo", async () => {
    repo.findById.mockResolvedValue(documentoFake({ escopoId: "cli-outro" }));

    await expect(documentoService.confirmarUpload(ctx, "doc-1", input)).rejects.toThrow(
      DocumentoConflitanteError
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("converte violação de unique concorrente em conflito, não em 500", async () => {
    repo.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    await expect(documentoService.confirmarUpload(ctx, "doc-1", input)).rejects.toThrow(
      DocumentoConflitanteError
    );
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
