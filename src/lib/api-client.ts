export class ApiError extends Error {
  readonly status: number;
  readonly detalhes?: Record<string, string[] | undefined>;

  constructor(mensagem: string, status: number, detalhes?: Record<string, string[] | undefined>) {
    super(mensagem);
    this.name = "ApiError";
    this.detalhes = detalhes;
    this.status = status;
  }
}

// Sessão expirada é um caso à parte de "erro da API": não adianta o usuário tentar de
// novo, ele precisa voltar ao login. Tipo próprio para que a UI possa distinguir isso de
// um 400/500 comum — e nunca confundir com "não há dados".
export class SessaoExpiradaError extends ApiError {
  constructor(mensagem = "Sua sessão expirou. Faça login novamente.") {
    super(mensagem, 401);
    this.name = "SessaoExpiradaError";
  }
}

export function ehSessaoExpirada(error: unknown): error is SessaoExpiradaError {
  return error instanceof SessaoExpiradaError;
}

// Evita uma enxurrada de navegações quando várias queries falham juntas com 401.
let redirecionandoParaLogin = false;

function redirecionarParaLogin() {
  if (typeof window === "undefined" || redirecionandoParaLogin) return;
  const atual = window.location.pathname + window.location.search;
  if (window.location.pathname === "/login") return;
  redirecionandoParaLogin = true;
  // Navegação dura de propósito: sessão expirada precisa derrubar todo o estado de
  // cliente (cache do React Query, sessão do NextAuth em memória), o que um
  // router.push() do App Router não faz. Além disso, apiFetch não é um componente —
  // não há hook de router disponível aqui.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?callbackUrl=${encodeURIComponent(atual)}`);
}

// Exposto só para os testes conseguirem exercitar mais de um cenário de 401 por arquivo.
export function resetarRedirecionamentoParaLogin() {
  redirecionandoParaLogin = false;
}

function pareceJson(response: Response): boolean {
  const contentType = response.headers?.get?.("content-type");
  // Sem header legível (mocks/testes) assumimos JSON: só marcamos como "não-JSON" o que
  // declara explicitamente outro tipo — tipicamente o text/html da página de login.
  return !contentType || contentType.includes("json");
}

// Ponto único de saída do client para as rotas /api: centraliza headers, parsing e a
// tradução de `{ error, detalhes }` num erro tipado que os hooks propagam ao componente.
export async function apiFetch<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(caminho, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    // Rede fora do ar: mensagem de usuário, sem detalhe técnico.
    throw new ApiError("Não foi possível conectar ao servidor.", 0);
  }

  // Redirect para uma página HTML (ex.: /login) nunca é resposta válida de API: o fetch
  // segue o 307 e devolve um 200 de HTML, que sem esse tratamento viraria `null` — a
  // tabela apareceria vazia e as escritas estourariam TypeError na UI.
  if (response.redirected || !pareceJson(response)) {
    redirecionarParaLogin();
    throw new SessaoExpiradaError();
  }

  const corpo = await response.json().catch(() => null);

  if (response.status === 401) {
    redirecionarParaLogin();
    throw new SessaoExpiradaError(corpo?.error ?? undefined);
  }

  if (!response.ok) {
    throw new ApiError(
      corpo?.error ?? "Não foi possível concluir a operação.",
      response.status,
      corpo?.detalhes
    );
  }

  // Resposta "ok" sem JSON legível é falha de contrato, não ausência de dados: deixar
  // passar como `null` é justamente o que fazia a lista sumir silenciosamente.
  if (corpo === null) {
    throw new ApiError("Resposta inválida do servidor.", response.status);
  }

  return corpo as T;
}
