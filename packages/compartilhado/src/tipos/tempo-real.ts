import type { CampanhaDTO } from "./campanha";
import type { InstanciaWhatsappDTO } from "./instancia-whatsapp";

// Contrato servidor → browser do WebSocket /api/ws (apps/api/src/tempo-real/servidor-ws.ts).
// Nenhuma mensagem leva escritorioId: o socket já pertence a um escritório só (RN19).
export type MensagemTempoReal =
  | { tipo: "pronto" }
  // Contadores/status da campanha mudaram: a campanha inteira, como a API HTTP devolve.
  | { tipo: "campanha.atualizada"; campanha: CampanhaDTO }
  | { tipo: "campanha.removida"; campanhaId: string }
  // O status de cada mensagem da campanha pode ter mudado (entregue/lida): reconsultar
  // GET /api/campanhas/:id/mensagens. Não carrega dado de destinatário (LGPD).
  | { tipo: "campanha.mensagens"; campanhaId: string }
  // Conexão da instância mudou (QR lido, número, foto, desconexão, exclusão). Mesmo DTO de
  // /api/instancias, nunca com o uazapiToken.
  | { tipo: "instancia.atualizada"; instancia: InstanciaWhatsappDTO };
