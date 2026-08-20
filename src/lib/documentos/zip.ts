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
    for (const documento of documentos) {
      try {
        const stream = await s3Client.buscarArquivo(documento.storageKey);
        zip.append(stream, { name: documento.nomeOriginal });
      } catch (error) {
        // A resposta HTTP já saiu com 200 e o zip já está sendo transmitido: abortar aqui
        // entregaria um arquivo truncado sem nenhum erro visível ao usuário. Continua com
        // os demais documentos — zip parcial e válido é melhor que zip corrompido.
        console.error(`Erro ao ler documento ${documento.id} do S3 para o zip`, error);
      }
    }
    await zip.finalize();
  })();

  return zip;
}
