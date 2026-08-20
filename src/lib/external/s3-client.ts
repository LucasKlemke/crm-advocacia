import {
  S3Client as AwsS3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

const URL_EXPIRA_SEGUNDOS = 60;

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
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    return getSignedUrl(criarClienteAws(), command, { expiresIn: URL_EXPIRA_SEGUNDOS });
  },

  async gerarUrlDownload(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    });
    return getSignedUrl(criarClienteAws(), command, { expiresIn: URL_EXPIRA_SEGUNDOS });
  },

  async buscarArquivo(key: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    });
    const resposta = await criarClienteAws().send(command);
    return resposta.Body as Readable;
  },

  async excluirArquivo(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    });
    await criarClienteAws().send(command);
  },
};
