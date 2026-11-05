import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { useRouter } from "./next-navigation";

// Os componentes migrados do Next chamam router.refresh() depois de uma escrita para
// recarregar os dados da página. Na SPA os dados vêm do React Query, então refresh()
// precisa invalidar as queries ativas; senão a tela fica com o dado antigo.
it("refresh() invalida as queries do QueryClient mais próximo", () => {
  const queryClient = criarQueryClientDeTeste();
  const invalidar = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useRouter(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    ),
  });

  act(() => result.current.refresh());

  expect(invalidar).toHaveBeenCalledWith();
});
