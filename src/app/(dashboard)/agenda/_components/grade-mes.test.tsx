import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GradeMes } from "./grade-mes";
import type { EventoDTO } from "@/types/evento";

const DATA_FOCO = new Date(2026, 8, 15); // 15/09/2026

function eventoFake(over: Partial<EventoDTO> = {}): EventoDTO {
  const inicio = new Date(2026, 8, 10, 14, 0);
  return {
    id: "evento-1",
    escritorioId: "esc-1",
    titulo: "Audiência de instrução",
    descricao: null,
    inicio: inicio.toISOString(),
    fim: new Date(2026, 8, 10, 15, 0).toISOString(),
    diaInteiro: false,
    modalidade: "presencial",
    local: "Fórum",
    linkReuniao: null,
    clienteId: null,
    casoId: null,
    criadoPorMembroId: "membro-1",
    createdAt: inicio.toISOString(),
    updatedAt: inicio.toISOString(),
    cliente: null,
    caso: null,
    criadoPor: {
      membroId: "membro-1",
      usuario: { id: "u1", nome: "Ator", email: "a@t.com", avatarUrl: null },
    },
    participantes: [],
    podeEditar: true,
    ...over,
  };
}

function montar(eventos: EventoDTO[]) {
  const acoes = {
    onSelecionarEvento: jest.fn(),
    onSelecionarDia: jest.fn(),
    onVerDia: jest.fn(),
  };
  render(<GradeMes dataFoco={DATA_FOCO} eventos={eventos} {...acoes} />);
  return acoes;
}

describe("GradeMes", () => {
  it("desenha a grade de 6 semanas com os cabeçalhos da semana", () => {
    montar([]);

    expect(screen.getByText("dom")).toBeInTheDocument();
    expect(screen.getByText("sáb")).toBeInTheDocument();
    // 42 células = 6 linhas × 7 dias, cada uma com o número do dia.
    expect(screen.getAllByText("15")).toHaveLength(1);
  });

  it("mostra o evento com a hora na célula do dia", () => {
    montar([eventoFake()]);

    expect(screen.getByRole("button", { name: /audiência de instrução, 14:00/i })).toBeInTheDocument();
  });

  it("mostra evento de dia inteiro sem hora", () => {
    montar([
      eventoFake({
        diaInteiro: true,
        titulo: "Viagem a Florianópolis",
        inicio: new Date(2026, 8, 10, 0, 0).toISOString(),
        fim: new Date(2026, 8, 10, 23, 59, 59, 999).toISOString(),
      }),
    ]);

    expect(
      screen.getByRole("button", { name: /viagem a florianópolis, dia inteiro/i })
    ).toBeInTheDocument();
  });

  it("abre o evento ao clicar no chip, sem disparar a criação no dia", async () => {
    const acoes = montar([eventoFake()]);

    await userEvent.setup().click(screen.getByRole("button", { name: /audiência/i }));

    expect(acoes.onSelecionarEvento).toHaveBeenCalledTimes(1);
    expect(acoes.onSelecionarDia).not.toHaveBeenCalled();
  });

  it("pede a criação de um evento ao clicar no espaço vazio do dia", async () => {
    const acoes = montar([]);

    await userEvent.setup().click(screen.getByText("15"));

    expect(acoes.onSelecionarDia).toHaveBeenCalledTimes(1);
    expect((acoes.onSelecionarDia.mock.calls[0][0] as Date).getDate()).toBe(15);
  });

  it("resume os eventos além do limite num '+N mais' que leva à visão de dia", async () => {
    const eventos = Array.from({ length: 6 }, (_, indice) =>
      eventoFake({
        id: `evento-${indice}`,
        titulo: `Compromisso ${indice}`,
        inicio: new Date(2026, 8, 10, 9 + indice, 0).toISOString(),
        fim: new Date(2026, 8, 10, 10 + indice, 0).toISOString(),
      })
    );
    const acoes = montar(eventos);

    const maisTres = screen.getByRole("button", { name: "+3 mais" });
    await userEvent.setup().click(maisTres);

    expect(acoes.onVerDia).toHaveBeenCalledTimes(1);
    expect(acoes.onSelecionarDia).not.toHaveBeenCalled();
  });
});
