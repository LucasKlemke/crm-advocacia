import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SecaoMensagem } from "./secao-mensagem";

const PRIMEIRA_LINHA = { Nome: "Ana", numero: "5511999999999", Bairro: "Centro" };

function renderizar(over: Partial<React.ComponentProps<typeof SecaoMensagem>> = {}) {
  const onEditar = jest.fn();
  render(
    <SecaoMensagem
      mensagem="Olá {{nome}}, tudo bem?"
      mapeamento={{ nome: { coluna: "Nome", tratamentos: [] } }}
      primeiraLinha={PRIMEIRA_LINHA}
      remetenteNome="Atendimento"
      onEditar={onEditar}
      {...over}
    />
  );
  return { onEditar };
}

// Fora do dialog só existe a prévia: o texto e os selects de variável moram no editor.
describe("SecaoMensagem", () => {
  it("mostra a prévia renderizada com a primeira linha da planilha", () => {
    renderizar();

    expect(screen.getByText("Olá Ana, tudo bem?")).toBeInTheDocument();
  });

  it("não mostra campo de edição da mensagem", () => {
    renderizar();

    expect(screen.queryByLabelText(/texto da mensagem/i)).not.toBeInTheDocument();
  });

  // A prévia imita a conversa do WhatsApp: no topo aparece de quem o cliente vai receber.
  it("mostra o remetente no cabeçalho da prévia", () => {
    renderizar();

    expect(screen.getByText("Atendimento")).toBeInTheDocument();
  });

  it("resume a coluna, os tratamentos e o padrão de cada variável", () => {
    renderizar({
      mensagem: "Olá {{nome}}",
      mapeamento: {
        nome: { coluna: "Nome", tratamentos: ["primeiro_nome", "maiusculas"], padrao: "cliente" },
      },
    });

    expect(screen.getByText("{{nome}}")).toBeInTheDocument();
    expect(
      screen.getByText(/coluna "Nome" · Só o primeiro nome → TUDO MAIÚSCULO · vazio vira "cliente"/i)
    ).toBeInTheDocument();
  });

  it("avisa quando alguma variável ficou sem coluna", () => {
    renderizar({ mensagem: "Olá {{apelido}}", mapeamento: { apelido: null } });

    expect(screen.getByRole("alert")).toHaveTextContent(/sem coluna escolhida/i);
  });

  it("mantém o placeholder na prévia enquanto a variável não tem coluna", () => {
    renderizar({ mensagem: "Olá {{apelido}}", mapeamento: { apelido: null } });

    expect(screen.getByText("Olá {{apelido}}")).toBeInTheDocument();
  });

  it("pede a edição pelo botão do título", async () => {
    const { onEditar } = renderizar();

    await userEvent.click(screen.getByRole("button", { name: /editar mensagem/i }));

    expect(onEditar).toHaveBeenCalled();
  });

  it("convida a escrever quando ainda não há mensagem", async () => {
    const { onEditar } = renderizar({ mensagem: "", mapeamento: {} });

    expect(screen.getByText(/nenhuma mensagem escrita/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /escrever agora/i }));

    expect(onEditar).toHaveBeenCalled();
  });
});
