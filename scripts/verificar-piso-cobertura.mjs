// Piso institucional da linha Web Apps (docs/testes/estrategia-tdd.md): 75% de
// linhas no backend e 25% no frontend, medidos por GRUPO. O coverageThreshold do
// Jest mede por arquivo/glob; este script soma os totais de cada grupo.
// Roda depois de `npm run test:coverage --workspaces`.
import { readFileSync } from "node:fs";
import process from "node:process";

const GRUPOS = [
  { nome: "backend", minimo: 75, resumos: ["apps/api", "packages/compartilhado"] },
  { nome: "frontend", minimo: 25, resumos: ["apps/web"] },
];

let falhou = false;
for (const { nome, minimo, resumos } of GRUPOS) {
  let cobertas = 0;
  let total = 0;
  for (const pacote of resumos) {
    const { total: t } = JSON.parse(readFileSync(`${pacote}/coverage/coverage-summary.json`, "utf8"));
    cobertas += t.lines.covered;
    total += t.lines.total;
  }
  const pct = total === 0 ? 0 : (cobertas / total) * 100;
  if (total === 0) {
    falhou = true;
    process.stdout.write(`FALHA ${nome}: nenhuma linha medida — ${resumos.join(" + ")}\n`);
    continue;
  }
  const ok = pct >= minimo;
  falhou ||= !ok;
  process.stdout.write(`${ok ? "OK  " : "FALHA"} ${nome}: ${pct.toFixed(2)}% de linhas (piso ${minimo}%) — ${resumos.join(" + ")}\n`);
}
process.exit(falhou ? 1 : 0);
