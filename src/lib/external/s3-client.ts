import {
  S3Client as AwsS3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

const URL_EXPIRA_SEGUNDOS = 60;

// Env ausente/errado faria o SDK montar requests para um bucket chamado "undefined"
// (ou sem bucket) — falha explícita em vez de erro obscuro vindo da AWS.
function obterBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET não configurado.");
  }
  return bucket;
}

function criarClienteAws(): AwsS3Client {
  return new AwsS3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  });
}

// Único ponto de contato com o SDK da AWS — chamado só por Services (CLAUDE.md:
// Auth Middleware → Tenant Context → Controller → Service → Cliente Externo).
export const s3Client = {
  async gerarUrlUpload(key: string, contentType: string, contentLength: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: obterBucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    return getSignedUrl(criarClienteAws(), command, { expiresIn: URL_EXPIRA_SEGUNDOS });
  },

  async gerarUrlDownload(key: string, expiresIn: number = URL_EXPIRA_SEGUNDOS): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: obterBucket(),
      Key: key,
    });
    return getSignedUrl(criarClienteAws(), command, { expiresIn });
  },

  async buscarArquivo(key: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: obterBucket(),
      Key: key,
    });
    const resposta = await criarClienteAws().send(command);
    return resposta.Body as Readable;
  },

  async excluirArquivo(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: obterBucket(),
      Key: key,
    });
    await criarClienteAws().send(command);
  },
};
