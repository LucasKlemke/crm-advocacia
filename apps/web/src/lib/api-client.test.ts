import {
  apiFetch,
  ApiError,
  SessaoExpiradaError,
  ehSessaoExpirada,
  resetarRedirecionamentoParaLogin,
} from "./api-client";

function respostaFake(
  corpo: unknown,
  init: {
    status?: number;
    ok?: boolean;
    contentType?: string | null;
    redirected?: boolean;
  } = {}
) {
  const status = init.status ?? 200;
  const contentType = init.contentType === undefined ? "application/json" : init.contentType;
  return {
    ok: init.ok ?? status < 400,
    status,
    redirected: init.redirected ?? false,
    headers: { get: (nome: string) => (nome === "content-type" ? contentType : null) },
    json: async () => corpo,
  } as unknown as Response;
}

describe("apiFetch", () => {
  let assign: jest.Mock;

  beforeEach(() => {
    global.fetch = jest.fn();
    resetarRedirecionamentoParaLogin();
    assign = jest.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname: "/clientes", search: "?pagina=2", assign },
    });
  });

  it("devolve o corpo já parseado em caso de sucesso", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaFake({ clientes: [] }));

    await expect(apiFetch("/api/clientes")).resolves.toEqual({ clientes: [] });
  });

  it("envia Content-Type JSON só quando há body", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaFake({}));

    await apiFetch("/api/clientes");
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers).toEqual({});

    await apiFetch("/api/clientes", { method: "POST", body: "{}" });
    expect((global.fetch as jest.Mock).mock.calls[1][1].headers).toEqual({
      "Content-Type": "application/json",
    });
  });

  it("transforma resposta de erro em ApiError com status e detalhes", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaFake({ error: "Dados inválidos", detalhes: { nome: ["Muito curto"] } }, { status: 400 })
    );

    await expect(apiFetch("/api/clientes")).rejects.toMatchObject({
      name: "ApiError",
      message: "Dados inválidos",
      status: 400,
      detalhes: { nome: ["Muito curto"] },
    });
  });

  it("usa mensagem genérica quando a resposta de erro não tem corpo legível", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      redirected: false,
      headers: { get: () => "application/json" },
      json: async () => {
        throw new Error("sem corpo");
      },
    } as unknown as Response);

    await expect(apiFetch("/api/clientes")).rejects.toThrow("Não foi possível concluir a operação.");
  });

  // Falha de rede não pode borbulhar como TypeError cru na UI.
  it("converte falha de rede em ApiError de status 0", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiFetch("/api/clientes")).rejects.toBeInstanceOf(ApiError);
    await expect(apiFetch("/api/clientes")).rejects.toMatchObject({ status: 0 });
  });

  describe("sessão expirada", () => {
    it("transforma 401 em SessaoExpiradaError distinguível de erro comum", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ error: "Sessão inválida ou expirada." }, { status: 401 })
      );

      const erro: unknown = await apiFetch("/api/clientes").catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(SessaoExpiradaError);
      expect(ehSessaoExpirada(erro)).toBe(true);
      if (!ehSessaoExpirada(erro)) throw new Error("esperava SessaoExpiradaError");
      expect(erro.status).toBe(401);
      expect(erro.message).toBe("Sessão inválida ou expirada.");
    });

    it("manda o usuário ao login preservando a rota atual como callbackUrl", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({ error: "expirou" }, { status: 401 }));

      await expect(apiFetch("/api/clientes")).rejects.toBeInstanceOf(SessaoExpiradaError);
      expect(assign).toHaveBeenCalledWith(
        `/login?callbackUrl=${encodeURIComponent("/clientes?pagina=2")}`
      );
    });

    it("redireciona uma única vez mesmo com várias chamadas falhando juntas", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({}, { status: 401 }));

      await Promise.allSettled([apiFetch("/api/clientes"), apiFetch("/api/comentarios")]);
      expect(assign).toHaveBeenCalledTimes(1);
    });

    // Regressão: middleware redirecionando /api para a página HTML de login fazia o
    // fetch devolver 200 de HTML, que virava `null` — a tabela aparecia vazia.
    it("trata redirect para página HTML como sessão expirada, nunca como lista vazia", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake("<!DOCTYPE html>", { redirected: true, contentType: "text/html" })
      );

      await expect(apiFetch("/api/clientes")).rejects.toBeInstanceOf(SessaoExpiradaError);
      expect(assign).toHaveBeenCalled();
    });

    it("trata resposta 200 não-JSON como sessão expirada", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake("<html>login</html>", { contentType: "text/html; charset=utf-8" })
      );

      await expect(apiFetch("/api/clientes")).rejects.toBeInstanceOf(SessaoExpiradaError);
    });

    it("não redireciona quando o usuário já está na página de login", async () => {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { pathname: "/login", search: "", assign },
      });
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({}, { status: 401 }));

      await expect(apiFetch("/api/sessao")).rejects.toBeInstanceOf(SessaoExpiradaError);
      expect(assign).not.toHaveBeenCalled();
    });
  });

  it("rejeita resposta ok sem JSON legível em vez de devolver null", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      redirected: false,
      headers: { get: () => "application/json" },
      json: async () => {
        throw new Error("sem corpo");
      },
    } as unknown as Response);

    await expect(apiFetch("/api/clientes")).rejects.toMatchObject({
      name: "ApiError",
      message: "Resposta inválida do servidor.",
    });
  });
});
