// Utils puros usados pelo front E pela API: continuam em src/lib/utils (domínio) até a
// Fase 5, e o web os importa por @dominio/. Os demais utils de src/lib/utils são só do
// front e foram movidos para apps/web/src/lib/utils (Task 4.3).
export const UTILS_DO_DOMINIO = [
  "campanha-mensagem",
  "campanha-status-mensagem",
  "campanha-tratamentos",
  "cores-status",
  "cpf",
  "email",
  "icones-status",
  "telefone",
] as const;

const TROCAS_EXATAS = new Map<string, string>([
  ["next/navigation", "@/compat/next-navigation"],
  ["next/link", "@/compat/next-link"],
  ["next/image", "@/compat/next-image"],
  ["@/lib/auth/cliente-sessao", "@/lib/sessao"],
  ["@/lib/auth/permissoes", "@dominio/lib/auth/permissoes"],
  ...UTILS_DO_DOMINIO.map((util): [string, string] => [`@/lib/utils/${util}`, `@dominio/lib/utils/${util}`]),
]);

// Só reescreve string em posição de módulo: `from "x"`, `import "x"`, `import("x")` e as
// APIs de mock do Jest. Uma string comum com o mesmo texto fica intacta.
function padraoDeEspecificador() {
  return /(\bfrom\s+|\bimport\s+|\bimport\s*\(\s*|\bjest\.(?:mock|doMock|unmock|requireActual|requireMock)\(\s*)(["'])([^"'\n]+)\2/g;
}

export function trocarEspecificador(especificador: string): string {
  const exata = TROCAS_EXATAS.get(especificador);
  if (exata) return exata;
  if (especificador.startsWith("@/types/")) {
    return `@dominio/types/${especificador.slice("@/types/".length)}`;
  }
  return especificador;
}

export function transformarImports(codigo: string): string {
  return codigo.replace(
    padraoDeEspecificador(),
    (_trecho, prefixo: string, aspas: string, especificador: string) =>
      `${prefixo}${aspas}${trocarEspecificador(especificador)}${aspas}`
  );
}

export function extrairEspecificadores(codigo: string): string[] {
  return [...codigo.matchAll(padraoDeEspecificador())].map((casamento) => casamento[3]);
}
