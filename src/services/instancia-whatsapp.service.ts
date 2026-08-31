import { prisma } from "@/lib/prisma";
import { instanciaWhatsappRepository } from "@/repositories/instancia-whatsapp.repository";
import { uazapiClient } from "@/lib/external/uazapi-client";
import { logService } from "@/services/log.service";
import { PermissaoNegadaError } from "@/services/membro.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { InstanciaWhatsapp, StatusInstanciaWhatsapp } from "@prisma/client";

export { PermissaoNegadaError };

export class InstanciaWhatsappNaoEncontradaError extends Error {
  constructor() {
    super("Instância de WhatsApp não encontrada.");
    this.name = "InstanciaWhatsappNaoEncontradaError";
  }
}

export class NomeInstanciaDuplicadoError extends Error {
  constructor() {
    super("Já existe uma instância de WhatsApp com este nome neste escritório.");
    this.name = "NomeInstanciaDuplicadoError";
  }
}

export interface DadosNovaInstanciaWhatsapp {
  nome: string;
}

type InstanciaSemToken = Omit<InstanciaWhatsapp, "uazapiToken">;

// Escrita de InstanciaWhatsapp é ação de configuração do escritório: só owner/admin
// (padrao só lê), mesma convenção de tipoProcessoService/statusService.
function exigirPapelDeGestao(ctx: TenantContext): void {
  if (ctx.role === "padrao") {
    throw new PermissaoNegadaError();
  }
}

// uazapiToken nunca é serializado de volta ao chamador.
function semToken(instancia: InstanciaWhatsapp): InstanciaSemToken {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { uazapiToken, ...resto } = instancia;
  return resto;
}

async function obterDoTenant(ctx: TenantContext, id: string): Promise<InstanciaWhatsapp> {
  const instancia = await instanciaWhatsappRepository.findById(id);
  // Instância de outro escritório é tratada como inexistente — não confirma a existência.
  if (!instancia || instancia.escritorioId !== ctx.escritorioId) {
    throw new InstanciaWhatsappNaoEncontradaError();
  }
  return instancia;
}

export const instanciaWhatsappService = {
  async listar(ctx: TenantContext): Promise<InstanciaSemToken[]> {
    const instancias = await instanciaWhatsappRepository.listar(ctx.escritorioId);
    return instancias.map(semToken);
  },

  async criarEConectar(
    ctx: TenantContext,
    dados: DadosNovaInstanciaWhatsapp
  ): Promise<{ instancia: InstanciaSemToken; qrcode?: string; paircode?: string }> {
    exigirPapelDeGestao(ctx);

    const nome = dados.nome.trim();
    const existente = await instanciaWhatsappRepository.findByNome(ctx.escritorioId, nome);
    if (existente) {
      throw new NomeInstanciaDuplicadoError();
    }

    // Chamadas externas acontecem fora da transação: uma transação Prisma não pode
    // ficar aberta esperando uma chamada HTTP lenta pra UAZAPI.
    const criada = await uazapiClient.criarInstancia(nome);
    const conexao = await uazapiClient.conectarInstancia(criada.token);

    const instancia = await prisma.$transaction(async (tx) => {
      const nova = await instanciaWhatsappRepository.create(
        {
          nome,
          uazapiInstanceId: criada.id,
          uazapiToken: criada.token,
          status: conexao.status as StatusInstanciaWhatsapp,
          escritorio: { connect: { id: ctx.escritorioId } },
        },
        tx
      );

      await logService.registrar(
        ctx,
        {
          acao: "criar",
          entidade: "instancia_whatsapp",
          entidadeId: nova.id,
          resumo: `Instância ${nova.nome} criada`,
        },
        tx
      );

      return nova;
    });

    return { instancia: semToken(instancia), qrcode: conexao.qrcode, paircode: conexao.paircode };
  },

  async reconectar(
    ctx: TenantContext,
    id: string
  ): Promise<{ instancia: InstanciaSemToken; qrcode?: string; paircode?: string }> {
    exigirPapelDeGestao(ctx);

    const atual = await obterDoTenant(ctx, id);
    // Reusa o token já salvo — não recria a instância na UAZAPI.
    const conexao = await uazapiClient.conectarInstancia(atual.uazapiToken);

    const instancia = await prisma.$transaction(async (tx) => {
      const atualizada = await instanciaWhatsappRepository.atualizarConexao(
        id,
        { status: conexao.status as StatusInstanciaWhatsapp },
        tx
      );

      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "instancia_whatsapp",
          entidadeId: atualizada.id,
          resumo: `Instância ${atualizada.nome} reconectada`,
        },
        tx
      );

      return atualizada;
    });

    return { instancia: semToken(instancia), qrcode: conexao.qrcode, paircode: conexao.paircode };
  },

  async verificarStatus(ctx: TenantContext, id: string): Promise<InstanciaSemToken> {
    const atual = await obterDoTenant(ctx, id);
    const consulta = await uazapiClient.consultarStatus(atual.uazapiToken);

    const numeroConectado = consulta.numeroConectado ?? null;
    const mudou = consulta.status !== atual.status || numeroConectado !== atual.numeroConectado;

    // Nada mudou de fato: não toca no banco nem polui a auditoria com log vazio.
    if (!mudou) {
      return semToken(atual);
    }

    const instancia = await prisma.$transaction(async (tx) => {
      const atualizada = await instanciaWhatsappRepository.atualizarConexao(
        id,
        { status: consulta.status as StatusInstanciaWhatsapp, numeroConectado },
        tx
      );

      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "instancia_whatsapp",
          entidadeId: atualizada.id,
          resumo: `Status da instância ${atualizada.nome} atualizado`,
        },
        tx
      );

      return atualizada;
    });

    return semToken(instancia);
  },
};
