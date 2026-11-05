// Espelho, sem dependência de @prisma/client, dos enums do schema.prisma que
// atravessam a fronteira HTTP (DTOs, permissões, validação de upload). O web não
// pode depender do Prisma. A paridade com o schema é garantida por
// apps/api/src/dominio/enums-compartilhados.test.ts: mudou o enum numa migration,
// esse teste quebra até este arquivo ser atualizado.
export const ROLES_MEMBRO = ["owner", "admin", "padrao"] as const;
export type RoleMembro = (typeof ROLES_MEMBRO)[number];

export const STATUS_CAMPANHA = [
  "agendada",
  "enviando",
  "pausada",
  "concluida",
  "excluindo",
] as const;
export type StatusCampanha = (typeof STATUS_CAMPANHA)[number];

export const STATUS_INSTANCIA_WHATSAPP = [
  "disconnected",
  "connecting",
  "connected",
  "hibernated",
] as const;
export type StatusInstanciaWhatsapp = (typeof STATUS_INSTANCIA_WHATSAPP)[number];

export const TIPOS_ARQUIVO = ["pdf", "docx", "jpg", "png", "jpeg"] as const;
export type TipoArquivo = (typeof TIPOS_ARQUIVO)[number];
