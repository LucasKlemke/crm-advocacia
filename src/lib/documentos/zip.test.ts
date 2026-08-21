/**
 * @jest-environment node
 */
import { Readable } from "node:stream";
import { montarZipDocumentos } from "./zip";
import { s3Client } from "@/lib/external/s3-client";
import type { Documento } from "@prisma/client";

jest.mock("@/lib/external/s3-client");

const s3 = s3Client as jest.Mocked<typeof s3Client>;

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

async function coletar(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

describe("montarZipDocumentos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("monta um zip válido com um arquivo por documento", async () => {
    s3.buscarArquivo.mockImplementation(async (key: string) =>
      Readable.from([Buffer.from(`conteudo de ${key}`)])
    );

    const zip = montarZipDocumentos([
      documentoFake({ nomeOriginal: "contrato.pdf" }),
      documentoFake({ id: "doc-2", nomeOriginal: "procuracao.pdf" }),
    ]);

    const buffer = await coletar(zip);

    // Assinatura de arquivo ZIP (magic bytes "PK\x03\x04" no início do arquivo).
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    expect(s3.buscarArquivo).toHaveBeenCalledTimes(2);
  });

  // A resposta HTTP já foi enviada com 200 quando a leitura do S3 falha: abortar o zip
  // entregaria um arquivo truncado sem erro visível. Zip parcial e válido é preferível.
  it("pula documento ilegível no S3 e conclui o zip com os demais", async () => {
    const erroDoConsole = jest.spyOn(console, "error").mockImplementation(() => {});
    s3.buscarArquivo.mockImplementation(async (key: string) => {
      if (key.includes("quebrado")) {
        throw new Error("falha no S3");
      }
      return Readable.from([Buffer.from(`conteudo de ${key}`)]);
    });

    const zip = montarZipDocumentos([
      documentoFake({ id: "doc-quebrado", storageKey: "development/quebrado", nomeOriginal: "quebrado.pdf" }),
      documentoFake({ id: "doc-2", nomeOriginal: "procuracao.pdf" }),
    ]);

    const buffer = await coletar(zip);

    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    // Só o documento legível entrou no arquivo (o nome da entrada aparece no diretório
    // central do zip, que não é comprimido).
    expect(buffer.includes(Buffer.from("procuracao.pdf"))).toBe(true);
    expect(buffer.includes(Buffer.from("quebrado.pdf"))).toBe(false);
    expect(erroDoConsole).toHaveBeenCalled();
    erroDoConsole.mockRestore();
  });

  it("conclui um zip vazio quando não há documentos", async () => {
    const buffer = await coletar(montarZipDocumentos([]));

    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    expect(s3.buscarArquivo).not.toHaveBeenCalled();
  });
});
