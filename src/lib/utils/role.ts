import type { RoleMembro } from "@prisma/client";

const LABEL_ROLE: Record<RoleMembro, string> = {
  owner: "Dono",
  admin: "Administrador",
  padrao: "Padrão",
};

export const ROLES_MEMBRO: RoleMembro[] = ["owner", "admin", "padrao"];

export function labelRole(role: RoleMembro): string {
  return LABEL_ROLE[role];
}
