import { z } from "zod";

// Nome de arquivo entra na key do S3 e no nome da entrada do zip ("baixar todos").
// Um nome com separador de caminho (`/`, `\`) ou iniciado por ponto (`..`) escapa do
// caminho pretendido na key e vira path traversal (zip-slip) na hora de extrair o zip —
// por isso a validação é compartilhada por todas as rotas que aceitam `nomeArquivo`,
// em vez de repetida (e divergir) em cada uma.
export const nomeArquivoSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[^/\\]+$/, "Nome de arquivo não pode conter separadores de caminho.")
  .refine((nome) => !nome.startsWith("."), "Nome de arquivo não pode começar com ponto.");
