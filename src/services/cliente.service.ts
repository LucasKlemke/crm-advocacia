import { prisma } from "@/lib/prisma";
import { clienteRepository, type FiltrosCliente } from "@/repositories/cliente.repository";
import { logService } from "@/services/log.service";
import { cpfValido, normalizarCpf } from "@/lib/utils/cpf";
import { normalizarTelefone, telefoneValido } from "@/lib/utils/telefone";
import { emailValido, normalizarEmail } from "@/lib/utils/email";
import { calcularDiff } from "@/lib/utils/diff";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Cliente, EstadoCivilCliente, SexoCliente } from "@prisma/client";

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

export class TelefoneInvalidoError extends Error {
  constructor() {
    super("Telefone inválido. Use o formato +55 (00) 00000-0000, com DDD e nono dígito.");
    this.name = "TelefoneInvalidoError";
  }
}

export class EmailInvalidoError extends Error {
  constructor() {
    super("E-mail inválido.");
    this.name = "EmailInvalidoError";
  }
}

export interface DadosNovoCliente {
  nome: string;
  cpf: string;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  sexo?: SexoCliente | null;
  estadoCivil?: EstadoCivilCliente | null;
  nomeMae?: string | null;
  nomePai?: string | null;
  nacionalidade?: string | null;
  nascimento?: Date | null;
  profissao?: string | null;
}

export type DadosEdicaoCliente = Partial<DadosNovoCliente>;

const CAMPOS_AUDITADOS = [
  "nome",
  "cpf",
  "email",
  "telefone",
  "endereco",
  "sexo",
  "estadoCivil",
  "nomeMae",
  "nomePai",
  "nacionalidade",
  "nascimento",
  "profissao",
] as const;

// Telefone e e-mail são opcionais: em branco vira null. Preenchidos, precisam estar
// corretos — o telefone é a chave do disparo de WhatsApp (RN13) e um número mal
// formado só é descoberto na hora em que a mensagem falha.
function prepararTelefone(valor: string | null | undefined): string | null {
  const bruto = valor?.trim();
  if (!bruto) return null;
  if (!telefoneValido(bruto)) throw new TelefoneInvalidoError();
  return normalizarTelefone(bruto);
}

function prepararEmail(valor: string | null | undefined): string | null {
  const bruto = valor?.trim();
  if (!bruto) return null;
  if (!emailValido(bruto)) throw new EmailInvalidoError();
  return normalizarEmail(bruto);
}

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
    // Validado antes da transação: entrada malformada não chega a consultar o banco.
    const email = prepararEmail(dados.email);
    const telefone = prepararTelefone(dados.telefone);

    const existente = await clienteRepository.findByCpf(ctx.escritorioId, cpf);
    if (existente) {
      throw new CpfDuplicadoError(existente.softDeletedAt !== null);
    }

    return prisma.$transaction(async (tx) => {
      const cliente = await clienteRepository.create(
        {
          nome: dados.nome.trim(),
          cpf,
          email,
          telefone,
          endereco: dados.endereco?.trim() || null,
          sexo: dados.sexo ?? null,
          estadoCivil: dados.estadoCivil ?? null,
          nomeMae: dados.nomeMae?.trim() || null,
          nomePai: dados.nomePai?.trim() || null,
          nacionalidade: dados.nacionalidade?.trim() || null,
          nascimento: dados.nascimento ?? null,
          profissao: dados.profissao?.trim() || null,
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
      ...(dados.email !== undefined ? { email: prepararEmail(dados.email) } : {}),
      ...(dados.telefone !== undefined ? { telefone: prepararTelefone(dados.telefone) } : {}),
      ...(dados.endereco !== undefined ? { endereco: dados.endereco?.trim() || null } : {}),
      ...(dados.sexo !== undefined ? { sexo: dados.sexo ?? null } : {}),
      ...(dados.estadoCivil !== undefined ? { estadoCivil: dados.estadoCivil ?? null } : {}),
      ...(dados.nomeMae !== undefined ? { nomeMae: dados.nomeMae?.trim() || null } : {}),
      ...(dados.nomePai !== undefined ? { nomePai: dados.nomePai?.trim() || null } : {}),
      ...(dados.nacionalidade !== undefined
        ? { nacionalidade: dados.nacionalidade?.trim() || null }
        : {}),
      ...(dados.nascimento !== undefined ? { nascimento: dados.nascimento ?? null } : {}),
      ...(dados.profissao !== undefined ? { profissao: dados.profissao?.trim() || null } : {}),
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
