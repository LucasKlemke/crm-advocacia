import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaixaHoras } from "./faixa-horas";
import type { EventoDTO } from "@/types/evento";

const DIA = new Date(2026, 8, 10);

function eventoFake(over: Partial<EventoDTO> = {}): EventoDTO {
  return {
    id: "evento-1",
    escritorioId: "esc-1",
    titulo: "Audiência de instrução",
    descricao: null,
    inicio: new Date(2026, 8, 10, 14, 0).toISOString(),
    fim: new Date(2026, 8, 10, 15, 0).toISOString(),
    diaInteiro: false,
    modalidade: "presencial",
    local: "Fórum",
    linkReuniao: null,
    clienteId: null,
    casoId: null,
    criadoPorMembroId: "membro-1",
    createdAt: new Date(2026, 8, 1).toISOString(),
    updatedAt: new Date(2026, 8, 1).toISOString(),
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
  const acoes = { onSelecionarEvento: jest.fn(), onSelecionarSlot: jest.fn() };
  render(<FaixaHoras dias={[DIA]} eventos={eventos} {...acoes} />);
  return acoes;
}

describe("FaixaHoras", () => {
  it("abre o evento ao clicar no bloco, sem disparar a criação no slot", async () => {
    const acoes = montar([eventoFake()]);

    await userEvent.setup().click(screen.getByRole("button", { name: /audiência de instrução/i }));

    expect(acoes.onSelecionarEvento).toHaveBeenCalledWith(expect.objectContaining({ id: "evento-1" }));
    // O bloco fica dentro da coluna clicável do dia: sem stopPropagation o clique
    // borbulha e o formulário de criação substitui o detalhe do evento.
    expect(acoes.onSelecionarSlot).not.toHaveBeenCalled();
  });

  it("cria no slot ao clicar no espaço vazio da coluna", async () => {
    const acoes = montar([]);

    await userEvent.setup().click(screen.getByTestId("coluna-dia-2026-09-10"));

    expect(acoes.onSelecionarSlot).toHaveBeenCalledTimes(1);
    expect(acoes.onSelecionarEvento).not.toHaveBeenCalled();
  });
});
