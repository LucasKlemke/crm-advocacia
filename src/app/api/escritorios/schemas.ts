import { z } from "zod";

// Limites espelham o schema do Prisma (Escritorio.nome VarChar(140), oab_responsavel e
// telefone_whatsapp VarChar(20)). Sem `.max()` aqui, um valor longo demais só estoura no
// INSERT e vira 500 opaco em vez de um 400 por campo.
export const nomeEscritorioSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome do escritório")
  .max(140, "O nome deve ter no máximo 140 caracteres.");

export const oabResponsavelSchema = z
  .string()
  .trim()
  .max(20, "A OAB deve ter no máximo 20 caracteres.")
  .optional();

export const telefoneWhatsappSchema = z
  .string()
  .trim()
  .max(20, "O telefone deve ter no máximo 20 caracteres.")
  .optional();

export const criarEscritorioSchema = z.object({
  nome: nomeEscritorioSchema,
  oabResponsavel: oabResponsavelSchema,
  telefoneWhatsapp: telefoneWhatsappSchema,
});

// PATCH parcial: campo ausente não mexe no valor atual.
export const atualizarEscritorioSchema = z.object({
  nome: nomeEscritorioSchema.optional(),
  oabResponsavel: oabResponsavelSchema,
  telefoneWhatsapp: telefoneWhatsappSchema,
});
