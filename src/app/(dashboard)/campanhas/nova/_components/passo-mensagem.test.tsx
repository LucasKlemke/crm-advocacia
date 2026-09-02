import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PassoMensagem } from "./passo-mensagem";

const COLUNAS = ["Nome", "numero", "Bairro"];
const PRIMEIRA_LINHA = { Nome: "Ana", numero: "5511999999999", Bairro: "Centro" };

function renderizar(over: Partial<React.ComponentProps<typeof PassoMensagem>> = {}) {
  const onMensagem = jest.fn();
  const onMapear = jest.fn();
  render(
    <PassoMensagem
      mensagem="Olá {{nome}}, tudo bem?"
      colunas={COLUNAS}
      primeiraLinha={PRIMEIRA_LINHA}
      mapeamento={{ nome: "Nome" }}
      onMensagem={onMensagem}
      onMapear={onMapear}
      {...over}
    />
  );
  return { onMensagem, onMapear };
}

describe("PassoMensagem", () => {
  it("lista as variáveis encontradas no texto", () => {
    renderizar({ mensagem: "Olá {{nome}} do {{bairro}}", mapeamento: { nome: "Nome" } });

    expect(screen.getByText("{{nome}}")).toBeInTheDocument();
    expect(screen.getByText("{{bairro}}")).toBeInTheDocument();
  });

  // O comportamento central pedido: variável sem coluna correspondente vira uma escolha
  // explícita do usuário, e não um envio com o placeholder cru.
  it("cobra a escolha da coluna para a variável que não casou sozinha", () => {
    renderizar({
      mensagem: "Olá {{nome}} do {{bairro_preferido}}",
      mapeamento: { nome: "Nome", bairro_preferido: null },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("{{bairro_preferido}}");
    expect(
      screen.getByRole("combobox", { name: /coluna para a variável bairro_preferido/i })
    ).toBeInTheDocument();
  });

  it("não cobra nada quando todas as variáveis têm coluna", () => {
    renderizar();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra a prévia renderizada com a primeira linha da planilha", () => {
    renderizar();

    expect(screen.getByText("Olá Ana, tudo bem?")).toBeInTheDocument();
  });

  it("mantém o placeholder na prévia enquanto a variável não tem coluna", () => {
    renderizar({ mensagem: "Olá {{apelido}}", mapeamento: { apelido: null } });

    // `selector: "p"` porque o mesmo texto também está no valor do textarea.
    expect(screen.getByText("Olá {{apelido}}", { selector: "p" })).toBeInTheDocument();
  });

  it("avisa cada digitação no texto da mensagem", async () => {
    const { onMensagem } = renderizar({ mensagem: "", mapeamento: {} });

    await userEvent.type(screen.getByLabelText(/texto da mensagem/i), "Oi");

    expect(onMensagem).toHaveBeenCalled();
  });

  it("não mostra bloco de variáveis quando a mensagem não tem nenhuma", () => {
    renderizar({ mensagem: "Mensagem fixa", mapeamento: {} });

    expect(screen.queryByText(/variáveis encontradas/i)).not.toBeInTheDocument();
  });
});
