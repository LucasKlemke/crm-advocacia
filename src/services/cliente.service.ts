import { prisma } from "@/lib/prisma";
import { clienteRepository, type FiltrosCliente } from "@/repositories/cliente.repository";
import { logService } from "@/services/log.service";
import { cpfValido, normalizarCpf } from "@/lib/utils/cpf";
import { calcularDiff } from "@/lib/utils/diff";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Cliente } from "@prisma/client";

export class ClienteNaoEncontradoError extends Error {
  constructor() {
    super("Cliente não encontrado.");
    this.name = "ClienteNaoEncontradoError";
  }
}

export class CpfInvalidoError extends Error {
  constructor() {
    super("CPF inválido.");
    this.name = "CpfInvalidoError";
  }
}

export class CpfDuplicadoError extends Error {
  constructor(excluido: boolean) {
    super(
      excluido
        ? "Já existe um cliente excluído com este CPF. Restaure o cadastro em vez de criar outro."
        : "Já existe um cliente com este CPF neste escritório."
    );
    this.name = "CpfDuplicadoError";
  }
}

export interface DadosNovoCliente {
  nome: string;
  cpf: string;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
}

export type DadosEdicaoCliente = Partial<DadosNovoCliente>;

const CAMPOS_AUDITADOS = ["nome", "cpf", "email", "telefone", "endereco"] as const;

// Clientes são o trabalho diário do escritório: qualquer papel (inclusive padrao)
// pode criar, editar e desativar. A única barreira é o tenant (RN19).
export const clienteService = {
  async listar(ctx: TenantContext, filtros: FiltrosCliente = {}) {
    const [clientes, total] = await Promise.all([
      clienteRepository.listar(ctx.escritorioId, filtros),
      clienteRepository.contar(ctx.escritorioId, filtros),
    ]);
    return { clientes, total };
  },

  async obter(ctx: TenantContext, id: string): Promise<Cliente> {
    const cliente = await clienteRepository.findById(id);
    // Cliente de outro escritório é tratado como inexistente — não confirma a existência.
    if (!cliente || cliente.escritorioId !== ctx.escritorioId) {
      throw new ClienteNaoEncontradoError();
    }
    return cliente;
  },

  async criar(ctx: TenantContext, dados: DadosNovoCliente): Promise<Cliente> {
    const cpf = normalizarCpf(dados.cpf);
    if (!cpfValido(cpf)) {
      throw new CpfInvalidoError();
    }

    const existente = await clienteRepository.findByCpf(ctx.escritorioId, cpf);
    if (existente) {
      throw new CpfDuplicadoError(existente.softDeletedAt !== null);
    }

    return prisma.$transaction(async (tx) => {
      const cliente = await clienteRepository.create(
        {
          nome: dados.nome.trim(),
          cpf,
          email: dados.email?.trim() || null,
          telefone: dados.telefone?.trim() || null,
          endereco: dados.endereco?.trim() || null,
          escritorio: { connect: { id: ctx.escritorioId } },
        },
        tx
      );

      await logService.registrar(
        ctx,
        {
          acao: "criar",
          entidade: "cliente",
          entidadeId: cliente.id,
          resumo: `Cliente ${cliente.nome} criado`,
        },
        tx
      );

      return cliente;
    });
  },

  async atualizar(
    ctx: TenantContext,
    id: string,
    dados: DadosEdicaoCliente
  ): Promise<Cliente> {
    const atual = await this.obter(ctx, id);

    const mudancas: DadosEdicaoCliente = {
      ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
      ...(dados.email !== undefined ? { email: dados.email?.trim() || null } : {}),
      ...(dados.telefone !== undefined ? { telefone: dados.telefone?.trim() || null } : {}),
      ...(dados.endereco !== undefined ? { endereco: dados.endereco?.trim() || null } : {}),
    };

    if (dados.cpf !== undefined) {
      const cpf = normalizarCpf(dados.cpf);
      if (!cpfValido(cpf)) {
        throw new CpfInvalidoError();
      }
      if (cpf !== atual.cpf) {
        const existente = await clienteRepository.findByCpf(ctx.escritorioId, cpf);
        if (existente) {
          throw new CpfDuplicadoError(existente.softDeletedAt !== null);
        }
      }
      mudancas.cpf = cpf;
    }

    const diff = calcularDiff(atual, mudancas, CAMPOS_AUDITADOS);
    // Nada mudou de fato: não toca no banco nem polui a auditoria com log vazio.
    if (!diff) {
      return atual;
    }

    return prisma.$transaction(async (tx) => {
      const cliente = await clienteRepository.update(id, mudancas, tx);
      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "cliente",
          entidadeId: cliente.id,
          resumo: `Cliente ${cliente.nome} atualizado`,
          dados: diff,
        },
        tx
      );
      return cliente;
    });
  },

  // Ação em lote da tabela. Ids de outro escritório ou já excluídos são silenciosamente
  // ignorados (contados em `ignorados`), nunca aplicados.
  async desativarEmLote(
    ctx: TenantContext,
    ids: string[]
  ): Promise<{ desativados: number; ignorados: number }> {
    const doTenant = await clienteRepository.listarPorIds(ctx.escritorioId, ids);
    const alvos = doTenant.filter((cliente) => cliente.softDeletedAt === null);

    if (alvos.length === 0) {
      return { desativados: 0, ignorados: ids.length };
    }

    const quando = new Date();
    await prisma.$transaction(async (tx) => {
      await clienteRepository.marcarExcluidos(
        alvos.map((cliente) => cliente.id),
        quando,
        tx
      );
      // Um log por cliente: a auditoria precisa responder "o que foi feito" por entidade,
      // não por operação de UI.
      for (const cliente of alvos) {
        await logService.registrar(
          ctx,
          {
            acao: "excluir",
            entidade: "cliente",
            entidadeId: cliente.id,
            resumo: `Cliente ${cliente.nome} desativado`,
          },
          tx
        );
      }
    });

    return { desativados: alvos.length, ignorados: ids.length - alvos.length };
  },

  async restaurarEmLote(
    ctx: TenantContext,
    ids: string[]
  ): Promise<{ restaurados: number; ignorados: number }> {
    const doTenant = await clienteRepository.listarPorIds(ctx.escritorioId, ids);
    const alvos = doTenant.filter((cliente) => cliente.softDeletedAt !== null);

    if (alvos.length === 0) {
      return { restaurados: 0, ignorados: ids.length };
    }

    await prisma.$transaction(async (tx) => {
      await clienteRepository.restaurar(
        alvos.map((cliente) => cliente.id),
        tx
      );
      for (const cliente of alvos) {
        await logService.registrar(
          ctx,
          {
            acao: "restaurar",
            entidade: "cliente",
            entidadeId: cliente.id,
            resumo: `Cliente ${cliente.nome} restaurado`,
          },
          tx
        );
      }
    });

    return { restaurados: alvos.length, ignorados: ids.length - alvos.length };
  },
};
