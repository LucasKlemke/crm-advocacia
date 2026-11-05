import { entrar, sair } from "./sessao";

function resposta(status: number) {
  return { ok: status >= 200 && status < 300, status, json: async () => ({}) };
}

describe("cliente-sessao", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("entrar envia as credenciais para /api/auth/login e devolve true no 200", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200));

    await expect(entrar("f@t.com", "senha")).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "f@t.com", senha: "senha" }),
    });
  });

  it.each([401, 400])("entrar devolve false para %i (credenciais inválidas)", async (status) => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(status));

    await expect(entrar("f@t.com", "errada")).resolves.toBe(false);
  });

  it("entrar lança para erro de servidor (a tela mostra a mensagem genérica)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(500));

    await expect(entrar("f@t.com", "senha")).rejects.toThrow("HTTP 500");
  });

  it("sair chama /api/auth/logout", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200));

    await sair();
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });

  it("sair não lança quando a rede falha (a navegação para /login segue)", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    await expect(sair()).resolves.toBeUndefined();
  });
});
