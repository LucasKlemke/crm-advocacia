import { renderHook, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api-client";
import { chaveSessao } from "@/lib/query/chaves";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";
import { buscarSessao, entrar, sair, trocarEscritorio, useSessao, type Sessao } from "./sessao";

const SESSAO: Sessao = {
  usuario: { id: "user-1", nome: "Fulana", email: "fulana@teste.com" },
  escritorioId: "esc-1",
  role: "owner",
};

function resposta(status: number, corpo: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    redirected: false,
    headers: { get: () => "application/json" },
    json: async () => corpo,
  } as unknown as Response;
}

beforeEach(() => {
  global.fetch = jest.fn();
  queryClientRaiz.clear();
});

describe("buscarSessao", () => {
  it("devolve a sessão do GET /api/auth/sessao", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200, SESSAO));

    await expect(buscarSessao()).resolves.toEqual(SESSAO);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("/api/auth/sessao");
  });

  // 401 aqui é resposta esperada ("ninguém logado"), não sessão expirada: nada de
  // redirect — quem decide para onde ir é a RotaProtegida.
  it("devolve null quando não há sessão (401)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(401, { error: "Sessão inválida ou expirada." }));

    await expect(buscarSessao()).resolves.toBeNull();
  });

  it("lança ApiError em erro de servidor", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(500));

    await expect(buscarSessao()).rejects.toEqual(expect.objectContaining({ status: 500 }));
    await expect(buscarSessao()).rejects.toBeInstanceOf(ApiError);
  });

  it("lança ApiError com status 0 quando a rede falha", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    await expect(buscarSessao()).rejects.toEqual(expect.objectContaining({ status: 0 }));
  });
});

describe("useSessao", () => {
  it("guarda a sessão no queryClientRaiz, fora do cache do tenant", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200, SESSAO));

    const { result } = renderHook(() => useSessao());

    await waitFor(() => expect(result.current.data).toEqual(SESSAO));
    expect(queryClientRaiz.getQueryData(chaveSessao())).toEqual(SESSAO);
  });
});

describe("entrar (contrato da Fase 3)", () => {
  it("envia as credenciais para /api/auth/login e devolve true no 200", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200));

    await expect(entrar("f@t.com", "senha")).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "f@t.com", senha: "senha" }),
    });
  });

  it.each([401, 400])("devolve false para %i (credenciais inválidas)", async (status) => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(status));

    await expect(entrar("f@t.com", "errada")).resolves.toBe(false);
  });

  it("lança para erro de servidor", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(500));

    await expect(entrar("f@t.com", "senha")).rejects.toThrow("HTTP 500");
  });
});

describe("sair", () => {
  it("chama /api/auth/logout e descarta a sessão em cache", async () => {
    queryClientRaiz.setQueryData(chaveSessao(), SESSAO);
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200));

    await sair();

    expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(queryClientRaiz.getQueryData(chaveSessao())).toBeUndefined();
  });

  it("não lança quando a rede falha (a navegação para /login segue)", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    await expect(sair()).resolves.toBeUndefined();
  });
});

describe("trocarEscritorio", () => {
  it("troca o escritório ativo na API e invalida a sessão", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(resposta(200, { ok: true }));
    const invalidar = jest.spyOn(queryClientRaiz, "invalidateQueries");

    await trocarEscritorio("esc-2");

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/sessao/escritorio-ativo");
    expect(init).toEqual(
      expect.objectContaining({ method: "POST", body: JSON.stringify({ escritorioId: "esc-2" }) })
    );
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["sessao"] });
    invalidar.mockRestore();
  });

  it("propaga a mensagem da API quando a troca é recusada", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      resposta(403, { error: "Você não é membro deste escritório." })
    );

    await expect(trocarEscritorio("esc-x")).rejects.toThrow("Você não é membro deste escritório.");
  });
});
