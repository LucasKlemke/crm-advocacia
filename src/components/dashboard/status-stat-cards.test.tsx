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

const COM_DESCRICAO: ContagemPorTipoStatusDTO[] = [
  {
    tipoStatus: {
      id: "tipo-1",
      chave: "lead",
      nome: "Lead",
      icone: "UserPlus",
      cor: "#64748b",
      descricao: "Contato inicial que ainda não é cliente, potencial caso em avaliação.",
      ordem: 1,
    },
    total: 1,
    valorTotal: 1000,
  },
];

describe("StatusStatCards", () => {
  it("mostra um card por TipoStatus com o nome", () => {
    render(<StatusStatCards porTipoStatus={POR_TIPO_STATUS} selecionadosIds={[]} onSelect={jest.fn()} />);

    expect(screen.getByText("Contato")).toBeInTheDocument();
    expect(screen.getByText("Fechado")).toBeInTheDocument();
  });

  it("mostra o valor somado de cada categoria formatado em BRL como número principal", () => {
    render(<StatusStatCards porTipoStatus={POR_TIPO_STATUS} selecionadosIds={[]} onSelect={jest.fn()} />);

    expect(screen.getByText("R$ 4.500,00")).toBeInTheDocument();
  });

  it("mostra a porcentagem do valor da categoria sobre o valor total", () => {
    render(<StatusStatCards porTipoStatus={POR_TIPO_STATUS} selecionadosIds={[]} onSelect={jest.fn()} />);

    expect(screen.getByText("100.0%")).toBeInTheDocument();
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });

  it("não mostra mais o card de valor total em aberto", () => {
    render(<StatusStatCards porTipoStatus={POR_TIPO_STATUS} selecionadosIds={[]} onSelect={jest.fn()} />);

    expect(screen.queryByText("Valor total em aberto")).not.toBeInTheDocument();
  });

  it("chama onSelect com o TipoStatus ao clicar em um card", async () => {
    const onSelect = jest.fn();
    render(<StatusStatCards porTipoStatus={POR_TIPO_STATUS} selecionadosIds={[]} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: /contato/i }));

    expect(onSelect).toHaveBeenCalledWith(POR_TIPO_STATUS[0]);
  });

  it("apaga os demais cards quando um está selecionado", () => {
    render(
      <StatusStatCards porTipoStatus={POR_TIPO_STATUS} selecionadosIds={["tipo-1"]} onSelect={jest.fn()} />
    );

    expect(screen.getByRole("button", { name: /contato/i })).toHaveClass("opacity-100");
    expect(screen.getByRole("button", { name: /fechado/i })).toHaveClass("opacity-40");
  });

  it("mostra a descrição do tipo de status ao passar o mouse sobre o card", async () => {
    render(<StatusStatCards porTipoStatus={COM_DESCRICAO} selecionadosIds={[]} onSelect={jest.fn()} />);

    await userEvent.hover(screen.getByRole("button", { name: /lead/i }));

    expect(
      await screen.findByText("Contato inicial que ainda não é cliente, potencial caso em avaliação.")
    ).toBeInTheDocument();
  });

  it("continua chamando onSelect ao clicar em um card que tem descrição", async () => {
    const onSelect = jest.fn();
    render(<StatusStatCards porTipoStatus={COM_DESCRICAO} selecionadosIds={[]} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: /lead/i }));

    expect(onSelect).toHaveBeenCalledWith(COM_DESCRICAO[0]);
  });

  it("permite múltiplos cards selecionados ao mesmo tempo, nenhum apagado entre eles", () => {
    render(
      <StatusStatCards
        porTipoStatus={POR_TIPO_STATUS}
        selecionadosIds={["tipo-1", "tipo-2"]}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /contato/i })).toHaveClass("opacity-100");
    expect(screen.getByRole("button", { name: /fechado/i })).toHaveClass("opacity-100");
  });
});
