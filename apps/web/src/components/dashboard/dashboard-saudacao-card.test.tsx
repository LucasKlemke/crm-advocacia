import { render, screen } from "@testing-library/react";
import { DashboardSaudacaoCard } from "./dashboard-saudacao-card";
import { SAUDACOES, SUBTITULOS } from "@/hooks/use-saudacao-rotativa";

describe("DashboardSaudacaoCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("cumprimenta o usuário com uma saudação e subtítulo válidos", () => {
    render(<DashboardSaudacaoCard nome="Ana" data="22 de agosto de 2026" />);

    const saudacaoEncontrada = SAUDACOES.find((saudacao) => screen.queryByText(saudacao));
    expect(saudacaoEncontrada).toBeDefined();

    const subtituloEncontrado = SUBTITULOS.find((subtitulo) => screen.queryByText(subtitulo));
    expect(subtituloEncontrado).toBeDefined();
  });

  it("mostra a data que veio formatada do servidor", () => {
    // O card renderiza no SSR: calcular a data no cliente divergiria do HTML do servidor
    // sempre que os fusos não batessem.
    render(<DashboardSaudacaoCard nome="Ana" data="22 de agosto de 2026" />);

    expect(screen.getByText("22 de agosto de 2026")).toBeInTheDocument();
  });

  it("exibe apenas o primeiro nome, com a primeira letra maiúscula e o resto minúsculo", () => {
    render(<DashboardSaudacaoCard nome="lUCAS Affonso Klemke" data="22 de agosto de 2026" />);

    expect(screen.getByText("Lucas")).toBeInTheDocument();
    expect(screen.queryByText(/Klemke/)).not.toBeInTheDocument();
  });
});
