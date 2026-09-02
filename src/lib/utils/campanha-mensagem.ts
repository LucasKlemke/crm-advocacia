// Substituição de {{variaveis}} da mensagem-modelo de uma campanha pelos valores de cada
// linha do CSV. Funções puras, sem I/O, porque as duas pontas precisam do mesmo resultado:
// o wizard usa para o preview enquanto o usuário digita, e o campanha.service usa para
// gravar a mensagem final de cada CampanhaItem. Se as duas divergissem, o texto revisado na
// tela não seria o texto entregue ao cliente.

import { aplicarTratamentos, tratamentoValido, type Tratamento } from "./campanha-tratamentos";

export type { Tratamento };

// \p{L}\p{N} (com a flag u) aceita acento no nome da variável — "{{endereço}}" é natural em
// pt-BR. O + exige pelo menos um caractere, então "{{}}" não vira variável de nome vazio.
const VARIAVEL = /\{\{\s*([\p{L}\p{N}_]+)\s*\}\}/gu;

// Como uma variável é preenchida: de qual coluna do CSV vem o valor, que tratamentos são
// aplicados (em ordem) e o que usar quando o resultado fica vazio.
export interface ConfigVariavel {
  coluna: string;
  tratamentos?: Tratamento[];
  padrao?: string;
}

export type MapeamentoVariaveis = Record<string, ConfigVariavel | null>;
export type MapeamentoParcial = Record<string, ConfigVariavel | null | undefined>;
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
    const coluna = porChave.get(normalizarChave(variavel));
    // Sugestão nasce sem tratamento: adivinhar que {{nome}} quer "só o primeiro nome"
    // seria mudar a mensagem sem o usuário pedir.
    mapeamento[variavel] = coluna ? { coluna, tratamentos: [] } : null;
  }
  return mapeamento;
}

// Variáveis que ainda bloqueiam a criação da campanha: sem coluna definida, elas seriam
// enviadas cruas ("Olá {{nome}}") para o destinatário.
export function variaveisNaoMapeadas(template: string, mapeamento: MapeamentoParcial): string[] {
  return extrairVariaveis(template).filter((variavel) => !mapeamento[variavel]?.coluna);
}

// Valor final de uma variável para uma linha: célula -> cadeia de tratamentos -> padrão
// quando o resultado ficou vazio. Exposto porque o service também guarda esse valor no
// snapshot de cada CampanhaItem.
export function resolverValor(config: ConfigVariavel, linha: LinhaCsv): string {
  const bruto = linha[config.coluna] ?? "";
  const tratado = aplicarTratamentos(bruto, config.tratamentos ?? []);
  // O padrão é o texto final, não entrada da cadeia: quem escreveu "tudo bem" não espera
  // que "só o primeiro nome" o reduza a "tudo".
  if (tratado.trim() === "") return config.padrao ?? "";
  return tratado;
}

export function renderizarMensagem(
  template: string,
  linha: LinhaCsv,
  mapeamento: MapeamentoParcial
): string {
  return template.replace(VARIAVEL, (original, variavel: string) => {
    const config = mapeamento[variavel];
    // Sem coluna, o placeholder fica visível em vez de sumir: um texto obviamente quebrado
    // é melhor do que um buraco silencioso na mensagem (e o service rejeita antes disso).
    if (!config?.coluna) return original;
    // A função de replace devolve o valor literal — passar a célula como string de
    // substituição faria "$&" no CSV duplicar o trecho casado.
    return resolverValor(config, linha);
  });
}

// O mapeamento vem de um campo Json (banco) ou de um payload HTTP, então pode estar no
// formato antigo — { variavel: "Coluna" }, de antes dos tratamentos — ou simplesmente
// malformado. Normaliza os dois casos para a leitura nunca quebrar a tela.
export function normalizarMapeamento(valor: unknown): MapeamentoVariaveis {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};

  const mapeamento: MapeamentoVariaveis = {};
  for (const [variavel, bruto] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof bruto === "string") {
      if (bruto) mapeamento[variavel] = { coluna: bruto, tratamentos: [] };
      continue;
    }
    if (!bruto || typeof bruto !== "object") continue;

    const config = bruto as Record<string, unknown>;
    if (typeof config.coluna !== "string" || !config.coluna) continue;

    const tratamentos = Array.isArray(config.tratamentos)
      ? config.tratamentos.filter(
          (item): item is Tratamento => typeof item === "string" && tratamentoValido(item)
        )
      : [];

    mapeamento[variavel] = {
      coluna: config.coluna,
      tratamentos,
      ...(typeof config.padrao === "string" && config.padrao ? { padrao: config.padrao } : {}),
    };
  }
  return mapeamento;
}
