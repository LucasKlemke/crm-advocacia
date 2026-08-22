import { render, screen } from "@testing-library/react";
import {
  CasosStatusDonutChartSkeleton,
  DashboardSkeleton,
  StatusStatCardsSkeleton,
} from "./dashboard-skeleton";

function skeletons(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="skeleton"]');
}

describe("StatusStatCardsSkeleton", () => {
  it("reserva um card por tipo de status do seed", () => {
    const { container } = render(<StatusStatCardsSkeleton />);

    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(6);
    expect(skeletons(container).length).toBeGreaterThan(0);
  });
});

describe("CasosStatusDonutChartSkeleton", () => {
  it("desenha o anel e uma linha de legenda por tipo de status", () => {
    const { container } = render(<CasosStatusDonutChartSkeleton />);

    expect(container.querySelectorAll("li")).toHaveLength(6);
    expect(container.querySelector(".rounded-full")).toBeInTheDocument();
  });
});

describe("DashboardSkeleton", () => {
  it("mostra a saudação real enquanto os dados ainda carregam", () => {
    render(<DashboardSkeleton nome="Ana Souza" dataHoje="22 de agosto de 2026" />);

    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("mantém o cabeçalho da tabela legível antes de os processos chegarem", () => {
    render(<DashboardSkeleton nome="Ana" dataHoje="22 de agosto de 2026" />);

    expect(screen.getByText("Nº do processo")).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("Atualizado em")).toBeInTheDocument();
  });
});
