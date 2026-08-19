import { z } from "zod";
import type { FiltrosCaso } from "@/repositories/caso.repository";

export const tituloCasoSchema = z.string().trim().min(1, "Informe o título do caso.").max(140);

export const descricaoCasoSchema = z.string().trim().max(10000).nullish();

// Decimal(12,2) no Prisma: aceita número ou string vinda do JSON, sempre não-negativo.
export const valorCasoSchema = z.coerce.number().nonnegative("O valor não pode ser negativo.").nullish();

export const novoCasoSchema = z.object({
  titulo: tituloCasoSchema,
  clienteId: z.uuid("Cliente inválido."),
  statusId: z.uuid("Status inválido."),
  responsavelMembroId: z.uuid("Responsável inválido.").nullish(),
  descricao: descricaoCasoSchema,
  valor: valorCasoSchema,
});

// PATCH parcial: campo ausente não mexe, `null` limpa (responsavel/descricao/valor).
export const edicaoCasoSchema = novoCasoSchema.partial();

// Query params de /api/casos e /api/casos/kanban — contrato usado pela UI do kanban/tabela.
//
//   busca            texto livre (título/descrição)
//   statusId         um ou mais ids de Status, separados por vírgula
//   tipoStatusId     um ou mais ids de TipoStatus, separados por vírgula
//   clienteId        um ou mais ids de Cliente, separados por vírgula
//   responsavelId    um ou mais ids de Membro, separados por vírgula — o literal
//                     "sem-responsavel" pede os casos sem responsável (OR com os demais ids)
//   dataInicio       ISO 8601 — início do range sobre createdAt
//   dataFim          ISO 8601 — fim do range sobre createdAt
//   arquivado        "true" para ver só arquivados; ausente/"false" = só ativos (default do repo)
export function parseFiltrosCasoDaQuery(searchParams: URLSearchParams): FiltrosCaso {
  const listaDe = (chave: string): string[] | undefined => {
    const valor = searchParams.get(chave);
    if (!valor) return undefined;
    const ids = valor
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    return ids.length > 0 ? ids : undefined;
  };

  const dataDe = (chave: string): Date | undefined => {
    const valor = searchParams.get(chave);
    if (!valor) return undefined;
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? undefined : data;
  };

  return {
    busca: searchParams.get("busca")?.trim() || undefined,
    statusIds: listaDe("statusId"),
    tipoStatusIds: listaDe("tipoStatusId"),
    clienteIds: listaDe("clienteId"),
    responsavelIds: listaDe("responsavelId"),
    dataInicio: dataDe("dataInicio"),
    dataFim: dataDe("dataFim"),
    arquivado: searchParams.get("arquivado") === "true",
  };
}
