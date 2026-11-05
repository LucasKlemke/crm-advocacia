// Uso: node apps/web/scripts/codemod-imports.ts <arquivo|pasta>...
// Node 26 executa .ts direto (type stripping) — por isso o import com extensão.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformarImports } from "./transformar-imports.ts";

function listarArquivos(caminho: string): string[] {
  if (statSync(caminho).isFile()) return [caminho];
  return readdirSync(caminho, { withFileTypes: true }).flatMap((entrada) => {
    if (entrada.name === "node_modules" || entrada.name === "dist") return [];
    const completo = join(caminho, entrada.name);
    if (entrada.isDirectory()) return listarArquivos(completo);
    return /\.(ts|tsx)$/.test(entrada.name) ? [completo] : [];
  });
}

const alvos = process.argv.slice(2);
if (alvos.length === 0) {
  console.error("uso: node apps/web/scripts/codemod-imports.ts <arquivo|pasta>...");
  process.exit(1);
}

let alterados = 0;
for (const arquivo of alvos.flatMap(listarArquivos)) {
  const original = readFileSync(arquivo, "utf8");
  const novo = transformarImports(original);
  if (novo !== original) {
    writeFileSync(arquivo, novo);
    alterados += 1;
    console.log(`alterado: ${arquivo}`);
  }
}
console.log(`${alterados} arquivo(s) alterado(s).`);
