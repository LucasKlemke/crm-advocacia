import { render, screen } from "@testing-library/react";
import { DashboardSaudacaoCard } from "./dashboard-saudacao-card";
import { SAUDACOES, SUBTITULOS } from "@/hooks/use-saudacao-rotativa";

describe("DashboardSaudacaoCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("cumprimenta o usuário com uma saudação e subtítulo válidos", () => {
    render(<DashboardSaudacaoCard nome="Ana" />);

    const saudacaoEncontrada = SAUDACOES.find((saudacao) => screen.queryByText(saudacao));
    expect(saudacaoEncontrada).toBeDefined();

    const subtituloEncontrado = SUBTITULOS.find((subtitulo) => screen.queryByText(subtitulo));
    expect(subtituloEncontrado).toBeDefined();
  });

  it("exibe apenas o primeiro nome, com a primeira letra maiúscula e o resto minúsculo", () => {
    render(<DashboardSaudacaoCard nome="lUCAS Affonso Klemke" />);

    expect(screen.getByText("Lucas")).toBeInTheDocument();
    expect(screen.queryByText(/Klemke/)).not.toBeInTheDocument();
  });
});
