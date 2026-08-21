import { render, screen } from "@testing-library/react";
import { DashboardSaudacaoCard } from "./dashboard-saudacao-card";
import { SAUDACOES, SUBTITULOS } from "@/hooks/use-saudacao-rotativa";

describe("DashboardSaudacaoCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("cumprimenta o usuário pelo nome com uma saudação e subtítulo válidos", () => {
    render(<DashboardSaudacaoCard nome="Ana" />);

    const saudacaoEncontrada = SAUDACOES.find((saudacao) =>
      screen.queryByText(`${saudacao}, Ana`)
    );
    expect(saudacaoEncontrada).toBeDefined();

    const subtituloEncontrado = SUBTITULOS.find((subtitulo) => screen.queryByText(subtitulo));
    expect(subtituloEncontrado).toBeDefined();
  });
});
