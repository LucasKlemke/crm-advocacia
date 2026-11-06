import type { InstanciaWhatsapp } from "@prisma/client";
import type { InstanciaWhatsappDTO } from "@crm/compartilhado/tipos/instancia-whatsapp";

type InstanciaSemToken = Omit<InstanciaWhatsapp, "uazapiToken">;

// Entidade → InstanciaWhatsappDTO para o evento de tempo real (instancia.atualizada): o
// mesmo formato que /api/instancias devolve depois do JSON. Campos explícitos de propósito —
// copiar com spread arrastaria o uazapiToken se o chamador passasse a linha inteira.
export function serializarInstancia(instancia: InstanciaSemToken): InstanciaWhatsappDTO {
  return {
    id: instancia.id,
    escritorioId: instancia.escritorioId,
    nome: instancia.nome,
    uazapiInstanceId: instancia.uazapiInstanceId,
    status: instancia.status,
    numeroConectado: instancia.numeroConectado,
    fotoPerfilUrl: instancia.fotoPerfilUrl,
    softDeletedAt: instancia.softDeletedAt ? instancia.softDeletedAt.toISOString() : null,
    createdAt: instancia.createdAt.toISOString(),
    updatedAt: instancia.updatedAt.toISOString(),
  };
}
