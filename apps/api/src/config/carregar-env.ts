import { resolve } from "node:path";
import { config } from "dotenv";

// Dev e `npm start` local leem apps/api/.env.local e apps/api/.env. Na Vercel as
// variáveis vêm do Project e não existe arquivo .env no bundle, então não há
// nada a carregar.
export function carregarEnvLocal(diretorioDaApi: string): void {
  if (process.env.VERCEL) return;
  config({
    path: [resolve(diretorioDaApi, ".env.local"), resolve(diretorioDaApi, ".env")],
    quiet: true,
  });
}
