import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { mockApi } from "@/lib/test-paginas";
import { usePerfil } from "./use-perfil";

it("lê o perfil de GET /api/perfil", async () => {
  const usuario = { id: "user-1", nome: "Nome Novo", email: "novo@t.com", temAvatar: true };
  mockApi({ "/api/perfil": { usuario } });
  const queryClient = criarQueryClientDeTeste();
  const { result } = renderHook(() => usePerfil(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(usuario);
});
