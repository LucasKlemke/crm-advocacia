import { z } from "zod";

// Comentários ancorados por escopo + escopoId (RN21). Hoje só cliente e caso.
export const escopoComentarioSchema = z.enum(["cliente", "caso"]);

// Query de GET /api/comentarios. Os valores vêm de URLSearchParams.get(), então
// parâmetro ausente chega como null e é recusado aqui.
export const filtroComentariosSchema = z.object({
  escopo: escopoComentarioSchema,
  escopoId: z.uuid(),
});

export const novoComentarioSchema = z.object({
  escopo: escopoComentarioSchema,
  escopoId: z.uuid(),
  conteudo: z.string().trim().min(1, "Escreva algo antes de comentar.").max(5000),
});

export const edicaoComentarioSchema = z.object({
  conteudo: z.string().trim().min(1, "Escreva algo antes de salvar.").max(5000),
});

export type NovoComentario = z.infer<typeof novoComentarioSchema>;
export type EdicaoComentario = z.infer<typeof edicaoComentarioSchema>;
