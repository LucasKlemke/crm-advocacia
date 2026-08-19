export class ApiError extends Error {
  readonly status: number;
  readonly detalhes?: Record<string, string[] | undefined>;

  constructor(mensagem: string, status: number, detalhes?: Record<string, string[] | undefined>) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.detalhes = detalhes;
  }
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

  const corpo = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      corpo?.error ?? "Não foi possível concluir a operação.",
      response.status,
      corpo?.detalhes
    );
  }

  return corpo as T;
}
