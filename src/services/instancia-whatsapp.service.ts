import { prisma } from "@/lib/prisma";
import { instanciaWhatsappRepository } from "@/repositories/instancia-whatsapp.repository";
import { uazapiClient, UazapiIndisponivelError } from "@/lib/external/uazapi-client";
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

const STATUS_VALIDOS: readonly StatusInstanciaWhatsapp[] = [
  "disconnected",
  "connecting",
  "connected",
  "hibernated",
];

// Valida em runtime o status devolvido pela UAZAPI antes que ele chegue perto do Prisma:
// um valor fora do enum viraria PrismaClientValidationError, cuja mensagem ecoa o `data`
// inteiro da chamada (incluindo uazapiToken) — e aquele erro acaba em console.error no
// Route Handler. Virando UazapiIndisponivelError aqui, o problema é um erro de domínio
// com mensagem genérica, tratado antes de qualquer escrita no banco.
function paraStatusInstancia(valor: string): StatusInstanciaWhatsapp {
  if ((STATUS_VALIDOS as readonly string[]).includes(valor)) {
    return valor as StatusInstanciaWhatsapp;
  }
  throw new UazapiIndisponivelError("A UAZAPI retornou um status de instância inesperado.");
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

    // A UAZAPI é uma conta única compartilhada por todos os escritórios: `nome` só é
    // único no nosso banco (por escritório), então o valor enviado como `name` pra
    // UAZAPI é namespaced por tenant pra nunca colidir com o de outro escritório do
    // lado de lá. O `nome` local (armazenado e exibido) permanece o digitado pelo usuário.
    const nomeNamespaced = `${ctx.escritorioId}:${nome}`;

    // Chamadas externas acontecem fora da transação: uma transação Prisma não pode
    // ficar aberta esperando uma chamada HTTP lenta pra UAZAPI.
    const criada = await uazapiClient.criarInstancia(nomeNamespaced, {
      adminField01: ctx.escritorioId,
    });
    const conexao = await uazapiClient.conectarInstancia(criada.token);
    // Valida o status ANTES de entrar na transação: um status fora do contrato aborta
    // aqui, sem nenhuma escrita no banco e sem log.
    const statusValidado = paraStatusInstancia(conexao.status);

    const instancia = await prisma.$transaction(async (tx) => {
      const nova = await instanciaWhatsappRepository.create(
        {
          nome,
          uazapiInstanceId: criada.id,
          uazapiToken: criada.token,
          status: statusValidado,
          // Instância recém-criada normalmente ainda não tem número/foto, mas o usuário
          // confirmou que /instance/connect às vezes já os devolve — passa adiante quando vem.
          ...(conexao.numeroConectado !== undefined
            ? { numeroConectado: conexao.numeroConectado }
            : {}),
          ...(conexao.fotoPerfilUrl !== undefined ? { fotoPerfilUrl: conexao.fotoPerfilUrl } : {}),
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
    // Valida o status ANTES de entrar na transação: um status fora do contrato aborta
    // aqui, sem nenhuma escrita no banco e sem log.
    const statusValidado = paraStatusInstancia(conexao.status);

    const instancia = await prisma.$transaction(async (tx) => {
      const atualizada = await instanciaWhatsappRepository.atualizarConexao(
        id,
        {
          status: statusValidado,
          // Mesma lógica de criarEConectar: passa adiante numeroConectado/fotoPerfilUrl
          // quando /instance/connect já os devolve.
          ...(conexao.numeroConectado !== undefined
            ? { numeroConectado: conexao.numeroConectado }
            : {}),
          ...(conexao.fotoPerfilUrl !== undefined ? { fotoPerfilUrl: conexao.fotoPerfilUrl } : {}),
        },
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
    // Valida o status ANTES de qualquer comparação/escrita: um status fora do contrato
    // aborta aqui, sem nenhuma escrita no banco e sem log.
    const statusValidado = paraStatusInstancia(consulta.status);

    const numeroConectado = consulta.numeroConectado ?? null;
    const fotoPerfilUrl = consulta.fotoPerfilUrl ?? null;
    const mudou =
      statusValidado !== atual.status ||
      numeroConectado !== atual.numeroConectado ||
      fotoPerfilUrl !== atual.fotoPerfilUrl;

    // Nada mudou de fato: não toca no banco nem polui a auditoria com log vazio.
    if (!mudou) {
      return semToken(atual);
    }

    const instancia = await prisma.$transaction(async (tx) => {
      const atualizada = await instanciaWhatsappRepository.atualizarConexao(
        id,
        { status: statusValidado, numeroConectado, fotoPerfilUrl },
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
