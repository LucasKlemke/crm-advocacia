import { serializarCasos } from "@dominio/lib/api/serializa-caso";
import { casoService } from "@dominio/services/caso.service";
import type { FiltrosCaso } from "@dominio/repositories/caso.repository";
import type { TenantContext } from "@dominio/lib/auth/tenant-context";
import type { ListaCasos } from "@crm/compartilhado/tipos/caso";

export const POR_PAGINA = 20;

// Montagem do payload de GET /api/casos, isolada do controller para ser testada sem HTTP
// e manter o DTO (ListaCasos) definido num único lugar, compartilhado com o front.
export async function montarListaCasos(
  ctx: TenantContext,
  filtros: Omit<FiltrosCaso, "skip" | "take">,
  pagina: number
): Promise<ListaCasos> {
  const { casos, total } = await casoService.listar(ctx, {
    ...filtros,
    skip: (pagina - 1) * POR_PAGINA,
    take: POR_PAGINA,
  });

  return { casos: await serializarCasos(casos), total, pagina, porPagina: POR_PAGINA };
}
