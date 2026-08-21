import { render, screen } from "@testing-library/react";
import { DashboardSaudacaoCard } from "./dashboard-saudacao-card";

describe("DashboardSaudacaoCard", () => {
  it("cumprimenta o usuário pelo nome", () => {
    render(<DashboardSaudacaoCard nome="Ana" />);

    expect(screen.getByText("Olá, Ana")).toBeInTheDocument();
    expect(screen.getByText("Aqui está o seu relatório.")).toBeInTheDocument();
  });
});
