import type { CampanhaDTO } from "@crm/compartilhado/tipos/campanha";
import type { InstanciaWhatsappDTO } from "@crm/compartilhado/tipos/instancia-whatsapp";

// Eventos de tempo real do escritório (o nome do módulo ficou de quando só havia campanhas).
// `campanha` é exatamente o que a API HTTP devolveria para a mesma campanha
// (serializarCampanha) — nunca a linha crua, e nunca com o uazapiToken da instância.
// `campanha.removida` só leva o id: a linha local já não existe depois do delete.
// `campanha.mensagens` só avisa que o status por destinatário (entregue/lida, que vive só na
// UAZAPI) pode ter mudado — quem recebe reconsulta. `instancia` sai de serializarInstancia.
export type EventoCampanha =
  | { tipo: "campanha.atualizada"; escritorioId: string; campanha: CampanhaDTO }
  | { tipo: "campanha.removida"; escritorioId: string; campanhaId: string }
  | { tipo: "campanha.mensagens"; escritorioId: string; campanhaId: string }
  | { tipo: "instancia.atualizada"; escritorioId: string; instancia: InstanciaWhatsappDTO };

type Ouvinte = (evento: EventoCampanha) => void;

// Barramento em memória, por processo: a API roda num único processo por ambiente, então
// quem publica (sincronização) e quem assina (sockets) se encontram aqui. Os ouvintes são
// indexados pelo escritorioId — um ouvinte só enxerga eventos do próprio tenant (RN19).
const ouvintesPorEscritorio = new Map<string, Set<Ouvinte>>();

export const eventosCampanha = {
  publicar(evento: EventoCampanha): void {
    const ouvintes = ouvintesPorEscritorio.get(evento.escritorioId);
    if (!ouvintes) return;

    // Cópia: um ouvinte pode se cancelar (ou assinar outro) durante a entrega.
    for (const ouvinte of [...ouvintes]) {
      try {
        ouvinte(evento);
      } catch (erro) {
        // Um socket quebrado não pode impedir a entrega aos demais nem derrubar quem
        // publicou — a sincronização que gerou o evento já foi gravada.
        console.error(
          `[tempo-real] ouvinte de campanha falhou (escritório ${evento.escritorioId})`,
          erro
        );
      }
    }
  },

  assinar(escritorioId: string, ouvinte: Ouvinte): () => void {
    let ouvintes = ouvintesPorEscritorio.get(escritorioId);
    if (!ouvintes) {
      ouvintes = new Set();
      ouvintesPorEscritorio.set(escritorioId, ouvintes);
    }
    // Wrapper próprio por assinatura: o mesmo callback assinado duas vezes gera duas
    // entregas e dois cancelamentos independentes.
    const entrada: Ouvinte = (evento) => ouvinte(evento);
    ouvintes.add(entrada);

    return () => {
      const atuais = ouvintesPorEscritorio.get(escritorioId);
      if (!atuais) return;
      atuais.delete(entrada);
      // Sem isso o Map cresceria com um Set vazio por escritório que já teve socket.
      if (atuais.size === 0) ouvintesPorEscritorio.delete(escritorioId);
    };
  },
};
