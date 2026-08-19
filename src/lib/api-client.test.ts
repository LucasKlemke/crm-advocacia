import { apiFetch, ApiError } from "./api-client";

function respostaFake(corpo: unknown, init: { status?: number; ok?: boolean } = {}) {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? status < 400,
    status,
    json: async () => corpo,
  } as Response;
}

describe("apiFetch", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
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
});
