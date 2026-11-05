import { z } from "zod";

// Login: só forma. A validação de verdade (usuário existe, ativo, bcrypt) fica em
// authorizeCredentials — erro de credencial nunca diz qual dos dois campos errou.
export const loginSchema = z.object({
  email: z.string().min(1, "Informe o e-mail"),
  senha: z.string().min(1, "Informe a senha"),
});
export type DadosLogin = z.infer<typeof loginSchema>;
