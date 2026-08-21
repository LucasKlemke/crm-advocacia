/**
 * @jest-environment node
 */
import { mockClient } from "aws-sdk-client-mock";
import {
  S3Client as AwsS3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(async (_client: unknown, command: { constructor: { name: string } }) => {
    return `https://bucket.s3.amazonaws.com/signed?op=${command.constructor.name}`;
  }),
}));

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "./s3-client";

const s3Mock = mockClient(AwsS3Client);

beforeEach(() => {
  s3Mock.reset();
  (getSignedUrl as jest.Mock).mockClear();
  process.env.AWS_REGION = "us-east-1";
  process.env.AWS_ACCESS_KEY_ID = "fake-key";
  process.env.AWS_SECRET_ACCESS_KEY = "fake-secret";
  process.env.AWS_S3_BUCKET = "bucket-teste";
});

describe("s3Client.gerarUrlUpload", () => {
  it("gera uma URL assinada de PUT com bucket, key, content-type e tamanho corretos", async () => {
    const url = await s3Client.gerarUrlUpload("development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf", "application/pdf", 1024);

    expect(url).toContain("op=PutObjectCommand");
    const mocked = getSignedUrl as jest.Mock;
    const command = mocked.mock.calls[0][1] as PutObjectCommand;
    expect(command.input).toEqual({
      Bucket: "bucket-teste",
      Key: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
      ContentType: "application/pdf",
      ContentLength: 1024,
    });
  });
});

describe("s3Client.gerarUrlDownload", () => {
  it("gera uma URL assinada de GET com bucket e key corretos, expirando em 60s por padrão", async () => {
    const url = await s3Client.gerarUrlDownload("development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf");

    expect(url).toContain("op=GetObjectCommand");
    const mocked = getSignedUrl as jest.Mock;
    const command = mocked.mock.calls[0][1] as GetObjectCommand;
    expect(command.input).toEqual({
      Bucket: "bucket-teste",
      Key: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    });
    expect(mocked.mock.calls[0][2]).toEqual({ expiresIn: 60 });
  });

  it("aceita um tempo de expiração customizado", async () => {
    await s3Client.gerarUrlDownload("development/avatares/user-1/foto.png", 600);

    const mocked = getSignedUrl as jest.Mock;
    expect(mocked.mock.calls[0][2]).toEqual({ expiresIn: 600 });
  });

  // A storageKey não muda quando o documento é renomeado — sem o
  // ResponseContentDisposition, o navegador sugeriria o nome do upload original.
  it("inclui ResponseContentDisposition com o nome atual do arquivo quando informado", async () => {
    await s3Client.gerarUrlDownload(
      "development/esc-1/documentos/cliente/cli-1/doc-1-antigo.pdf",
      undefined,
      "novo-nome.pdf"
    );

    const mocked = getSignedUrl as jest.Mock;
    const command = mocked.mock.calls[0][1] as GetObjectCommand;
    expect(command.input).toEqual({
      Bucket: "bucket-teste",
      Key: "development/esc-1/documentos/cliente/cli-1/doc-1-antigo.pdf",
      ResponseContentDisposition: 'attachment; filename="novo-nome.pdf"; filename*=UTF-8\'\'novo-nome.pdf',
    });
  });

  it("escapa acentos no fallback ASCII e preserva unicode em filename*", async () => {
    await s3Client.gerarUrlDownload("development/esc-1/documentos/cliente/cli-1/doc-1.pdf", undefined, "contrato-João.pdf");

    const mocked = getSignedUrl as jest.Mock;
    const command = mocked.mock.calls[0][1] as GetObjectCommand;
    expect(command.input.ResponseContentDisposition).toBe(
      "attachment; filename=\"contrato-Jo_o.pdf\"; filename*=UTF-8''contrato-Jo%C3%A3o.pdf"
    );
  });

  it("não inclui ResponseContentDisposition quando o nome não é informado", async () => {
    await s3Client.gerarUrlDownload("development/esc-1/documentos/cliente/cli-1/doc-1.pdf");

    const mocked = getSignedUrl as jest.Mock;
    const command = mocked.mock.calls[0][1] as GetObjectCommand;
    expect(command.input).not.toHaveProperty("ResponseContentDisposition");
  });

  // "inline" deixa o navegador exibir o arquivo na aba (visualizar) em vez de sempre
  // forçar o download.
  it("usa 'inline' em vez de 'attachment' quando inline=true", async () => {
    await s3Client.gerarUrlDownload(
      "development/esc-1/documentos/cliente/cli-1/doc-1.pdf",
      undefined,
      "contrato.pdf",
      true
    );

    const mocked = getSignedUrl as jest.Mock;
    const command = mocked.mock.calls[0][1] as GetObjectCommand;
    expect(command.input.ResponseContentDisposition).toBe(
      "inline; filename=\"contrato.pdf\"; filename*=UTF-8''contrato.pdf"
    );
  });
});

describe("s3Client.buscarArquivo", () => {
  it("devolve o stream do objeto", async () => {
    const stream = Readable.from([Buffer.from("conteudo do arquivo")]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s3Mock.on(GetObjectCommand).resolves({ Body: stream as any });

    const resultado = await s3Client.buscarArquivo("development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf");

    const chunks: Buffer[] = [];
    for await (const chunk of resultado) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).toString()).toBe("conteudo do arquivo");
  });
});

describe("bucket não configurado", () => {
  // Sem a checagem, o SDK montaria requests para um bucket "undefined" em silêncio.
  it("falha explicitamente quando AWS_S3_BUCKET não está definido", async () => {
    delete process.env.AWS_S3_BUCKET;

    await expect(s3Client.gerarUrlDownload("development/qualquer/key")).rejects.toThrow(
      "AWS_S3_BUCKET não configurado."
    );
    expect(getSignedUrl as jest.Mock).not.toHaveBeenCalled();
  });
});

describe("s3Client.excluirArquivo", () => {
  it("chama DeleteObject com bucket e key corretos", async () => {
    s3Mock.on(DeleteObjectCommand).resolves({});

    await s3Client.excluirArquivo("development/esc-1/avatares/user-1/123-foto.png");

    expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(1);
    expect(s3Mock.commandCalls(DeleteObjectCommand)[0].args[0].input).toEqual({
      Bucket: "bucket-teste",
      Key: "development/esc-1/avatares/user-1/123-foto.png",
    });
  });
});
