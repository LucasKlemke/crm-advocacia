import { z } from "zod";
import { ICONES_STATUS_PERMITIDOS } from "@/lib/utils/icones-status";
import { CORES_STATUS_PERMITIDAS } from "@/lib/utils/cores-status";

export const nomeStatusSchema = z.string().trim().min(1, "Informe o nome do status.").max(60);

export const tipoStatusIdSchema = z.string().uuid("Tipo de status inválido.");

export const iconeStatusSchema = z.enum(
  ICONES_STATUS_PERMITIDOS as [string, ...string[]],
  { message: "Ícone inválido." }
);

export const corStatusSchema = z.enum(CORES_STATUS_PERMITIDAS as [string, ...string[]], {
  message: "Cor inválida.",
});

export const descricaoStatusSchema = z.string().trim().max(255).nullish();

export const novoStatusSchema = z.object({
  nome: nomeStatusSchema,
  tipoStatusId: tipoStatusIdSchema,
  icone: iconeStatusSchema,
  cor: corStatusSchema,
  descricao: descricaoStatusSchema,
});

// PATCH parcial: campo ausente não mexe, `descricao: null`/"" limpa.
export const edicaoStatusSchema = novoStatusSchema.partial();
