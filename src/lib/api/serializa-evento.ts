import { usuarioService } from "@/services/usuario.service";
import type { EventoComRelacoes } from "@/repositories/evento.repository";
import type { EventoDTO, EventoMembroDTO } from "@/types/evento";

type MembroBruto = { id: string; usuario: { id: string; nome: string; email: string; avatarUrl: string | null } };

// Avatar é guardado como storage key no banco; a UI precisa de uma URL assinada. As
// assinaturas de um mesmo usuário são resolvidas uma única vez por resposta: numa visão
// de mês, o mesmo advogado aparece em dezenas de eventos.
async function assinarAvatares(chaves: (string | null)[]): Promise<Map<string, string | null>> {
  const unicas = [...new Set(chaves.filter((c): c is string => Boolean(c)))];
  const assinadas = await Promise.all(unicas.map((c) => usuarioService.assinarUrlAvatar(c)));
  return new Map(unicas.map((chave, indice) => [chave, assinadas[indice]]));
}

function membroDTO(membro: MembroBruto, avatares: Map<string, string | null>): EventoMembroDTO {
  return {
    membroId: membro.id,
    usuario: {
      id: membro.usuario.id,
      nome: membro.usuario.nome,
      email: membro.usuario.email,
      avatarUrl: membro.usuario.avatarUrl ? (avatares.get(membro.usuario.avatarUrl) ?? null) : null,
    },
  };
}

export async function serializarEventos(
  eventos: EventoComRelacoes[],
  podeEditar: (evento: EventoComRelacoes) => boolean
): Promise<EventoDTO[]> {
  const chaves = eventos.flatMap((evento) => [
    evento.criadoPor.usuario.avatarUrl,
    ...evento.participantes.map((p) => p.membro.usuario.avatarUrl),
  ]);
  const avatares = await assinarAvatares(chaves);

  return eventos.map((evento) => ({
    id: evento.id,
    escritorioId: evento.escritorioId,
    titulo: evento.titulo,
    descricao: evento.descricao,
    inicio: evento.inicio.toISOString(),
    fim: evento.fim.toISOString(),
    diaInteiro: evento.diaInteiro,
    modalidade: evento.modalidade,
    local: evento.local,
    linkReuniao: evento.linkReuniao,
    clienteId: evento.clienteId,
    casoId: evento.casoId,
    criadoPorMembroId: evento.criadoPorMembroId,
    createdAt: evento.createdAt.toISOString(),
    updatedAt: evento.updatedAt.toISOString(),
    cliente: evento.cliente,
    caso: evento.caso,
    criadoPor: membroDTO(evento.criadoPor, avatares),
    participantes: evento.participantes.map((p) =>
      membroDTO({ id: p.membroId, usuario: p.membro.usuario }, avatares)
    ),
    podeEditar: podeEditar(evento),
  }));
}

export async function serializarEvento(
  evento: EventoComRelacoes,
  podeEditar: (evento: EventoComRelacoes) => boolean
): Promise<EventoDTO> {
  const [dto] = await serializarEventos([evento], podeEditar);
  return dto;
}
