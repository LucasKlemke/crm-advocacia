import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PassoCsv } from "./passo-csv";
import { lerPlanilha } from "@/lib/utils/csv-campanha";

jest.mock("@/lib/utils/csv-campanha", () => ({
  ...jest.requireActual("@/lib/utils/csv-campanha"),
  lerPlanilha: jest.fn(),
}));

const lerPlanilhaMock = lerPlanilha as jest.Mock;

const PLANILHA = {
  nomeArquivo: "contatos.csv",
  colunas: ["Nome", "numero"],
  linhas: [
    { Nome: "Ana", numero: "5511999998888" },
    { Nome: "Bruno", numero: "5511977776666" },
  ],
};

function arquivoCsv() {
  return new File(["Nome,numero"], "contatos.csv", { type: "text/csv" });
}

beforeEach(() => {
  jest.clearAllMocks();
  lerPlanilhaMock.mockResolvedValue({ colunas: PLANILHA.colunas, linhas: PLANILHA.linhas });
});

describe("PassoCsv — área de upload", () => {
  it("convida a arrastar a planilha antes de qualquer arquivo", () => {
    render(
      <PassoCsv planilha={null} colunaNumero="" onPlanilha={jest.fn()} onColunaNumero={jest.fn()} />
    );

    expect(screen.getByText(/arraste a planilha aqui/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /selecionar planilha csv/i })).toBeInTheDocument();
  });

  it("lê a planilha solta na área e devolve a coluna de número sugerida", async () => {
    const onPlanilha = jest.fn();
    render(
      <PassoCsv planilha={null} colunaNumero="" onPlanilha={onPlanilha} onColunaNumero={jest.fn()} />
    );

    fireEvent.drop(screen.getByRole("button", { name: /selecionar planilha csv/i }), {
      dataTransfer: { files: [arquivoCsv()] },
    });

    await waitFor(() =>
      expect(onPlanilha).toHaveBeenCalledWith(
        expect.objectContaining({ nomeArquivo: "contatos.csv" }),
        "numero"
      )
    );
  });

  it("mostra o arquivo escolhido e o convite para trocar", () => {
    render(
      <PassoCsv
        planilha={PLANILHA}
        colunaNumero="numero"
        onPlanilha={jest.fn()}
        onColunaNumero={jest.fn()}
      />
    );

    expect(screen.getByText("contatos.csv")).toBeInTheDocument();
    expect(screen.getByText(/2 linha\(s\) · 2 coluna\(s\)/)).toBeInTheDocument();
    // A própria área é o alvo de troca — não há um segundo botão para a mesma ação.
    expect(screen.getByRole("button", { name: /trocar planilha csv/i })).toBeInTheDocument();
    expect(screen.getByText(/arraste outro arquivo aqui/i)).toBeInTheDocument();
  });

  it("informa o erro quando a planilha não pode ser lida", async () => {
    const { CsvInvalidoError } = jest.requireActual("@/lib/utils/csv-campanha");
    lerPlanilhaMock.mockRejectedValue(new CsvInvalidoError("A planilha precisa ter cabeçalho."));

    render(
      <PassoCsv planilha={null} colunaNumero="" onPlanilha={jest.fn()} onColunaNumero={jest.fn()} />
    );

    fireEvent.drop(screen.getByRole("button", { name: /selecionar planilha csv/i }), {
      dataTransfer: { files: [arquivoCsv()] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/precisa ter cabeçalho/i);
  });
});

describe("PassoCsv — coluna de número", () => {
  it("oferece o select da coluna com os números", () => {
    render(
      <PassoCsv
        planilha={PLANILHA}
        colunaNumero="numero"
        onPlanilha={jest.fn()}
        onColunaNumero={jest.fn()}
      />
    );

    expect(
      screen.getByRole("combobox", { name: /coluna com o número de whatsapp/i })
    ).toBeInTheDocument();
  });

  it("aponta as linhas com número inválido", () => {
    render(
      <PassoCsv
        planilha={{ ...PLANILHA, linhas: [{ Nome: "Ana", numero: "1234" }] }}
        colunaNumero="numero"
        onPlanilha={jest.fn()}
        onColunaNumero={jest.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/1 número\(s\) inválido\(s\)/i);
  });
});
