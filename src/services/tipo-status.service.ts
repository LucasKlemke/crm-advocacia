import { tipoStatusRepository } from "@/repositories/tipo-status.repository";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { TipoStatus } from "@prisma/client";

// Tabela global, somente leitura: qualquer membro autenticado do escritório pode
// consultar os tipos disponíveis para montar o próprio funil de Status.
export const tipoStatusService = {
  // Recebe TenantContext por simetria com os demais Services (e para o dia em que a
  // rota precisar auditar quem consultou), embora a leitura em si não use escritorioId.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listar(ctx: TenantContext): Promise<TipoStatus[]> {
    return tipoStatusRepository.listar();
  },
};
