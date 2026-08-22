import { render, screen } from "@testing-library/react";
import { CasosStatusDonutChart } from "./casos-status-donut-chart";
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
    total: 5,
    valorTotal: 9000,
  },
];

describe("CasosStatusDonutChart", () => {
  it("mostra o título do gráfico", () => {
    render(<CasosStatusDonutChart porTipoStatus={POR_TIPO_STATUS} />);

    expect(screen.getByText("Processos por status")).toBeInTheDocument();
  });

  it("lista o nome e a contagem de cada TipoStatus na legenda", () => {
    render(<CasosStatusDonutChart porTipoStatus={POR_TIPO_STATUS} />);

    expect(screen.getByText("Contato")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Fechado")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("mostra a % de cada TipoStatus sobre o total de processos na legenda", () => {
    render(<CasosStatusDonutChart porTipoStatus={POR_TIPO_STATUS} />);

    expect(screen.getByText("(37.5%)")).toBeInTheDocument();
    expect(screen.getByText("(62.5%)")).toBeInTheDocument();
  });
});
