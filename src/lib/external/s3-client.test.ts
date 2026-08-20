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
  it("gera uma URL assinada de GET com bucket e key corretos", async () => {
    const url = await s3Client.gerarUrlDownload("development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf");

    expect(url).toContain("op=GetObjectCommand");
    const mocked = getSignedUrl as jest.Mock;
    const command = mocked.mock.calls[0][1] as GetObjectCommand;
    expect(command.input).toEqual({
      Bucket: "bucket-teste",
      Key: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    });
  });
});

describe("s3Client.buscarArquivo", () => {
  it("devolve o stream do objeto", async () => {
    const stream = Readable.from([Buffer.from("conteudo do arquivo")]);
    s3Mock.on(GetObjectCommand).resolves({ Body: stream as any });

    const resultado = await s3Client.buscarArquivo("development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf");

    const chunks: Buffer[] = [];
    for await (const chunk of resultado) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).toString()).toBe("conteudo do arquivo");
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
