import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogMensagem } from "./dialog-mensagem";

const COLUNAS = ["Nome", "numero", "Bairro"];
const PRIMEIRA_LINHA = { Nome: "Ana", numero: "5511999999999", Bairro: "Centro" };

function renderizar(over: Partial<React.ComponentProps<typeof DialogMensagem>> = {}) {
  const onAbertoChange = jest.fn();
  const onSalvar = jest.fn();
  render(
    <DialogMensagem
      aberto
      mensagem="Olá {{nome}}, tudo bem?"
      mapeamento={{ nome: { coluna: "Nome", tratamentos: [] } }}
      colunas={COLUNAS}
      primeiraLinha={PRIMEIRA_LINHA}
      remetenteNome="Atendimento"
      onAbertoChange={onAbertoChange}
      onSalvar={onSalvar}
      {...over}
    />
  );
  return { onAbertoChange, onSalvar };
}

// `fireEvent.change` e não `userEvent.type`: o userEvent trata "{{" como escape de chave
// literal, e a mensagem sairia como "Olá {apelido}" — sem variável nenhuma.
function digitar(texto: string) {
  fireEvent.change(screen.getByLabelText(/texto da mensagem/i), { target: { value: texto } });
}

describe("DialogMensagem", () => {
  it("não renderiza nada enquanto está fechado", () => {
    renderizar({ aberto: false });

    expect(screen.queryByLabelText(/texto da mensagem/i)).not.toBeInTheDocument();
  });

  it("abre com o texto já salvo", () => {
    renderizar();

    expect(screen.getByLabelText(/texto da mensagem/i)).toHaveValue("Olá {{nome}}, tudo bem?");
  });

  it("lista as variáveis encontradas no texto", () => {
    renderizar({
      mensagem: "Olá {{nome}} do {{bairro}}",
      mapeamento: { nome: { coluna: "Nome", tratamentos: [] } },
    });

    expect(screen.getByText("{{nome}}")).toBeInTheDocument();
    expect(screen.getByText("{{bairro}}")).toBeInTheDocument();
  });

  // O comportamento central pedido: variável sem coluna correspondente vira uma escolha
  // explícita do usuário, e não um envio com o placeholder cru.
  it("cobra a escolha da coluna para a variável que não casou sozinha", () => {
    renderizar({
      mensagem: "Olá {{nome}} do {{bairro_preferido}}",
      mapeamento: { nome: { coluna: "Nome", tratamentos: [] }, bairro_preferido: null },
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

  it("pede a planilha antes de oferecer as colunas", () => {
    renderizar({ colunas: [], primeiraLinha: undefined, mapeamento: { nome: null } });

    expect(screen.getByText(/faça o upload da planilha de contatos/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("mostra a prévia renderizada com a primeira linha da planilha", () => {
    renderizar();

    expect(screen.getByText("Olá Ana, tudo bem?", { selector: "span" })).toBeInTheDocument();
  });

  it("atualiza a prévia enquanto o texto muda", () => {
    renderizar();

    digitar("Bom dia {{nome}}!");

    expect(screen.getByText("Bom dia Ana!", { selector: "span" })).toBeInTheDocument();
  });

  it("casa a variável nova com a coluna de mesmo nome sozinho", () => {
    renderizar({ mensagem: "", mapeamento: {} });

    digitar("Você é do {{bairro}}?");

    expect(screen.getByText("Você é do Centro?", { selector: "span" })).toBeInTheDocument();
  });

  it("entrega texto e mapeamento ao salvar", async () => {
    const { onSalvar } = renderizar();

    digitar("Bom dia {{nome}}!");
    await userEvent.click(screen.getByRole("button", { name: /salvar mensagem/i }));

    expect(onSalvar).toHaveBeenCalledWith("Bom dia {{nome}}!", {
      nome: { coluna: "Nome", tratamentos: [] },
    });
  });

  // O rascunho é descartado no cancelar: nada sai daqui sem passar pelo salvar.
  it("não salva nada ao cancelar", async () => {
    const { onSalvar, onAbertoChange } = renderizar();

    digitar("Texto que vai embora");
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onSalvar).not.toHaveBeenCalled();
    // O base-ui manda um segundo argumento com detalhes do fechamento junto do booleano.
    expect(onAbertoChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("não deixa salvar mensagem vazia", () => {
    renderizar({ mensagem: "", mapeamento: {} });

    expect(screen.getByRole("button", { name: /salvar mensagem/i })).toBeDisabled();
  });
});
