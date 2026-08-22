import { z } from "zod";
import { ICONES_STATUS_PERMITIDOS } from "@/lib/utils/icones-status";
import { CORES_STATUS_PERMITIDAS } from "@/lib/utils/cores-status";

// Reusa as mesmas allow-lists de ícone/cor do Status: são a paleta e o conjunto de
// ícones do escritório inteiro, não algo específico do funil.
export const nomeTipoProcessoSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome do tipo de processo.")
  .max(60);

export const iconeTipoProcessoSchema = z.enum(ICONES_STATUS_PERMITIDOS as [string, ...string[]], {
  message: "Ícone inválido.",
});

export const corTipoProcessoSchema = z.enum(CORES_STATUS_PERMITIDAS as [string, ...string[]], {
  message: "Cor inválida.",
});

export const descricaoTipoProcessoSchema = z.string().trim().max(255).nullish();

export const novoTipoProcessoSchema = z.object({
  nome: nomeTipoProcessoSchema,
  icone: iconeTipoProcessoSchema,
  cor: corTipoProcessoSchema,
  descricao: descricaoTipoProcessoSchema,
});

// PATCH parcial: campo ausente não mexe, `descricao: null`/"" limpa.
export const edicaoTipoProcessoSchema = novoTipoProcessoSchema.partial();
