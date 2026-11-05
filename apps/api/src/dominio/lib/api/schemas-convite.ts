import { z } from "zod";

// Convite de colaborador por e-mail (RN02a). Se o e-mail já é usuário, o service o
// adiciona direto como membro.
export const convidarSchema = z.object({
  email: z.string().email("E-mail inválido"),
  role: z.enum(["owner", "admin", "padrao"]),
});
