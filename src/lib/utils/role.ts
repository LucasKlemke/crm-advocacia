import type { RoleMembro } from "@prisma/client";

const LABEL_ROLE: Record<RoleMembro, string> = {
  owner: "Dono",
  admin: "Administrador",
  padrao: "Padrão",
};

const COR_ROLE: Record<RoleMembro, string> = {
  owner: "oklch(0.7 0.15 80)",
  admin: "oklch(0.6 0.19 260)",
  padrao: "oklch(0.55 0 0)",
};

export const ROLES_MEMBRO: RoleMembro[] = ["owner", "admin", "padrao"];

export function labelRole(role: RoleMembro): string {
  return LABEL_ROLE[role];
}

export function corRole(role: RoleMembro): string {
  return COR_ROLE[role];
}
