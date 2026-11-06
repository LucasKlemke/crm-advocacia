// Tratamentos aplicados ao valor de uma {{variavel}} antes de entrar na mensagem. Uma
// planilha real traz "ANA MARIA DA SILVA" ou "ana maria", e mandar isso cru numa saudação
// soa robótico — o tratamento resolve isso sem exigir que o usuário limpe o CSV antes.
//
// São puros e encadeáveis: a cadeia roda na ordem escolhida, então "primeiro nome" +
// "título" dá "maiúscula apenas no primeiro nome" sem precisar de um tratamento dedicado
// para cada combinação.

export type Tratamento =
  | "primeiro_nome"
  | "ultimo_nome"
  | "primeiro_e_ultimo_nome"
  | "maiusculas"
  | "minusculas"
  | "titulo"
  | "capitalizar"
  | "remover_acentos";

// Partículas de nome em pt-BR ficam minúsculas no meio do nome: "Maria de Souza", nunca
// "Maria De Souza". Só viram maiúsculas quando abrem o nome ("Da Silva").
const PARTICULAS = new Set([
  "de", "da", "do", "das", "dos", "e", "di", "du", "dal", "del", "della",
  "van", "von", "der", "la", "le", "las", "los", "y",
]);

function palavras(valor: string): string[] {
  return valor.trim().split(/\s+/).filter(Boolean);
}

function semAcento(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// toLocaleUpperCase("pt-BR") em vez de toUpperCase: preserva o comportamento correto para
// letras acentuadas ("ângela" -> "ÂNGELA").
function maiuscula(letra: string): string {
  return letra.toLocaleUpperCase("pt-BR");
}

function minuscula(valor: string): string {
  return valor.toLocaleLowerCase("pt-BR");
}

function capitalizarPalavra(palavra: string): string {
  if (!palavra) return palavra;
  return maiuscula(palavra.slice(0, 1)) + minuscula(palavra.slice(1));
}

const APLICADORES: Record<Tratamento, (valor: string) => string> = {
  primeiro_nome: (valor) => palavras(valor)[0] ?? "",
  ultimo_nome: (valor) => palavras(valor).at(-1) ?? "",
  primeiro_e_ultimo_nome: (valor) => {
    const partes = palavras(valor);
    if (partes.length <= 1) return partes[0] ?? "";
    return `${partes[0]} ${partes.at(-1)}`;
  },
  maiusculas: (valor) => valor.toLocaleUpperCase("pt-BR"),
  minusculas: (valor) => minuscula(valor),
  titulo: (valor) =>
    palavras(valor)
      .map((palavra, indice) => {
        // A primeira palavra sempre capitaliza, mesmo sendo partícula: "da silva" é
        // sobrenome usado como nome, não uma preposição solta.
        if (indice > 0 && PARTICULAS.has(semAcento(minuscula(palavra)))) return minuscula(palavra);
        return capitalizarPalavra(palavra);
      })
      .join(" "),
  capitalizar: (valor) => {
    const partes = palavras(valor);
    if (partes.length === 0) return "";
    return [capitalizarPalavra(partes[0]), ...partes.slice(1).map(minuscula)].join(" ");
  },
  remover_acentos: (valor) => semAcento(valor),
};

export interface TratamentoDisponivel {
  id: Tratamento;
  rotulo: string;
  exemploEntrada: string;
  exemplo: string;
}

// Alimenta a UI: o usuário escolhe pelo rótulo e confere o efeito pelo exemplo, sem
// precisar testar na prévia. Um teste garante que exemplo e implementação não divirjam.
export const TRATAMENTOS_DISPONIVEIS: TratamentoDisponivel[] = [
  { id: "primeiro_nome", rotulo: "Só o primeiro nome", exemploEntrada: "Ana Maria da Silva", exemplo: "Ana" },
  { id: "ultimo_nome", rotulo: "Só o último nome", exemploEntrada: "Ana Maria da Silva", exemplo: "Silva" },
  {
    id: "primeiro_e_ultimo_nome",
    rotulo: "Primeiro e último nome",
    exemploEntrada: "Ana Maria da Silva",
    exemplo: "Ana Silva",
  },
  { id: "titulo", rotulo: "Maiúscula em cada nome", exemploEntrada: "ana maria da silva", exemplo: "Ana Maria da Silva" },
  {
    id: "capitalizar",
    rotulo: "Maiúscula só no primeiro nome",
    exemploEntrada: "ANA MARIA DA SILVA",
    exemplo: "Ana maria da silva",
  },
  { id: "maiusculas", rotulo: "TUDO MAIÚSCULO", exemploEntrada: "Ana Maria", exemplo: "ANA MARIA" },
  { id: "minusculas", rotulo: "tudo minúsculo", exemploEntrada: "Ana Maria", exemplo: "ana maria" },
  { id: "remover_acentos", rotulo: "Remover acentos", exemploEntrada: "João Conceição", exemplo: "Joao Conceicao" },
];

export function tratamentoValido(valor: string): valor is Tratamento {
  return valor in APLICADORES;
}

export function aplicarTratamentos(valor: string, tratamentos: readonly Tratamento[]): string {
  return tratamentos.reduce((atual, tratamento) => {
    const aplicador = APLICADORES[tratamento];
    // Tratamento desconhecido (campanha antiga, payload adulterado) é ignorado: melhor a
    // mensagem sair sem o tratamento do que a renderização inteira quebrar.
    return aplicador ? aplicador(atual) : atual;
  }, valor);
}
