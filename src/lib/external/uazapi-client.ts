// Erro de domínio: nunca vaza corpo bruto da resposta da UAZAPI pro chamador —
// a mensagem exposta é sempre genérica.
export class UazapiIndisponivelError extends Error {
  constructor(mensagem = "Não foi possível se comunicar com o WhatsApp no momento.") {
    super(mensagem);
    this.name = "UazapiIndisponivelError";
  }
}

function obterServerUrl(): string {
  const serverUrl = process.env.UAZAPI_SERVER_URL;
  if (!serverUrl) {
    throw new Error("UAZAPI_SERVER_URL não configurado.");
  }
  return serverUrl;
}

function obterAdminToken(): string {
  const adminToken = process.env.UAZAPI_ADMIN_TOKEN;
  if (!adminToken) {
    throw new Error("UAZAPI_ADMIN_TOKEN não configurado.");
  }
  return adminToken;
}

// A doc da UAZAPI não confirma se /instance/connect e /instance/status devolvem os
// campos dentro de `instance` (como /instance/create) ou no nível raiz do corpo —
// então o parsing aceita os dois formatos, preferindo `instance` quando presente.
function corpoInstancia(body: Record<string, unknown>): Record<string, unknown> {
  const instance = body.instance;
  return instance && typeof instance === "object" ? (instance as Record<string, unknown>) : body;
}

async function chamarUazapi(
  caminho: string,
  headers: Record<string, string>,
  body?: unknown,
  method: "GET" | "POST" = "POST",
  // /sender/edit responde 200 com corpo `null` (documentado). Sem esta saída, uma ação
  // bem-sucedida cairia na validação de contrato abaixo e viraria 502 pro usuário.
  aceitaCorpoVazio = false
): Promise<Record<string, unknown>> {
  // A URL é resolvida fora do try: env var ausente é erro de configuração explícito,
  // não pode virar UazapiIndisponivelError genérico junto com falha de rede.
  const url = `${obterServerUrl()}${caminho}`;

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new UazapiIndisponivelError();
  }

  if (!resposta.ok) {
    throw new UazapiIndisponivelError();
  }

  // 2xx com corpo vazio/HTML/JSON truncado é falha de contrato tão real quanto um
  // não-2xx — não pode borbulhar como SyntaxError cru (mesmo tratamento de api-client.ts).
  const corpo: unknown = await resposta.json().catch(() => null);
  if (corpo === null || typeof corpo !== "object") {
    if (aceitaCorpoVazio) return {};
    throw new UazapiIndisponivelError();
  }

  return corpo as Record<string, unknown>;
}

// Uma linha do array devolvido por /sender/listfolders — os contadores chegam em
// snake_case (e log_sucess mesmo, com um "c" só, como está na doc da UAZAPI).
export interface CampanhaUazapi {
  id: string;
  info?: string;
  status: string;
  logTotal: number;
  logSucesso: number;
  logFalha: number;
  logEntregue: number;
  logLido: number;
  logReproduzido: number;
}

export interface MensagemEnvioAvancado {
  number: string;
  type: "text";
  text: string;
}

export interface EnvioAvancado {
  delayMin: number;
  delayMax: number;
  info: string;
  // Epoch em milissegundos. Ausente = a UAZAPI enfileira para envio imediato.
  scheduledFor?: number;
  messages: MensagemEnvioAvancado[];
}

export type AcaoCampanhaUazapi = "stop" | "continue" | "delete";

function inteiro(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

export const uazapiClient = {
  async criarInstancia(
    nome: string,
    opcoes?: { adminField01?: string }
  ): Promise<{ id: string; token: string; status: string }> {
    const body = await chamarUazapi(
      "/instance/create",
      {
        "Content-Type": "application/json",
        Accept: "application/json",
        admintoken: obterAdminToken(),
      },
      {
        name: nome,
        ...(opcoes?.adminField01 !== undefined ? { adminField01: opcoes.adminField01 } : {}),
      }
    );

    const instance = corpoInstancia(body);
    // O token vem duplicado em body.instance.token e body.token — usa o de dentro de
    // `instance` quando existir, com fallback pro nível raiz.
    const token = (instance.token as string | undefined) ?? (body.token as string | undefined);
    if (!token) {
      throw new UazapiIndisponivelError();
    }

    // id ausente/vazio é resposta fora de contrato — não pode virar `id: undefined` cast
    // pra string e seguir adiante até estourar validação do Prisma (que ecoaria o token
    // acima no erro).
    const id = instance.id as string | undefined;
    if (!id) {
      throw new UazapiIndisponivelError();
    }

    return {
      id,
      token,
      status: instance.status as string,
    };
  },

  async conectarInstancia(uazapiToken: string): Promise<{
    status: string;
    qrcode?: string;
    paircode?: string;
    numeroConectado?: string;
    fotoPerfilUrl?: string;
  }> {
    const body = await chamarUazapi(
      "/instance/connect",
      {
        "Content-Type": "application/json",
        Accept: "application/json",
        token: uazapiToken,
      },
      {}
    );

    const instance = corpoInstancia(body);
    return {
      status: instance.status as string,
      qrcode: instance.qrcode as string | undefined,
      paircode: instance.paircode as string | undefined,
      // owner/profilePicUrl ainda não existem numa instância recém-criada — o usuário
      // confirmou (payloads reais de webhook) que /instance/connect também os devolve
      // assim que disponíveis, no mesmo formato tolerante de consultarStatus.
      numeroConectado: instance.owner as string | undefined,
      fotoPerfilUrl: instance.profilePicUrl as string | undefined,
    };
  },

  async consultarStatus(uazapiToken: string): Promise<{
    status: string;
    numeroConectado?: string;
    fotoPerfilUrl?: string;
  }> {
    // /instance/status só aceita GET — POST devolve 405 Method Not Allowed (confirmado
    // testando ao vivo contra o servidor real). GET não tem body.
    const body = await chamarUazapi(
      "/instance/status",
      {
        "Content-Type": "application/json",
        Accept: "application/json",
        token: uazapiToken,
      },
      undefined,
      "GET"
    );

    const instance = corpoInstancia(body);
    return {
      status: instance.status as string,
      numeroConectado: instance.owner as string | undefined,
      fotoPerfilUrl: instance.profilePicUrl as string | undefined,
    };
  },

  async listarTodasInstancias(): Promise<
    Array<{
      id: string;
      status: string;
      owner?: string;
      fotoPerfilUrl?: string;
      adminField01?: string;
    }>
  > {
    // /instance/all exige admintoken (mesmo nível de /instance/create) — não o token de
    // uma instância individual — e devolve TODAS as instâncias da conta UAZAPI inteira,
    // de todos os escritórios que usam essa conta compartilhada, não só o do chamador.
    const corpo = await chamarUazapi(
      "/instance/all",
      {
        Accept: "application/json",
        admintoken: obterAdminToken(),
      },
      undefined,
      "GET"
    );

    // Ao contrário dos outros endpoints, a resposta aqui é um array no nível raiz do
    // corpo, não um objeto `{ instance: ... }`. chamarUazapi só valida "é objeto" — um
    // array também é typeof "object" em JS — então a validação de formato específica
    // (é de fato um array) precisa acontecer aqui.
    if (!Array.isArray(corpo)) {
      throw new UazapiIndisponivelError();
    }

    // Barreira de segurança: cada item desse array carrega um `token` de ALGUM tenant
    // (possivelmente de outro escritório) e outros campos sensíveis (ex.: openai_apikey).
    // Só os campos abaixo sobrevivem ao mapeamento — nada além disso, especialmente não
    // `token`, passa adiante pro Service/logs/testes.
    return corpo.map((item: unknown) => {
      const raw = item as Record<string, unknown>;
      return {
        id: raw.id as string,
        status: raw.status as string,
        owner: (raw.owner as string | undefined) || undefined,
        fotoPerfilUrl: (raw.profilePicUrl as string | undefined) || undefined,
        adminField01: (raw.adminField01 as string | undefined) || undefined,
      };
    });
  },

  // Registra a campanha inteira na UAZAPI de uma vez: uma entrada em `messages` por
  // destinatário, com o texto já renderizado. Autenticado com o token da instância que
  // vai disparar (não o admintoken) — é ela que fica dona da campanha.
  async criarEnvioAvancado(
    uazapiToken: string,
    envio: EnvioAvancado
  ): Promise<{ folderId: string; count: number; status: string }> {
    const body = await chamarUazapi(
      "/sender/advanced",
      {
        "Content-Type": "application/json",
        Accept: "application/json",
        token: uazapiToken,
      },
      {
        delayMin: envio.delayMin,
        delayMax: envio.delayMax,
        info: envio.info,
        ...(envio.scheduledFor !== undefined ? { scheduled_for: envio.scheduledFor } : {}),
        messages: envio.messages,
      }
    );

    // Sem folder_id não dá para sincronizar estatísticas nem pausar/excluir depois — a
    // campanha ficaria órfã na UAZAPI. Resposta assim é quebra de contrato, não sucesso.
    const folderId = body.folder_id as string | undefined;
    if (!folderId) {
      throw new UazapiIndisponivelError();
    }

    return {
      folderId,
      count: inteiro(body.count) || envio.messages.length,
      status: (body.status as string | undefined) ?? "",
    };
  },

  async listarCampanhas(uazapiToken: string): Promise<CampanhaUazapi[]> {
    const corpo = await chamarUazapi(
      "/sender/listfolders",
      { Accept: "application/json", token: uazapiToken },
      undefined,
      "GET"
    );

    // Array na raiz do corpo, como /instance/all — e chamarUazapi só garante "é objeto".
    if (!Array.isArray(corpo)) {
      throw new UazapiIndisponivelError();
    }

    return corpo.map((item: unknown) => {
      const raw = item as Record<string, unknown>;
      return {
        id: raw.id as string,
        info: (raw.info as string | undefined) || undefined,
        status: raw.status as string,
        logTotal: inteiro(raw.log_total),
        logSucesso: inteiro(raw.log_sucess),
        logFalha: inteiro(raw.log_failed),
        logEntregue: inteiro(raw.log_delivered),
        logLido: inteiro(raw.log_read),
        logReproduzido: inteiro(raw.log_played),
      };
    });
  },

  async controlarCampanha(
    uazapiToken: string,
    folderId: string,
    acao: AcaoCampanhaUazapi
  ): Promise<void> {
    await chamarUazapi(
      "/sender/edit",
      {
        "Content-Type": "application/json",
        Accept: "application/json",
        token: uazapiToken,
      },
      { folder_id: folderId, action: acao },
      "POST",
      true
    );
  },
};
