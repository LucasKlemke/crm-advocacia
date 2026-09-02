import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigVariavelRow } from "./config-variavel";

const COLUNAS = ["Nome", "numero"];
const PRIMEIRA_LINHA = { Nome: "ANA MARIA DA SILVA", numero: "5511999999999" };

function renderizar(over: Partial<React.ComponentProps<typeof ConfigVariavelRow>> = {}) {
  const onMudar = jest.fn();
  render(
    <ConfigVariavelRow
      variavel="nome"
      config={{ coluna: "Nome", tratamentos: [] }}
      colunas={COLUNAS}
      primeiraLinha={PRIMEIRA_LINHA}
      onMudar={onMudar}
      {...over}
    />
  );
  return { onMudar };
}

describe("ConfigVariavelRow", () => {
  // Sem coluna não há valor para tratar: só o Select de coluna aparece.
  it("esconde tratamentos e valor padrão enquanto não há coluna escolhida", () => {
    renderizar({ config: null });

    expect(screen.getByRole("combobox", { name: /coluna para a variável nome/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /adicionar tratamento em nome/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/se a célula estiver vazia/i)).not.toBeInTheDocument();
  });

  it("oferece adicionar tratamento quando já há coluna", () => {
    renderizar();

    expect(
      screen.getByRole("combobox", { name: /adicionar tratamento em nome/i })
    ).toBeInTheDocument();
  });

  it("lista os tratamentos escolhidos, numerados na ordem de aplicação", () => {
    renderizar({ config: { coluna: "Nome", tratamentos: ["primeiro_nome", "titulo"] } });

    expect(screen.getByText("Só o primeiro nome")).toBeInTheDocument();
    expect(screen.getByText("Maiúscula em cada nome")).toBeInTheDocument();
    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
  });

  it("remove o tratamento pelo botão do chip, preservando os demais", async () => {
    const { onMudar } = renderizar({
      config: { coluna: "Nome", tratamentos: ["primeiro_nome", "titulo"] },
    });

    await userEvent.click(
      screen.getByRole("button", { name: /remover tratamento só o primeiro nome de nome/i })
    );

    expect(onMudar).toHaveBeenCalledWith("nome", expect.objectContaining({ tratamentos: ["titulo"] }));
  });

  it("mostra o efeito da cadeia na primeira linha da planilha", () => {
    renderizar({ config: { coluna: "Nome", tratamentos: ["primeiro_nome", "titulo"] } });

    expect(screen.getByText("ANA MARIA DA SILVA")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  // Sem tratamento o valor não muda, e repetir o mesmo texto dos dois lados da seta é ruído.
  it("não mostra o valor original quando nada o altera", () => {
    renderizar();

    expect(screen.getAllByText("ANA MARIA DA SILVA")).toHaveLength(1);
  });

  it("avisa a mudança do valor padrão", async () => {
    const { onMudar } = renderizar();

    await userEvent.type(screen.getByLabelText(/se a célula estiver vazia/i), "x");

    expect(onMudar).toHaveBeenCalledWith("nome", expect.objectContaining({ padrao: "x" }));
  });

  it("usa o valor padrão na prévia quando a célula está vazia", () => {
    renderizar({
      config: { coluna: "Nome", tratamentos: [], padrao: "tudo bem" },
      primeiraLinha: { Nome: "", numero: "5511999999999" },
    });

    expect(screen.getByText("tudo bem")).toBeInTheDocument();
  });
});
