import { z } from "zod";
import { nomeArquivoSchema } from "@/lib/api/schemas-comuns";

// Perfil é do usuário, não do tenant (o usuário pode estar no onboarding).
export const atualizarPerfilSchema = z.object({
  nome: z.string().min(1, "Informe seu nome").optional(),
  email: z.string().email("E-mail inválido").optional(),
});

export const alterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres"),
});

export const uploadUrlAvatarSchema = z.object({
  nomeArquivo: nomeArquivoSchema,
  tipoArquivo: z.enum(["jpeg", "png", "webp"]),
  tamanhoBytes: z.number().int().positive(),
});

export const confirmarAvatarSchema = z.object({
  storageKey: z.string().min(1).max(500),
});
