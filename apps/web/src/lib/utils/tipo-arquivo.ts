import type { TipoArquivo } from "@prisma/client";

const TIPOS_ACEITOS: TipoArquivo[] = ["pdf", "docx", "jpg", "jpeg", "png"];

// Só a extensão importa aqui (feedback rápido no cliente); a Service revalida tipo e
// tamanho de novo — RN17/RN18 valem lá, não só nessa checagem de UX.
export function inferirTipoArquivo(nomeArquivo: string): TipoArquivo | null {
  const extensao = nomeArquivo.toLowerCase().split(".").pop();
  const tipo = TIPOS_ACEITOS.find((candidato) => candidato === extensao);
  return tipo ?? null;
}
