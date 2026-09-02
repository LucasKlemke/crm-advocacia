import { fireEvent, render, screen, within } from "@testing-library/react";
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

function secao() {
  return screen.getByRole("region", { name: /contatos/i });
}

describe("SecaoContatos — antes do upload", () => {
  it("convida a arrastar a planilha", () => {
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

  it("indica que está lendo a planilha", () => {
    renderizar({ lendo: true });

    expect(screen.getByText(/lendo a planilha/i)).toBeInTheDocument();
  });

  it("informa o erro recebido", () => {
    renderizar({ erro: "A planilha precisa ter cabeçalho." });

    expect(screen.getByRole("alert")).toHaveTextContent(/precisa ter cabeçalho/i);
  });
});

// O pedido do usuário: depois do upload a área tracejada dá lugar aos dados que subiram.
describe("SecaoContatos — depois do upload", () => {
  it("troca a área de arrastar pela tabela dos dados", () => {
    renderizar({ planilha: PLANILHA, colunaNumero: "numero" });

    expect(screen.queryByText(/arraste a planilha aqui/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /selecionar planilha csv/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Ana" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "numero" })).toBeInTheDocument();
  });

  it("resume o arquivo carregado e oferece a troca", () => {
    renderizar({ planilha: PLANILHA, colunaNumero: "numero" });

    expect(screen.getByText("contatos.csv")).toBeInTheDocument();
    expect(secao()).toHaveTextContent("2 linha(s) · 2 coluna(s)");
    expect(screen.getByRole("button", { name: /trocar planilha/i })).toBeInTheDocument();
  });

  it("continua aceitando um arquivo arrastado sobre a seção", () => {
    const { onArquivo } = renderizar({ planilha: PLANILHA, colunaNumero: "numero" });
    const arquivo = arquivoCsv();

    fireEvent.drop(secao(), { dataTransfer: { files: [arquivo] } });

    expect(onArquivo).toHaveBeenCalledWith(arquivo);
  });

  it("mostra o total de destinatários no título da seção", () => {
    renderizar({ planilha: PLANILHA, colunaNumero: "numero" });

    expect(screen.getByText(/2 destinatário\(s\)/)).toBeInTheDocument();
  });

  it("avisa quantas linhas está mostrando quando a planilha é grande", () => {
    const linhas = Array.from({ length: 12 }, (_, indice) => ({
      Nome: `Contato ${indice}`,
      numero: "5511999998888",
    }));
    renderizar({ planilha: { ...PLANILHA, linhas }, colunaNumero: "numero" });

    expect(screen.getAllByRole("row")).toHaveLength(11); // 10 linhas + cabeçalho
    expect(secao()).toHaveTextContent("mostrando as 10 primeiras de 12 linha(s)");
  });
});

describe("SecaoContatos — coluna de número", () => {
  // Escolha da coluna e troca de planilha convivem na linha do título, sem rótulo visível:
  // o nome acessível fica no aria-label e o ícone de número faz o papel do rótulo.
  it("oferece o select da coluna na linha do título, só com nome acessível", () => {
    renderizar({ planilha: PLANILHA, colunaNumero: "numero" });

    const cabecalho = screen.getByRole("heading", { name: /contatos/i }).parentElement!;
    expect(
      within(cabecalho).getByRole("combobox", { name: /coluna com o número de whatsapp/i })
    ).toBeInTheDocument();
    expect(within(cabecalho).getByRole("button", { name: /trocar planilha/i })).toBeInTheDocument();
    expect(screen.queryByText(/coluna com o número de whatsapp/i)).not.toBeInTheDocument();
  });

  it("aponta as linhas com número inválido", () => {
    renderizar({
      planilha: { ...PLANILHA, linhas: [{ Nome: "Ana", numero: "1234" }] },
      colunaNumero: "numero",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/1 número\(s\) inválido\(s\)/i);
  });
});
