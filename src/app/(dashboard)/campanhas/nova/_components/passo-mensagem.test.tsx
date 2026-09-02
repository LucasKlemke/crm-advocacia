import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PassoMensagem } from "./passo-mensagem";

const COLUNAS = ["Nome", "numero", "Bairro"];
const PRIMEIRA_LINHA = { Nome: "Ana", numero: "5511999999999", Bairro: "Centro" };

function renderizar(over: Partial<React.ComponentProps<typeof PassoMensagem>> = {}) {
  const onMensagem = jest.fn();
  const onConfigurar = jest.fn();
  render(
    <PassoMensagem
      mensagem="Olá {{nome}}, tudo bem?"
      colunas={COLUNAS}
      primeiraLinha={PRIMEIRA_LINHA}
      mapeamento={{ nome: { coluna: "Nome", tratamentos: [] } }}
      remetenteNome="Atendimento"
      onMensagem={onMensagem}
      onConfigurar={onConfigurar}
      {...over}
    />
  );
  return { onMensagem, onConfigurar };
}

describe("PassoMensagem", () => {
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

  it("mostra a prévia renderizada com a primeira linha da planilha", () => {
    renderizar();

    expect(screen.getByText("Olá Ana, tudo bem?")).toBeInTheDocument();
  });

  // A prévia imita a conversa do WhatsApp: no topo aparece de quem o cliente vai receber.
  it("mostra o remetente no cabeçalho da prévia", () => {
    renderizar();

    expect(screen.getByText("Atendimento")).toBeInTheDocument();
  });

  it("mantém o placeholder na prévia enquanto a variável não tem coluna", () => {
    renderizar({ mensagem: "Olá {{apelido}}", mapeamento: { apelido: null } });

    // `selector: "span"` porque a bolha renderiza o texto em segmentos; o mesmo conteúdo
    // também está no valor do textarea, que é uma <textarea>, não um <span>.
    expect(screen.getByText("Olá {{apelido}}", { selector: "span" })).toBeInTheDocument();
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
