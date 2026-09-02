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
  // A excluída mantém o nome reservado (o @@unique abrange as duas), então o usuário
  // precisa saber por que um nome que não aparece em lugar nenhum está ocupado — mesma
  // distinção que CpfDuplicadoError faz no cadastro de cliente.
  constructor(excluida: boolean) {
    super(
      excluida
        ? "Já existe uma instância excluída com este nome. Escolha outro nome para a nova instância."
        : "Já existe uma instância de WhatsApp com este nome neste escritório."
    );
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

// Permissivo quanto ao soft delete: resolve inclusive a instância excluída. É por aqui que
// obterComToken devolve o token de uma instância removida, sem o qual as campanhas dela
// ficariam sem canal de controle com a UAZAPI.
async function obterDoTenant(ctx: TenantContext, id: string): Promise<InstanciaWhatsapp> {
  const instancia = await instanciaWhatsappRepository.findById(id);
  // Instância de outro escritório é tratada como inexistente — não confirma a existência.
  if (!instancia || instancia.escritorioId !== ctx.escritorioId) {
    throw new InstanciaWhatsappNaoEncontradaError();
  }
  return instancia;
}

// Estrito: instância excluída é tratada como inexistente. Usado por tudo que age sobre a
// instância (reconectar/desconectar/verificar/excluir) e por quem cria campanha nova —
// só a consulta ao histórico pode alcançar uma excluída.
async function obterAtivaDoTenant(ctx: TenantContext, id: string): Promise<InstanciaWhatsapp> {
  const instancia = await obterDoTenant(ctx, id);
  if (instancia.softDeletedAt !== null) {
    throw new InstanciaWhatsappNaoEncontradaError();
  }
  return instancia;
}

// Roda `acao` e, se ela falhar, apaga na UAZAPI a instância recém-criada cujo token ainda
// não foi persistido. Sem isso a instância fica órfã na conta compartilhada por todos os
// escritórios: `deletarInstancia` exige o token, que só existia nesta variável local, e
// `sincronizarTodas` só enxerga o que está no banco.
// A limpeza é best-effort — se ela também falhar, quem sobe é o erro original, que é o que
// explica o problema pro usuário.
async function comLimpezaNaUazapi<T>(token: string, acao: () => Promise<T>): Promise<T> {
  try {
    return await acao();
  } catch (erro) {
    try {
      await uazapiClient.deletarInstancia(token);
    } catch {
      // Instância órfã na UAZAPI é um problema operacional; mascarar a causa raiz aqui
      // seria pior, porque é ela que o usuário precisa ver.
    }
    throw erro;
  }
}

// Compara o estado local com o que a UAZAPI acabou de devolver — mesma regra de
// mudança usada tanto por verificarStatus (uma instância) quanto por sincronizarTodas
// (um lote): status/numeroConectado/fotoPerfilUrl diferentes do que já está salvo.
function compararConexao(
  atual: InstanciaWhatsapp,
  remota: { status: StatusInstanciaWhatsapp; numeroConectado?: string; fotoPerfilUrl?: string }
): { mudou: boolean; numeroConectado: string | null; fotoPerfilUrl: string | null } {
  const numeroConectado = remota.numeroConectado ?? null;
  const fotoPerfilUrl = remota.fotoPerfilUrl ?? null;
  const mudou =
    remota.status !== atual.status ||
    numeroConectado !== atual.numeroConectado ||
    fotoPerfilUrl !== atual.fotoPerfilUrl;
  return { mudou, numeroConectado, fotoPerfilUrl };
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
      throw new NomeInstanciaDuplicadoError(existente.softDeletedAt !== null);
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

    // Daqui em diante a instância já existe na conta UAZAPI compartilhada, mas o token
    // dela ainda não foi persistido. Qualquer falha antes da gravação precisa desfazer a
    // criação lá: descartar o token deixaria a instância órfã e irremovível (deletar exige
    // o token, e sincronizarTodas só enxerga o que está no banco).
    return comLimpezaNaUazapi(criada.token, async () => {
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
            ...(conexao.fotoPerfilUrl !== undefined
              ? { fotoPerfilUrl: conexao.fotoPerfilUrl }
              : {}),
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
    });
  },

  async reconectar(
    ctx: TenantContext,
    id: string
  ): Promise<{ instancia: InstanciaSemToken; qrcode?: string; paircode?: string }> {
    exigirPapelDeGestao(ctx);

    const atual = await obterAtivaDoTenant(ctx, id);
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

  // Encerra a sessão do WhatsApp sem apagar a instância: o vínculo com a UAZAPI (id +
  // token) continua valendo, então reconectar depois é só escanear um QR novo.
  async desconectar(ctx: TenantContext, id: string): Promise<InstanciaSemToken> {
    exigirPapelDeGestao(ctx);

    const atual = await obterAtivaDoTenant(ctx, id);
    // Chamada externa fora da transação — e antes dela: se a UAZAPI recusar, o estado
    // local continua refletindo a sessão que ainda está de pé, sem log de mentira.
    await uazapiClient.desconectarInstancia(atual.uazapiToken);

    const instancia = await prisma.$transaction(async (tx) => {
      const atualizada = await instanciaWhatsappRepository.atualizarConexao(
        id,
        // Status fixo em vez do devolvido pela UAZAPI (ver comentário em
        // uazapiClient.desconectarInstancia). numeroConectado/fotoPerfilUrl são limpos
        // porque pertenciam à sessão encerrada: o próximo QR pode ser lido por outro
        // número, e até lá exibir o antigo seria informação errada.
        { status: "disconnected", numeroConectado: null, fotoPerfilUrl: null },
        tx
      );

      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "instancia_whatsapp",
          entidadeId: atualizada.id,
          resumo: `Instância ${atualizada.nome} desconectada`,
        },
        tx
      );

      return atualizada;
    });

    return semToken(instancia);
  },

  // Remove a instância dos dois lados: primeiro na UAZAPI, depois aqui. Aqui a remoção é
  // soft (RN30): a linha guarda o uazapi_token, e apagá-la deixaria toda campanha daquela
  // instância sem canal de controle — sem poder sincronizar, pausar nem excluir.
  async excluir(ctx: TenantContext, id: string): Promise<void> {
    exigirPapelDeGestao(ctx);

    const atual = await obterAtivaDoTenant(ctx, id);
    // Ordem proposital: se a UAZAPI recusar, nada é removido daqui e a instância segue
    // utilizável. O inverso — apagar local e falhar lá — deixaria uma instância órfã na
    // UAZAPI, invisível pro escritório e impossível de excluir pela UI.
    await uazapiClient.deletarInstancia(atual.uazapiToken);

    await prisma.$transaction(async (tx) => {
      await instanciaWhatsappRepository.marcarExcluida(id, new Date(), tx);

      await logService.registrar(
        ctx,
        {
          acao: "excluir",
          entidade: "instancia_whatsapp",
          entidadeId: id,
          resumo: `Instância ${atual.nome} excluída`,
        },
        tx
      );
    });
  },

  // Uso exclusivo de outro Service no servidor (campanha.service precisa do token para
  // falar com a UAZAPI em nome desta instância). O retorno inclui uazapiToken: NUNCA
  // devolva o objeto desta função numa resposta HTTP — para isso existe `listar`/
  // `verificarStatus`, que já passam por semToken. A checagem de tenant vive aqui, e não
  // duplicada no chamador.
  async obterComToken(ctx: TenantContext, id: string): Promise<InstanciaWhatsapp> {
    return obterDoTenant(ctx, id);
  },

  // Variante estrita de obterComToken, para quem vai iniciar um disparo novo: uma instância
  // excluída mantém `status: connected` na linha local, então sem esta checagem daria para
  // criar campanha numa instância morta mandando o id direto pra rota.
  async obterAtivaComToken(ctx: TenantContext, id: string): Promise<InstanciaWhatsapp> {
    return obterAtivaDoTenant(ctx, id);
  },

  async verificarStatus(ctx: TenantContext, id: string): Promise<InstanciaSemToken> {
    const atual = await obterAtivaDoTenant(ctx, id);
    const consulta = await uazapiClient.consultarStatus(atual.uazapiToken);
    // Valida o status ANTES de qualquer comparação/escrita: um status fora do contrato
    // aborta aqui, sem nenhuma escrita no banco e sem log.
    const statusValidado = paraStatusInstancia(consulta.status);

    const { mudou, numeroConectado, fotoPerfilUrl } = compararConexao(atual, {
      status: statusValidado,
      numeroConectado: consulta.numeroConectado,
      fotoPerfilUrl: consulta.fotoPerfilUrl,
    });

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

  // Sem exigirPapelDeGestao: leitura + escrita condicional disponível a qualquer membro
  // do tenant, mesmo padrão de verificarStatus (não é ação de configuração).
  //
  // /instance/all é uma chamada de conta inteira (admintoken) que devolve instâncias de
  // TODOS os escritórios que usam essa conta UAZAPI compartilhada — nunca só as do
  // chamador. Por isso (RN19) o casamento com o que já pertence a este escritório
  // acontece inteiramente aqui: só instâncias já presentes em `locais` (linhas que já
  // são deste escritório) podem ser tocadas, casadas pelo `uazapiInstanceId` que já
  // guardamos localmente. Uma entrada remota sem correspondência local nunca vira uma
  // linha nova e nunca é usada pra atualizar outra coisa. E o inverso: uma linha JÁ
  // deste escritório sem correspondência remota é tratada como instância fantasma
  // (removida direto na UAZAPI) e é marcada como excluída daqui — nunca fica só
  // "ignorada", mas também nunca é apagada: a linha é a única cópia do token (RN30).
  // A operação é reversível nos dois sentidos — a instância que reaparece é restaurada —,
  // o que é o que impede uma resposta transitoriamente parcial da UAZAPI de virar perda
  // permanente de acesso às campanhas.
  async sincronizarTodas(ctx: TenantContext): Promise<InstanciaSemToken[]> {
    // Inclui as excluídas: são elas que podem reaparecer na UAZAPI e ser restauradas.
    const locais = await instanciaWhatsappRepository.listar(ctx.escritorioId, {
      incluirExcluidas: true,
    });

    // Escritório sem nenhuma instância (nem excluída): não há nada pra casar, então nem
    // vale a pena fazer a chamada de conta inteira à UAZAPI.
    if (locais.length === 0) {
      return [];
    }

    const remotas = await uazapiClient.listarTodasInstancias();
    const porId = new Map(remotas.map((remota) => [remota.id, remota]));

    for (const local of locais) {
      const remota = porId.get(local.uazapiInstanceId);
      // Não apareceu na resposta da UAZAPI (que lista TODAS as instâncias da conta):
      // não existe mais do lado de lá — instância "fantasma", marcada como excluída aqui.
      if (!remota) {
        // Já estava marcada: re-carimbar a data só produziria log de auditoria sem
        // nenhuma mudança por trás (RN20 é sobre escrita real).
        if (local.softDeletedAt) continue;

        await prisma.$transaction(async (tx) => {
          await instanciaWhatsappRepository.marcarExcluida(local.id, new Date(), tx);
          await logService.registrar(
            ctx,
            {
              acao: "excluir",
              entidade: "instancia_whatsapp",
              entidadeId: local.id,
              resumo: `Instância ${local.nome} marcada como excluída (não encontrada na UAZAPI)`,
            },
            tx
          );
        });
        continue;
      }

      let statusValidado: StatusInstanciaWhatsapp;
      try {
        statusValidado = paraStatusInstancia(remota.status);
      } catch {
        // Status fora do enum PARA ESSA instância não pode abortar o restante do lote —
        // diferente de verificarStatus (uma instância só), aqui um item malformado só
        // pula ele mesmo e o loop segue pras outras. Uma instância excluída que reaparece
        // assim também não é restaurada: sem status confiável, não há o que gravar.
        continue;
      }

      const { mudou, numeroConectado, fotoPerfilUrl } = compararConexao(local, {
        status: statusValidado,
        numeroConectado: remota.owner,
        fotoPerfilUrl: remota.fotoPerfilUrl,
      });

      // Reapareceu na UAZAPI depois de ter sido marcada: volta a valer. É o que torna a
      // marcação reversível — sem isso, uma resposta parcial da UAZAPI sumiria com a
      // instância para sempre, já que não há tela de restaurar.
      const ressuscitar = local.softDeletedAt !== null;

      // Nada mudou pra essa instância: não escreve, não loga (RN20 é sobre escrita real).
      // A restauração conta como mudança mesmo com status idêntico ao que já estava salvo.
      if (!mudou && !ressuscitar) continue;

      await prisma.$transaction(async (tx) => {
        if (ressuscitar) {
          await instanciaWhatsappRepository.restaurar(local.id, tx);
        }

        const atualizada = mudou
          ? await instanciaWhatsappRepository.atualizarConexao(
              local.id,
              { status: statusValidado, numeroConectado, fotoPerfilUrl },
              tx
            )
          : local;

        // Uma linha de log por entidade efetivamente alterada (ação em lote — nunca um
        // log combinado do lote inteiro).
        await logService.registrar(
          ctx,
          {
            acao: ressuscitar ? "restaurar" : "atualizar",
            entidade: "instancia_whatsapp",
            entidadeId: atualizada.id,
            resumo: ressuscitar
              ? `Instância ${atualizada.nome} reapareceu na UAZAPI e foi restaurada`
              : `Instância ${atualizada.nome} sincronizada`,
          },
          tx
        );
      });
    }

    const atualizadas = await instanciaWhatsappRepository.listar(ctx.escritorioId);
    return atualizadas.map(semToken);
  },
};
