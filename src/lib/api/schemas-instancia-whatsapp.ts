import { z } from "zod";

export const novaInstanciaWhatsappSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(60),
});
