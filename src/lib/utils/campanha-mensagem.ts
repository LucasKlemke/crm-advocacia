// Substituição de {{variaveis}} da mensagem-modelo de uma campanha pelos valores de cada
// linha do CSV. Funções puras, sem I/O, porque as duas pontas precisam do mesmo resultado:
// o wizard usa para o preview enquanto o usuário digita, e o campanha.service usa para
// gravar a mensagem final de cada CampanhaItem. Se as duas divergissem, o texto revisado na
// tela não seria o texto entregue ao cliente.

// \p{L}\p{N} (com a flag u) aceita acento no nome da variável — "{{endereço}}" é natural em
// pt-BR. O + exige pelo menos um caractere, então "{{}}" não vira variável de nome vazio.
const VARIAVEL = /\{\{\s*([\p{L}\p{N}_]+)\s*\}\}/gu;

export type MapeamentoVariaveis = Record<string, string | null>;
export type LinhaCsv = Record<string, string>;

export function extrairVariaveis(template: string): string[] {
  const encontradas = new Set<string>();
  for (const match of template.matchAll(VARIAVEL)) {
    encontradas.add(match[1]);
  }
  // Set preserva a ordem de inserção — as variáveis saem na ordem em que o usuário as
  // escreveu, que é a ordem em que os campos de mapeamento aparecem na tela.
  return [...encontradas];
}

// Chave de comparação entre variável e coluna do CSV: o cabeçalho vem de uma planilha feita
// por humano ("Nome Completo", "TELEFONE", "Endereço"), então casar por igualdade literal
// falharia quase sempre. Normalizar dos dois lados faz {{nome_completo}} achar "Nome Completo".
export function normalizarChave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Casa cada variável com uma coluna do CSV. null = nenhuma coluna corresponde, e a UI pede
// para o usuário escolher qual usar.
export function sugerirMapeamento(variaveis: string[], colunas: string[]): MapeamentoVariaveis {
  const porChave = new Map<string, string>();
  for (const coluna of colunas) {
    const chave = normalizarChave(coluna);
    // Primeira coluna vence: num CSV com "Nome" e "nome", manter a primeira é mais previsível
    // do que deixar a última sobrescrever silenciosamente.
    if (chave && !porChave.has(chave)) porChave.set(chave, coluna);
  }

  const mapeamento: MapeamentoVariaveis = {};
  for (const variavel of variaveis) {
    mapeamento[variavel] = porChave.get(normalizarChave(variavel)) ?? null;
  }
  return mapeamento;
}

// Variáveis que ainda bloqueiam a criação da campanha: sem coluna definida, elas seriam
// enviadas cruas ("Olá {{nome}}") para o destinatário.
export function variaveisNaoMapeadas(
  template: string,
  mapeamento: Record<string, string | null | undefined>
): string[] {
  return extrairVariaveis(template).filter((variavel) => !mapeamento[variavel]);
}

export function renderizarMensagem(
  template: string,
  linha: LinhaCsv,
  mapeamento: Record<string, string | null | undefined>
): string {
  return template.replace(VARIAVEL, (original, variavel: string) => {
    const coluna = mapeamento[variavel];
    // Sem coluna, o placeholder fica visível em vez de sumir: um texto obviamente quebrado
    // é melhor do que um buraco silencioso na mensagem (e o service rejeita antes disso).
    if (!coluna) return original;
    // A função de replace devolve o valor literal — passar a célula como string de
    // substituição faria "$&" no CSV duplicar o trecho casado.
    return linha[coluna] ?? "";
  });
}
