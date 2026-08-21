import { logRepository } from "@/repositories/log.repository";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { AcaoLog, EntidadeLog, Log, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "log">;

export interface RegistroLog {
  acao: AcaoLog;
  entidade: EntidadeLog;
  entidadeId: string;
  resumo: string;
  dados?: Prisma.InputJsonValue | null;
}

// Toda escrita do sistema passa por aqui (RN20). O `db` é o cliente da transação em
// curso: log e mutação nascem juntos, então uma escrita que falha nunca deixa log
// órfão, e um log gravado sempre corresponde a uma mudança que de fato aconteceu.
export const logService = {
  async registrar(ctx: TenantContext, registro: RegistroLog, db?: Db): Promise<Log> {
    return logRepository.create(
      {
        acao: registro.acao,
        entidade: registro.entidade,
        entidadeId: registro.entidadeId,
        resumo: registro.resumo.slice(0, 255),
        ...(registro.dados ? { dados: registro.dados } : {}),
        escritorio: { connect: { id: ctx.escritorioId } },
        usuario: { connect: { id: ctx.usuarioId } },
      },
      db
    );
  },

  async listarPorEntidade(ctx: TenantContext, entidade: EntidadeLog, entidadeId: string) {
    return logRepository.listarPorEntidade(ctx.escritorioId, entidade, entidadeId);
  },
};
