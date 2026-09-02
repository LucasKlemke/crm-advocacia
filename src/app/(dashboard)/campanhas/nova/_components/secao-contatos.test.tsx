import { fireEvent, render, screen } from "@testing-library/react";
import { SecaoContatos } from "./secao-contatos";

const PLANILHA = {
  nomeArquivo: "contatos.csv",
  colunas: ["Nome", "numero"],
  linhas: [
    { Nome: "Ana", numero: "5511999998888" },
    { Nome: "Bruno", numero: "5511977776666" },
  ],
};

function renderizar(over: Partial<React.ComponentProps<typeof SecaoContatos>> = {}) {
  const onAbrirSeletor = jest.fn();
  const onArquivo = jest.fn();
  const onColunaNumero = jest.fn();
  render(
    <SecaoContatos
      planilha={null}
      colunaNumero=""
      lendo={false}
      erro={null}
      onAbrirSeletor={onAbrirSeletor}
      onArquivo={onArquivo}
      onColunaNumero={onColunaNumero}
      {...over}
    />
  );
  return { onAbrirSeletor, onArquivo, onColunaNumero };
}

function arquivoCsv() {
  return new File(["Nome,numero"], "contatos.csv", { type: "text/csv" });
}

describe("SecaoContatos — área de upload", () => {
  it("convida a arrastar a planilha antes de qualquer arquivo", () => {
    renderizar();

    expect(screen.getByText(/arraste a planilha aqui/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /selecionar planilha csv/i })).toBeInTheDocument();
  });

  it("abre o seletor de arquivo ao clicar na área", () => {
    const { onAbrirSeletor } = renderizar();

    fireEvent.click(screen.getByRole("button", { name: /selecionar planilha csv/i }));

    expect(onAbrirSeletor).toHaveBeenCalled();
  });

  it("entrega o arquivo solto na área", () => {
    const { onArquivo } = renderizar();
    const arquivo = arquivoCsv();

    fireEvent.drop(screen.getByRole("button", { name: /selecionar planilha csv/i }), {
      dataTransfer: { files: [arquivo] },
    });

    expect(onArquivo).toHaveBeenCalledWith(arquivo);
  });

  it("mostra o arquivo escolhido e o convite para trocar", () => {
    renderizar({ planilha: PLANILHA, colunaNumero: "numero" });

    expect(screen.getByText("contatos.csv")).toBeInTheDocument();
    expect(screen.getByText(/2 linha\(s\) · 2 coluna\(s\)/)).toBeInTheDocument();
    // A própria área é o alvo de troca — não há um segundo botão para a mesma ação.
    expect(screen.getByRole("button", { name: /trocar planilha csv/i })).toBeInTheDocument();
    expect(screen.getByText(/arraste outro arquivo aqui/i)).toBeInTheDocument();
  });

  it("mostra o total de destinatários no título da seção", () => {
    renderizar({ planilha: PLANILHA, colunaNumero: "numero" });

    expect(screen.getByText(/2 destinatário\(s\)/)).toBeInTheDocument();
  });

  it("indica que está lendo a planilha", () => {
    renderizar({ lendo: true });

    expect(screen.getByText(/lendo a planilha/i)).toBeInTheDocument();
  });

  it("informa o erro recebido", () => {
    renderizar({ erro: "A planilha precisa ter cabeçalho." });

    expect(screen.getByRole("alert")).toHaveTextContent(/precisa ter cabeçalho/i);
  });
});

describe("SecaoContatos — coluna de número", () => {
  it("oferece o select da coluna com os números", () => {
    renderizar({ planilha: PLANILHA, colunaNumero: "numero" });

    expect(
      screen.getByRole("combobox", { name: /coluna com o número de whatsapp/i })
    ).toBeInTheDocument();
  });

  it("aponta as linhas com número inválido", () => {
    renderizar({
      planilha: { ...PLANILHA, linhas: [{ Nome: "Ana", numero: "1234" }] },
      colunaNumero: "numero",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/1 número\(s\) inválido\(s\)/i);
  });
});
