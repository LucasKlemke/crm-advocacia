import { useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryProvider } from "./query-provider";
import { ApiError, SessaoExpiradaError } from "@/lib/api-client";

function Consumidor() {
  const { data } = useQuery({ queryKey: ["teste"], queryFn: async () => "pronto" });
  return <span>{data ?? "carregando"}</span>;
}

describe("QueryProvider", () => {
  it("disponibiliza um QueryClient para os componentes filhos", async () => {
    render(
      <QueryProvider>
        <Consumidor />
      </QueryProvider>
    );

    expect(await screen.findByText("pronto")).toBeInTheDocument();
  });

  // Sessão expirada precisa aparecer na hora: o apiFetch já mandou o usuário ao login,
  // retentar só deixaria a tela num "carregando" enganoso.
  it("não retenta queries que falharam por sessão expirada", async () => {
    const queryFn = jest.fn().mockRejectedValue(new SessaoExpiradaError());

    function Falho() {
      const { isError } = useQuery({ queryKey: ["sessao"], queryFn });
      return <span>{isError ? "erro" : "carregando"}</span>;
    }

    render(
      <QueryProvider>
        <Falho />
      </QueryProvider>
    );

    expect(await screen.findByText("erro")).toBeInTheDocument();
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("ainda retenta uma vez em falha comum da API", async () => {
    const queryFn = jest.fn().mockRejectedValue(new ApiError("Falhou", 500));

    function Falho() {
      const { isError } = useQuery({ queryKey: ["comum"], queryFn });
      return <span>{isError ? "erro" : "carregando"}</span>;
    }

    render(
      <QueryProvider>
        <Falho />
      </QueryProvider>
    );

    // A retentativa do React Query tem backoff (~1s), acima do timeout padrão do waitFor.
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2), { timeout: 5000 });
  });
});
