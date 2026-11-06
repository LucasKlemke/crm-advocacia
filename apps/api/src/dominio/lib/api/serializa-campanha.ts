import type { CampanhaComInstancia } from "@dominio/repositories/campanha.repository";
import type { CampanhaDTO } from "@crm/compartilhado/tipos/campanha";

// Reexportado aqui para a camada HTTP não importar do repository (regra de camadas do lint).
export type { CampanhaComInstancia };

function iso(data: Date | null): string | null {
  return data ? data.toISOString() : null;
}

// Entidade → CampanhaDTO. Único mapeamento da campanha para fora do servidor: a resposta
// HTTP (CampanhasController) e o evento de tempo real (campanha.atualizada) passam por
// aqui, então os dois nunca divergem. Campos explícitos de propósito — copiar a instância
// com spread arrastaria o uazapiToken se algum chamador a trouxesse inteira.
export function serializarCampanha(campanha: CampanhaComInstancia): CampanhaDTO {
  return {
    id: campanha.id,
    escritorioId: campanha.escritorioId,
    instanciaWhatsappId: campanha.instanciaWhatsappId,
    criadoPorId: campanha.criadoPorId,
    nome: campanha.nome,
    mensagemTemplate: campanha.mensagemTemplate,
    mapeamentoVariaveis: campanha.mapeamentoVariaveis,
    colunaNumero: campanha.colunaNumero,
    arquivoCsvNome: campanha.arquivoCsvNome,
    delayMin: campanha.delayMin,
    delayMax: campanha.delayMax,
    agendadaPara: iso(campanha.agendadaPara),
    status: campanha.status,
    uazapiFolderId: campanha.uazapiFolderId,
    totalDestinatarios: campanha.totalDestinatarios,
    logTotal: campanha.logTotal,
    logSucesso: campanha.logSucesso,
    logFalha: campanha.logFalha,
    logEntregue: campanha.logEntregue,
    logLido: campanha.logLido,
    logReproduzido: campanha.logReproduzido,
    sincronizadoEm: iso(campanha.sincronizadoEm),
    createdAt: campanha.createdAt.toISOString(),
    updatedAt: campanha.updatedAt.toISOString(),
    instancia: campanha.instancia
      ? {
          id: campanha.instancia.id,
          nome: campanha.instancia.nome,
          status: campanha.instancia.status,
          softDeletedAt: iso(campanha.instancia.softDeletedAt),
        }
      : null,
  };
}
