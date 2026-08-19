import type { RoleMembro } from "@prisma/client";

export const LABEL_ROLE: Record<RoleMembro, string> = {
  owner: "Dono",
  admin: "Administrador",
  padrao: "Padrão",
};

export function labelRole(role: RoleMembro): string {
  return LABEL_ROLE[role];
}
