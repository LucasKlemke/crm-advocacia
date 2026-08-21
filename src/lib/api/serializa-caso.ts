import { usuarioService } from "@/services/usuario.service";
import type { CasoComRelacoes } from "@/repositories/caso.repository";
import type { CasoDTO } from "@/types/caso";

// `CASO_INCLUDE.responsavel.usuario` traz o Usuario inteiro (senhaHash incluído) — sem
// isso, o objeto vai pro JSON de resposta com o hash da senha do responsável.
export async function serializarCaso(caso: CasoComRelacoes): Promise<CasoDTO> {
  const avatarUrl = caso.responsavel
    ? await usuarioService.assinarUrlAvatar(caso.responsavel.usuario.avatarUrl)
    : null;

  return {
    ...caso,
    responsavel: caso.responsavel
      ? {
          id: caso.responsavel.id,
          usuario: {
            id: caso.responsavel.usuario.id,
            nome: caso.responsavel.usuario.nome,
            email: caso.responsavel.usuario.email,
            avatarUrl,
          },
        }
      : null,
  } as unknown as CasoDTO;
}

export async function serializarCasos(casos: CasoComRelacoes[]): Promise<CasoDTO[]> {
  return Promise.all(casos.map(serializarCaso));
}
