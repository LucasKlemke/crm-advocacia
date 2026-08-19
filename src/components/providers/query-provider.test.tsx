import { useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { QueryProvider } from "./query-provider";

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
});
