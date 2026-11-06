import { z } from "zod";

// Login: só forma. A validação de verdade (usuário existe, ativo, bcrypt) fica em
// authorizeCredentials — erro de credencial nunca diz qual dos dois campos errou.
export const loginSchema = z.object({
  email: z.string().min(1, "Informe o e-mail"),
  senha: z.string().min(1, "Informe a senha"),
});
export type DadosLogin = z.infer<typeof loginSchema>;

// Mesmas regras das rotas Next removidas (sessao/escritorio-ativo e cadastro).
export const trocarEscritorioSchema = z.object({
  escritorioId: z.string().min(1, "Informe o escritório"),
});
export type DadosTrocaEscritorio = z.infer<typeof trocarEscritorioSchema>;

export const cadastroSchema = z.object({
  nome: z.string().min(1, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
});
export type DadosCadastro = z.infer<typeof cadastroSchema>;
