import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { mockApi } from "@/lib/test-paginas";
import { useConvitesPendentes, useMembros } from "./use-membros";

function wrapper() {
  const queryClient = criarQueryClientDeTeste();
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useMembros", () => {
  it("projeta só os campos que a tabela usa", async () => {
    mockApi({
      "/api/membros": {
        membros: [
          {
            id: "m1",
            role: "owner",
            escritorioId: "esc-1",
            usuarioId: "user-1",
            createdAt: "2026-01-01T00:00:00.000Z",
            usuario: { id: "user-1", nome: "Dona", email: "d@t.com", telefone: null, avatarUrl: "https://s3/x" },
          },
        ],
      },
    });
    const { result } = renderHook(() => useMembros(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      {
        id: "m1",
        role: "owner",
        usuario: { id: "user-1", nome: "Dona", email: "d@t.com", telefone: null, avatarUrl: "https://s3/x" },
      },
    ]);
  });
});

describe("useConvitesPendentes", () => {
  it("não chama a API quando desabilitado (papel padrao recebe 403)", () => {
    mockApi({});
    const { result } = renderHook(() => useConvitesPendentes(false), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("lê os convites de GET /api/convites", async () => {
    mockApi({
      "/api/convites": {
        convites: [{ id: "c1", email: "novo@t.com", role: "padrao", expiraEm: "2026-12-01T00:00:00.000Z" }],
      },
    });
    const { result } = renderHook(() => useConvitesPendentes(true), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "c1", email: "novo@t.com", role: "padrao" }]);
  });
});
