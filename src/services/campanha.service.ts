import { prisma } from "@/lib/prisma";
import { campanhaRepository } from "@/repositories/campanha.repository";
import { campanhaItemRepository } from "@/repositories/campanha-item.repository";
import { instanciaWhatsappService } from "@/services/instancia-whatsapp.service";
import { logService } from "@/services/log.service";
import { PermissaoNegadaError } from "@/services/membro.service";
import {
  uazapiClient,
  UazapiIndisponivelError,
  type AcaoCampanhaUazapi,
  type CampanhaUazapi,
  type MensagemCampanhaUazapi,
  type MensagemEnvioAvancado,
} from "@/lib/external/uazapi-client";
import { MAX_DESTINATARIOS } from "@/lib/api/schemas-campanha";
import { normalizarTelefone, telefoneValido } from "@/lib/utils/telefone";
import {
  extrairVariaveis,
  renderizarMensagem,
  resolverValor,
  type ConfigVariavel,
  type LinhaCsv,
} from "@/lib/utils/campanha-mensagem";
import {
  chaveTelefone,
  numeroDoChatid,
  paraDataMensagem,
  paraStatusMensagem,
  type StatusMensagem,
} from "@/lib/utils/campanha-status-mensagem";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { CampanhaComInstancia } from "@/repositories/campanha.repository";
import type { CampanhaItem, Prisma, StatusCampanha } from "@prisma/client";

export { PermissaoNegadaError };

export class CampanhaNaoEncontradaError extends Error {
  constructor() {
    super("Campanha não encontrada.");
    this.name = "CampanhaNaoEncontradaError";
  }
}

export class InstanciaNaoConectadaError extends Error {
  constructor() {
    super("A instância de WhatsApp precisa estar conectada para disparar uma campanha.");
    this.name = "InstanciaNaoConectadaError";
  }
}

export class VariavelSemColunaError extends Error {
  constructor(variaveis: string[]) {
    super(
      `Defina de qual coluna da planilha vem ${
        variaveis.length === 1 ? "a variável" : "as variáveis"
      } ${variaveis.map((v) => `{{${v}}}`).join(", ")}.`
    );
    this.name = "VariavelSemColunaError";
  }
}

export class DestinatariosInvalidosError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "DestinatariosInvalidosError";
  }
}

// Campanha antiga cuja instância foi removida: sobrou como histórico, mas sem o token não
// há como falar com a UAZAPI em nome dela.
export class CampanhaSemInstanciaError extends Error {
  constructor() {
    super(
      "A instância de WhatsApp desta campanha não existe mais — não é possível sincronizar nem controlar o envio."
    );
    this.name = "CampanhaSemInstanciaError";
  }
}

export interface DadosNovaCampanha {
  nome: string;
  instanciaId: string;
  mensagemTemplate: string;
  colunaNumero: string;
  mapeamentoVariaveis: Record<string, ConfigVariavel>;
  delayMin: number;
  delayMax: number;
  agendadaPara?: Date;
  arquivoCsvNome?: string;
  linhas: LinhaCsv[];
}

export const ITENS_POR_PAGINA = 50;
// Folga sobre o total de destinatários ao pedir as mensagens: a UAZAPI pode ter mais de
// uma mensagem por número (retentativa), e pedir de menos deixaria destinatário sem status.
const MENSAGENS_POR_DESTINATARIO = 2;
// Quantas linhas de CSV são citadas na mensagem de erro antes de virar "e mais N".
const MAX_LINHAS_NO_ERRO = 5;
// createMany de milhares de linhas + o log ainda cabem folgado nisso, mas o default de
// 5s do Prisma é apertado demais para uma campanha grande.
const TIMEOUT_TRANSACAO_MS = 30_000;

// Disparo em massa é ação de gestão do escritório: `padrao` só lê, mesma convenção de
// instanciaWhatsappService/tipoProcessoService.
function exigirPapelDeGestao(ctx: TenantContext): void {
  if (ctx.role === "padrao") {
    throw new PermissaoNegadaError();
  }
}

const STATUS_POR_UAZAPI: Record<string, StatusCampanha> = {
  scheduled: "agendada",
  sending: "enviando",
  paused: "pausada",
  done: "concluida",
  deleting: "excluindo",
};

// Mesma defesa de paraStatusInstancia: um status fora do contrato viraria
// PrismaClientValidationError, cuja mensagem ecoa o `data` inteiro da chamada — e esse
// erro acaba num console.error do Route Handler.
function paraStatusCampanha(valor: string): StatusCampanha {
  const status = STATUS_POR_UAZAPI[valor];
  if (!status) {
    throw new UazapiIndisponivelError("A UAZAPI retornou um status de campanha inesperado.");
  }
  return status;
}

// Estanca um envio que a UAZAPI já aceitou mas que não conseguimos registrar aqui.
// Best-effort de propósito: se o cancelamento também falhar, quem precisa chegar ao
// usuário é o erro original da gravação — trocá-lo pelo desta limpeza esconderia a causa.
async function cancelarEnvio(token: string, folderId: string): Promise<void> {
  try {
    await uazapiClient.controlarCampanha(token, folderId, "delete");
  } catch {
    // Sem o que fazer daqui: a campanha ficou disparando na UAZAPI sem registro local.
  }
}

async function obterDoTenant(ctx: TenantContext, id: string): Promise<CampanhaComInstancia> {
  const campanha = await campanhaRepository.findById(id);
  // Campanha de outro escritório é tratada como inexistente — não confirma a existência.
  if (!campanha || campanha.escritorioId !== ctx.escritorioId) {
    throw new CampanhaNaoEncontradaError();
  }
  return campanha;
}

// O token não está na campanha: é resolvido na hora a partir da instância vinculada, que
// o instanciaWhatsappService valida como sendo deste tenant.
async function obterTokenDaInstancia(
  ctx: TenantContext,
  campanha: CampanhaComInstancia
): Promise<string> {
  if (!campanha.instanciaWhatsappId) {
    throw new CampanhaSemInstanciaError();
  }
  const instancia = await instanciaWhatsappService.obterComToken(
    ctx,
    campanha.instanciaWhatsappId
  );
  return instancia.uazapiToken;
}

export interface MensagemDaCampanha {
  numero: string;
  status: StatusMensagem;
  erro: string | null;
  enviadaEm: Date | null;
}

function paraMensagemDaCampanha(mensagem: MensagemCampanhaUazapi): MensagemDaCampanha {
  return {
    numero: numeroDoChatid(mensagem.chatid),
    status: paraStatusMensagem(mensagem.status),
    erro: mensagem.erro ?? null,
    enviadaEm: paraDataMensagem(mensagem.messageTimestamp),
  };
}

interface DestinatarioRenderizado {
  linha: number;
  numero: string;
  mensagem: string;
  variaveis: Record<string, string>;
}

// Valida o CSV contra o template e devolve as mensagens já prontas. Toda a validação de
// domínio acontece aqui, antes de qualquer chamada externa ou escrita.
function montarDestinatarios(dados: DadosNovaCampanha): DestinatarioRenderizado[] {
  const colunas = new Set(Object.keys(dados.linhas[0] ?? {}));

  if (!colunas.has(dados.colunaNumero)) {
    throw new DestinatariosInvalidosError(
      `A planilha não tem a coluna "${dados.colunaNumero}" com os números de destino.`
    );
  }

  // Uma variável sem coluna (ou apontando para coluna que não existe na planilha) seria
  // enviada crua — "Olá {{nome}}" — pro cliente.
  const semColuna = extrairVariaveis(dados.mensagemTemplate).filter((variavel) => {
    const config = dados.mapeamentoVariaveis[variavel];
    return !config?.coluna || !colunas.has(config.coluna);
  });
  if (semColuna.length > 0) {
    throw new VariavelSemColunaError(semColuna);
  }

  const invalidas: number[] = [];
  const destinatarios: DestinatarioRenderizado[] = [];

  dados.linhas.forEach((linha, indice) => {
    // 1-based e sem contar o cabeçalho: é o número que o usuário vê na planilha dele.
    const numeroDaLinha = indice + 1;
    const numero = normalizarTelefone(linha[dados.colunaNumero] ?? "");

    if (!telefoneValido(numero)) {
      invalidas.push(numeroDaLinha);
      return;
    }

    destinatarios.push({
      linha: numeroDaLinha,
      numero,
      mensagem: renderizarMensagem(dados.mensagemTemplate, linha, dados.mapeamentoVariaveis),
      // Guarda o valor já tratado — o que de fato entrou na mensagem —, e não a célula
      // crua: é o snapshot do envio. Só as variáveis usadas pelo template, porque copiar a
      // linha inteira do CSV seria reter dado pessoal que a campanha não precisa.
      variaveis: Object.fromEntries(
        Object.entries(dados.mapeamentoVariaveis).map(([variavel, config]) => [
          variavel,
          resolverValor(config, linha),
        ])
      ),
    });
  });

  // Tudo ou nada: enviar só parte da lista sem o usuário perceber é pior do que recusar e
  // deixar ele corrigir a planilha.
  if (invalidas.length > 0) {
    const citadas = invalidas.slice(0, MAX_LINHAS_NO_ERRO).join(", ");
    const resto = invalidas.length - MAX_LINHAS_NO_ERRO;
    throw new DestinatariosInvalidosError(
      `Número de WhatsApp inválido na linha ${citadas}${resto > 0 ? ` e mais ${resto}` : ""}. ` +
        "Use o formato com DDI e DDD, por exemplo 5511999999999."
    );
  }

  return destinatarios;
}

// Contadores + status vindos da UAZAPI, comparados com o que já está salvo — sincronização
// que não muda nada não escreve nem gera log (mesmo critério do verificarStatus de instância).
function compararSincronizacao(
  atual: CampanhaComInstancia,
  remota: CampanhaUazapi
): Prisma.CampanhaUncheckedUpdateInput | null {
  const mudancas = {
    status: paraStatusCampanha(remota.status),
    logTotal: remota.logTotal,
    logSucesso: remota.logSucesso,
    logFalha: remota.logFalha,
    logEntregue: remota.logEntregue,
    logLido: remota.logLido,
    logReproduzido: remota.logReproduzido,
  };

  const mudou = Object.entries(mudancas).some(
    ([campo, valor]) => atual[campo as keyof typeof mudancas] !== valor
  );

  return mudou ? mudancas : null;
}

export const campanhaService = {
  async listar(ctx: TenantContext): Promise<CampanhaComInstancia[]> {
    return campanhaRepository.listar(ctx.escritorioId);
  },

  async obter(ctx: TenantContext, id: string): Promise<CampanhaComInstancia> {
    return obterDoTenant(ctx, id);
  },

  async listarItens(
    ctx: TenantContext,
    id: string,
    { pagina }: { pagina: number }
  ): Promise<{ itens: CampanhaItem[]; total: number; pagina: number; porPagina: number }> {
    // Confirma o tenant antes de tocar nos itens: eles são endereçados por campanhaId.
    await obterDoTenant(ctx, id);

    const [itens, total] = await Promise.all([
      campanhaItemRepository.listarPorCampanha(id, {
        pular: (pagina - 1) * ITENS_POR_PAGINA,
        limite: ITENS_POR_PAGINA,
      }),
      campanhaItemRepository.contarPorCampanha(id),
    ]);

    return { itens, total, pagina, porPagina: ITENS_POR_PAGINA };
  },

  // O status de cada mensagem não é espelhado no banco: só a UAZAPI sabe o que aconteceu
  // com cada destinatário, então a consulta é ao vivo. Leitura, liberada para qualquer
  // papel — e sem exigir instância conectada: consultar histórico não é disparar.
  async listarMensagens(
    ctx: TenantContext,
    id: string,
    { pagina }: { pagina: number }
  ): Promise<{ mensagens: MensagemDaCampanha[]; total: number; truncado: boolean }> {
    const campanha = await obterDoTenant(ctx, id);
    const token = await obterTokenDaInstancia(ctx, campanha);

    // A janela é dimensionada pela campanha, não pela página da tela. Recortá-la por
    // página seria mais barato, mas a UAZAPI não garante devolver as mensagens na ordem
    // das linhas do CSV (o delay é sorteado e há retentativas), e o mesmo número pode
    // aparecer em linhas diferentes: um destinatário real cairia fora da janela e a tela
    // afirmaria que a UAZAPI não devolveu mensagem para ele — inventar ausência é o que
    // a RN29 proíbe. O `limit` explícito também evita depender do teto padrão do endpoint.
    const limit = Math.min(
      campanha.totalDestinatarios * MENSAGENS_POR_DESTINATARIO,
      MAX_DESTINATARIOS
    );
    const resposta = await uazapiClient.listarMensagensCampanha(token, campanha.uazapiFolderId, {
      limit,
      offset: 0,
    });

    // O join fica no servidor: a página do banco diz QUAIS números interessam e só as
    // mensagens deles atravessam para o browser, que antes recebia a campanha inteira
    // (até 5000 objetos) para desenhar 50 linhas. O casamento é por número normalizado —
    // nunca por posição —, então o resumo por gravidade/contagem segue exato no cliente.
    const itens = await campanhaItemRepository.listarPorCampanha(id, {
      pular: (pagina - 1) * ITENS_POR_PAGINA,
      limite: ITENS_POR_PAGINA,
    });
    const daPagina = new Set(itens.map((item) => chaveTelefone(item.numero)));

    return {
      mensagens: resposta.mensagens
        .map(paraMensagemDaCampanha)
        .filter((mensagem) => daPagina.has(chaveTelefone(mensagem.numero))),
      total: resposta.total,
      // A UAZAPI devolveu menos do que diz existir: alguns destinatários vão aparecer sem
      // status, e a tela precisa dizer isso em vez de deixar parecer "nunca enviada".
      truncado: resposta.total > resposta.mensagens.length,
    };
  },

  async criar(ctx: TenantContext, dados: DadosNovaCampanha): Promise<CampanhaComInstancia> {
    exigirPapelDeGestao(ctx);

    // Variante estrita de propósito: uma instância excluída mantém `status: connected` na
    // linha local, então usar obterComToken aqui deixaria disparar campanha nova por uma
    // instância morta. O caminho permissivo é só para o histórico (sincronizar/controlar).
    const instancia = await instanciaWhatsappService.obterAtivaComToken(ctx, dados.instanciaId);
    if (instancia.status !== "connected") {
      throw new InstanciaNaoConectadaError();
    }

    const destinatarios = montarDestinatarios(dados);

    const messages: MensagemEnvioAvancado[] = destinatarios.map((destinatario) => ({
      number: destinatario.numero,
      type: "text",
      text: destinatario.mensagem,
    }));

    // Chamada externa fora da transação: uma transação Prisma não pode ficar aberta
    // esperando o HTTP da UAZAPI. Se ela falhar, nada foi gravado — e se ela funcionar
    // mas a gravação falhar, o envio é cancelado no catch mais abaixo.
    const envio = await uazapiClient.criarEnvioAvancado(instancia.uazapiToken, {
      delayMin: dados.delayMin,
      delayMax: dados.delayMax,
      info: dados.nome,
      ...(dados.agendadaPara ? { scheduledFor: dados.agendadaPara.getTime() } : {}),
      messages,
    });

    return prisma.$transaction(
      async (tx) => {
        const campanha = await campanhaRepository.create(
          {
            nome: dados.nome,
            mensagemTemplate: dados.mensagemTemplate,
            mapeamentoVariaveis: dados.mapeamentoVariaveis as unknown as Prisma.InputJsonValue,
            colunaNumero: dados.colunaNumero,
            ...(dados.arquivoCsvNome ? { arquivoCsvNome: dados.arquivoCsvNome } : {}),
            delayMin: dados.delayMin,
            delayMax: dados.delayMax,
            ...(dados.agendadaPara ? { agendadaPara: dados.agendadaPara } : {}),
            uazapiFolderId: envio.folderId,
            totalDestinatarios: destinatarios.length,
            escritorio: { connect: { id: ctx.escritorioId } },
            instancia: { connect: { id: instancia.id } },
            criadoPor: { connect: { id: ctx.usuarioId } },
          },
          tx
        );

        await campanhaItemRepository.createMany(
          destinatarios.map((destinatario) => ({
            escritorioId: ctx.escritorioId,
            campanhaId: campanha.id,
            linha: destinatario.linha,
            numero: destinatario.numero,
            mensagem: destinatario.mensagem,
            variaveis: destinatario.variaveis,
          })),
          tx
        );

        await logService.registrar(
          ctx,
          {
            acao: "criar",
            entidade: "campanha",
            entidadeId: campanha.id,
            resumo: `Campanha ${campanha.nome} criada com ${destinatarios.length} destinatário(s)`,
            dados: { instanciaId: instancia.id, uazapiFolderId: envio.folderId },
          },
          tx
        );

        return {
          ...campanha,
          instancia: {
            id: instancia.id,
            nome: instancia.nome,
            status: instancia.status,
            softDeletedAt: instancia.softDeletedAt,
          },
        };
      },
      { timeout: TIMEOUT_TRANSACAO_MS }
      // Neste ponto a campanha já foi aceita pela UAZAPI e pode estar disparando. Se a
      // gravação falhar, o folderId morre junto com o erro: sem ele não há como chegar em
      // /sender/edit depois, e as mensagens continuariam saindo sem nenhum registro local
      // — invisíveis na UI e impossíveis de parar. Cancelar o envio é o que fecha essa
      // janela; o erro que sobe continua sendo o da gravação, que é o que explica a falha.
    ).catch(async (erro: unknown) => {
      await cancelarEnvio(instancia.uazapiToken, envio.folderId);
      throw erro;
    });
  },

  // Leitura de estado, liberada para qualquer papel — igual a verificarStatus de instância.
  async sincronizar(ctx: TenantContext, id: string): Promise<CampanhaComInstancia> {
    const campanha = await obterDoTenant(ctx, id);
    const token = await obterTokenDaInstancia(ctx, campanha);

    const folders = await uazapiClient.listarCampanhas(token);
    const remota = folders.find((folder) => folder.id === campanha.uazapiFolderId);
    // Folder some da UAZAPI depois de um delete concluído. Manter o estado local é mais
    // honesto do que inventar um status a partir da ausência.
    if (!remota) return campanha;

    const mudancas = compararSincronizacao(campanha, remota);
    if (!mudancas) return campanha;

    return prisma.$transaction(async (tx) => {
      const atualizada = await campanhaRepository.update(
        id,
        { ...mudancas, sincronizadoEm: new Date() },
        tx
      );

      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "campanha",
          entidadeId: id,
          resumo: `Campanha ${campanha.nome} sincronizada com a UAZAPI`,
          dados: mudancas as Prisma.InputJsonValue,
        },
        tx
      );

      return { ...campanha, ...atualizada };
    });
  },

  async controlar(
    ctx: TenantContext,
    id: string,
    acao: AcaoCampanhaUazapi
  ): Promise<CampanhaComInstancia | null> {
    exigirPapelDeGestao(ctx);

    const campanha = await obterDoTenant(ctx, id);
    const token = await obterTokenDaInstancia(ctx, campanha);

    // A UAZAPI é a dona do envio: só depois que ela aceita a ação o estado local muda.
    await uazapiClient.controlarCampanha(token, campanha.uazapiFolderId, acao);

    if (acao === "delete") {
      await prisma.$transaction(async (tx) => {
        await campanhaRepository.delete(id, tx);
        await logService.registrar(
          ctx,
          {
            acao: "excluir",
            entidade: "campanha",
            entidadeId: id,
            resumo: `Campanha ${campanha.nome} excluída`,
          },
          tx
        );
      });
      // Sem linha local: o listfolders nunca mais devolveria essa campanha, e o log
      // append-only é o que preserva o rastro.
      return null;
    }

    // Retomar não tem um status único: a campanha volta para a fila de agendamento se a
    // data ainda está à frente, e volta a disparar se já passou (ou se nunca houve
    // agendamento). Gravar sempre "agendada" fazia a tela anunciar "Agendada" para uma
    // campanha que estava mandando mensagem, até alguém clicar em Sincronizar.
    const retomadoComo: StatusCampanha =
      campanha.agendadaPara && campanha.agendadaPara.getTime() > Date.now()
        ? "agendada"
        : "enviando";
    const status: StatusCampanha = acao === "stop" ? "pausada" : retomadoComo;

    return prisma.$transaction(async (tx) => {
      const atualizada = await campanhaRepository.update(id, { status }, tx);
      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "campanha",
          entidadeId: id,
          resumo: `Campanha ${campanha.nome} ${acao === "stop" ? "pausada" : "retomada"}`,
        },
        tx
      );
      return { ...campanha, ...atualizada };
    });
  },
};
