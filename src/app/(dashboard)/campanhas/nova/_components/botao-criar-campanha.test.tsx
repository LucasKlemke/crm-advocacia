import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BotaoCriarCampanha } from "./botao-criar-campanha";
import type { TarefaCampanha } from "./tarefas-campanha";

const TUDO_FEITO: TarefaCampanha[] = [
  { id: "nome", rotulo: "Dar um nome à campanha", concluida: true },
  { id: "mensagem", rotulo: "Escrever a mensagem", concluida: true },
];

const FALTANDO: TarefaCampanha[] = [
  { id: "nome", rotulo: "Dar um nome à campanha", concluida: true },
  { id: "mensagem", rotulo: "Escrever a mensagem", concluida: false },
];

function renderizar(over: Partial<React.ComponentProps<typeof BotaoCriarCampanha>> = {}) {
  const onCriar = jest.fn();
  render(<BotaoCriarCampanha tarefas={TUDO_FEITO} criando={false} onCriar={onCriar} {...over} />);
  return { onCriar };
}

function botao() {
  return screen.getByRole("button", { name: /criar campanha/i });
}

describe("BotaoCriarCampanha — nada pendente", () => {
  it("cria ao clicar", async () => {
    const { onCriar } = renderizar();

    await userEvent.click(botao());

    expect(onCriar).toHaveBeenCalled();
    expect(botao()).not.toHaveAttribute("aria-disabled");
  });

  it("não mostra checklist nenhum", async () => {
    renderizar();

    await userEvent.hover(botao());

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("indica o envio em andamento", () => {
    renderizar({ criando: true });

    expect(screen.getByRole("button", { name: /criando/i })).toBeDisabled();
  });
});

describe("BotaoCriarCampanha — com pendência", () => {
  it("bloqueia o clique sem usar `disabled`, para a tooltip continuar acessível", async () => {
    const { onCriar } = renderizar({ tarefas: FALTANDO });

    await userEvent.click(botao());

    expect(onCriar).not.toHaveBeenCalled();
    expect(botao()).toHaveAttribute("aria-disabled", "true");
    expect(botao()).toBeEnabled();
  });

  it("mostra no hover o que já foi feito e o que falta", async () => {
    renderizar({ tarefas: FALTANDO });

    await userEvent.hover(botao());
    const dica = within(await screen.findByRole("tooltip"));

    expect(dica.getByText(/falta 1 item para criar/i)).toBeInTheDocument();
    expect(dica.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Dar um nome à campanha (concluído)",
      "Escrever a mensagem (pendente)",
    ]);
  });

  it("concorda o plural quando falta mais de um item", async () => {
    renderizar({
      tarefas: FALTANDO.map((tarefa) => ({ ...tarefa, concluida: false })),
    });

    await userEvent.hover(botao());

    expect(await screen.findByText(/falta 2 itens para criar/i)).toBeInTheDocument();
  });
});
