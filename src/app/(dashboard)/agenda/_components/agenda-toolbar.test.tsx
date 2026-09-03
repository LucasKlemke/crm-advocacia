import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgendaToolbar } from "./agenda-toolbar";

function montar(props: Partial<React.ComponentProps<typeof AgendaToolbar>> = {}) {
  const acoes = {
    onTrocarVisao: jest.fn(),
    onAnterior: jest.fn(),
    onProximo: jest.fn(),
    onHoje: jest.fn(),
    onNovoEvento: jest.fn(),
  };
  render(
    <AgendaToolbar visao="mes" rotulo="Setembro 2026" {...acoes} {...props} />
  );
  return acoes;
}

describe("AgendaToolbar", () => {
  it("mostra o rótulo do período e as três visões", () => {
    montar();

    expect(screen.getByText("Setembro 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mês" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Semana" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dia" })).toBeInTheDocument();
  });

  it("navega para trás, para frente e para hoje", async () => {
    const acoes = montar();
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole("button", { name: /período anterior/i }));
    await usuario.click(screen.getByRole("button", { name: /próximo período/i }));
    await usuario.click(screen.getByRole("button", { name: "Hoje" }));

    expect(acoes.onAnterior).toHaveBeenCalledTimes(1);
    expect(acoes.onProximo).toHaveBeenCalledTimes(1);
    expect(acoes.onHoje).toHaveBeenCalledTimes(1);
  });

  it("troca a visão ao clicar em Semana", async () => {
    const acoes = montar();

    await userEvent.setup().click(screen.getByRole("button", { name: "Semana" }));

    expect(acoes.onTrocarVisao).toHaveBeenCalledWith("semana");
  });

  it("esconde o alternador de visão em tela compacta, mantendo criar evento", () => {
    montar({ compacto: true });

    expect(screen.queryByRole("button", { name: "Mês" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /novo evento/i })).toBeInTheDocument();
  });
});
