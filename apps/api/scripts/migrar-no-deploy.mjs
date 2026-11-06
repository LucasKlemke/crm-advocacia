// Roda no build da Vercel (npm run vercel-build). Aplica as migrations SÓ em
// produção: um build de preview nunca pode migrar o banco configurado no
// Project (hoje o mesmo de produção). Falha de migration falha o build, então
// a versão nova não é publicada sobre um schema incompatível.
import { spawnSync } from "node:child_process";

const ambiente = process.env.VERCEL_ENV ?? "indefinido";
if (ambiente !== "production") {
  console.log(`[migrations] VERCEL_ENV=${ambiente} — prisma migrate deploy ignorado`);
  process.exit(0);
}

console.log("[migrations] produção — aplicando migrations pendentes");
const resultado = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
process.exit(resultado.status ?? 1);
