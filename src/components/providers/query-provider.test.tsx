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
  // Todo dado em cache pertence ao escritório da sessão: ao trocar de tenant o cache
  // anterior precisa morrer, senão a tela segue mostrando os registros do escritório antigo.
  it("descarta o cache e busca de novo quando o escritório ativo muda", async () => {
    const queryFn = jest
      .fn()
      .mockResolvedValueOnce("clientes do escritório A")
      .mockResolvedValueOnce("clientes do escritório B");

    function Clientes() {
      const { data } = useQuery({ queryKey: ["clientes"], queryFn });
      return <span>{data ?? "carregando"}</span>;
    }

    const { rerender } = render(
      <QueryProvider escritorioId="esc-a">
        <Clientes />
      </QueryProvider>
    );
    expect(await screen.findByText("clientes do escritório A")).toBeInTheDocument();

    rerender(
      <QueryProvider escritorioId="esc-b">
        <Clientes />
      </QueryProvider>
    );

    expect(await screen.findByText("clientes do escritório B")).toBeInTheDocument();
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("mantém o cache enquanto o escritório ativo continua o mesmo", async () => {
    const queryFn = jest.fn().mockResolvedValue("mesma lista");

    function Clientes() {
      const { data } = useQuery({ queryKey: ["clientes"], queryFn });
      return <span>{data ?? "carregando"}</span>;
    }

    const { rerender } = render(
      <QueryProvider escritorioId="esc-a">
        <Clientes />
      </QueryProvider>
    );
    expect(await screen.findByText("mesma lista")).toBeInTheDocument();

    rerender(
      <QueryProvider escritorioId="esc-a">
        <Clientes />
      </QueryProvider>
    );

    expect(screen.getByText("mesma lista")).toBeInTheDocument();
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});
