import Papa from "papaparse";
import { normalizarChave, type LinhaCsv } from "@/lib/utils/campanha-mensagem";

export interface PlanilhaCampanha {
  colunas: string[];
  linhas: LinhaCsv[];
}

export class CsvInvalidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "CsvInvalidoError";
  }
}

// Nomes de coluna que costumam guardar o telefone, em ordem de preferência: numa planilha
// com "celular" e "numero", a mais específica ganha.
const CANDIDATAS_NUMERO = ["numero", "telefone", "whatsapp", "celular", "fone"];

export function sugerirColunaNumero(colunas: string[]): string | null {
  for (const candidata of CANDIDATAS_NUMERO) {
    const achada = colunas.find((coluna) => normalizarChave(coluna).includes(candidata));
    if (achada) return achada;
  }
  return null;
}

// Parse no browser (e não no servidor) para o usuário ver as colunas e o preview da
// mensagem sem round-trip; o que sobe para a API são as linhas já estruturadas.
export function lerPlanilha(arquivo: File): Promise<PlanilhaCampanha> {
  return new Promise((resolve, reject) => {
    Papa.parse<LinhaCsv>(arquivo, {
      header: true,
      skipEmptyLines: "greedy",
      // Vazio = autodetectar. Planilha exportada do Excel em pt-BR usa ";" em vez de ",".
      delimiter: "",
      transformHeader: (cabecalho) => cabecalho.trim(),
      complete: (resultado) => {
        const colunas = (resultado.meta.fields ?? []).filter((coluna) => coluna.length > 0);
        if (colunas.length === 0) {
          reject(new CsvInvalidoError("A planilha precisa ter uma linha de cabeçalho."));
          return;
        }

        // Papaparse devolve undefined para célula ausente numa linha mais curta que o
        // cabeçalho; normaliza para "" aqui, porque a renderização espera string.
        const linhas = resultado.data.map((linha) =>
          Object.fromEntries(colunas.map((coluna) => [coluna, (linha[coluna] ?? "").trim()]))
        );

        if (linhas.length === 0) {
          reject(new CsvInvalidoError("A planilha não tem nenhuma linha de destinatário."));
          return;
        }

        resolve({ colunas, linhas });
      },
      error: () => reject(new CsvInvalidoError("Não foi possível ler a planilha.")),
    });
  });
}
