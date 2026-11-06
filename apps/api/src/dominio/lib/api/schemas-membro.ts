import { z } from "zod";

// Promoção/rebaixamento de papel dentro do escritório (RN02a).
export const alterarRoleSchema = z.object({
  role: z.enum(["owner", "admin", "padrao"]),
});
