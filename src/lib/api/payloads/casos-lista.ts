import { serializarCasos } from "@/lib/api/serializa-caso";
import { casoService } from "@/services/caso.service";
import type { FiltrosCaso } from "@/repositories/caso.repository";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { ListaCasos } from "@/types/caso";

export const POR_PAGINA = 20;

// Montagem do payload de GET /api/casos, extraída do route handler para ser reusada
// pelo prefetch no servidor (src/app/(dashboard)/page.tsx): as duas pontas precisam
// produzir exatamente o mesmo DTO, senão o React Query hidratado divergiria da rota.
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
