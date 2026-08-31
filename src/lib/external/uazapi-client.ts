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
  body?: unknown
): Promise<Record<string, unknown>> {
  // A URL é resolvida fora do try: env var ausente é erro de configuração explícito,
  // não pode virar UazapiIndisponivelError genérico junto com falha de rede.
  const url = `${obterServerUrl()}${caminho}`;

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: "POST",
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
    throw new UazapiIndisponivelError();
  }

  return corpo as Record<string, unknown>;
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

  async conectarInstancia(
    uazapiToken: string
  ): Promise<{ status: string; qrcode?: string; paircode?: string }> {
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
    };
  },

  async consultarStatus(uazapiToken: string): Promise<{ status: string; numeroConectado?: string }> {
    const body = await chamarUazapi("/instance/status", {
      "Content-Type": "application/json",
      Accept: "application/json",
      token: uazapiToken,
    });

    const instance = corpoInstancia(body);
    return {
      status: instance.status as string,
      numeroConectado: instance.owner as string | undefined,
    };
  },
};
