import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusStatCards } from "./status-stat-cards";
import type { ContagemPorTipoStatusDTO } from "@/types/dashboard";

const POR_TIPO_STATUS: ContagemPorTipoStatusDTO[] = [
  {
    tipoStatus: {
      id: "tipo-1",
      chave: "contato",
      nome: "Contato",
      icone: "Phone",
      cor: "#f59e0b",
      descricao: null,
      ordem: 1,
    },
    total: 3,
    valorTotal: 4500,
  },
  {
    tipoStatus: {
      id: "tipo-2",
      chave: "fechado",
      nome: "Fechado",
      icone: "Trophy",
      cor: "#22c55e",
      descricao: null,
      ordem: 2,
    },
    total: 0,
    valorTotal: 0,
  },
];

describe("StatusStatCards", () => {
  it("mostra um card por TipoStatus com o nome e a contagem", () => {
    render(
      <StatusStatCards
        porTipoStatus={POR_TIPO_STATUS}
        valorTotalAberto={15000}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText("Contato")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Fechado")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("mostra o valor somado de cada categoria formatado em BRL", () => {
    render(
      <StatusStatCards
        porTipoStatus={POR_TIPO_STATUS}
        valorTotalAberto={15000}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText("R$ 4.500,00")).toBeInTheDocument();
  });

  it("mostra o card de valor total em aberto formatado em BRL", () => {
    render(
      <StatusStatCards
        porTipoStatus={POR_TIPO_STATUS}
        valorTotalAberto={15000}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText("Valor total em aberto")).toBeInTheDocument();
    expect(screen.getByText("R$ 15.000,00")).toBeInTheDocument();
  });

  it("chama onSelect com o TipoStatus ao clicar em um card", async () => {
    const onSelect = jest.fn();
    render(
      <StatusStatCards porTipoStatus={POR_TIPO_STATUS} valorTotalAberto={15000} onSelect={onSelect} />
    );

    await userEvent.click(screen.getByRole("button", { name: /contato/i }));

    expect(onSelect).toHaveBeenCalledWith(POR_TIPO_STATUS[0]);
  });

  it("o card de valor total em aberto não é clicável", () => {
    render(
      <StatusStatCards
        porTipoStatus={POR_TIPO_STATUS}
        valorTotalAberto={15000}
        onSelect={jest.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /valor total em aberto/i })).not.toBeInTheDocument();
  });
});
