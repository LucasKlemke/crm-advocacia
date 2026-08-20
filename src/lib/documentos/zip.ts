import { ZipArchive, type Archiver } from "archiver";
import { s3Client } from "@/lib/external/s3-client";
import type { Documento } from "@prisma/client";

// Monta o zip em stream: cada arquivo é lido do S3 e anexado ao zip conforme chega,
// sem baixar tudo pra memória do servidor antes de responder.
//
// archiver@8 reescreveu o pacote como ESM puro e removeu a antiga factory
// `archiver("zip", options)`; a API atual instancia `ZipArchive` diretamente
// (subclasse de `Archiver`, mesmos métodos `append`/`finalize`).
export function montarZipDocumentos(documentos: Documento[]): Archiver {
  const zip = new ZipArchive({ zlib: { level: 9 } });

  (async () => {
    try {
      for (const documento of documentos) {
        const stream = await s3Client.buscarArquivo(documento.storageKey);
        zip.append(stream, { name: documento.nomeOriginal });
      }
      await zip.finalize();
    } catch (error) {
      zip.emit("error", error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return zip;
}
