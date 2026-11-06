import "reflect-metadata";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { carregarEnvLocal } from "./config/carregar-env";
import { OPCOES_APP, configurarApp } from "./criar-app";
import { lerConfigTempoReal } from "./tempo-real/config-tempo-real";
import { anexarServidorWs } from "./tempo-real/servidor-ws";

// src/main.ts (tsx) e dist/main.js (build) ficam ambos um nível abaixo de apps/api.
// Lê apps/api/.env.local e apps/api/.env (nada na Vercel). Sem sobrescrever o ambiente.
carregarEnvLocal(resolve(import.meta.dirname, ".."));

const app = configurarApp(await NestFactory.create(AppModule, OPCOES_APP));
// Na Vercel a plataforma define PORT; localmente vale API_PORT (padrão 3001).
const porta = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);

// WebSocket /api/ws no mesmo http.Server (ECS). Desligado onde não há processo vivo
// (Vercel Functions: TEMPO_REAL_HABILITADO=false).
const tempoReal = lerConfigTempoReal();
if (tempoReal.habilitado) {
  const servidorWs = anexarServidorWs(app.getHttpServer(), { origensWeb: tempoReal.origensWeb });
  // Os sockets abertos segurariam o fechamento do http.Server no app.close() disparado
  // pelos shutdown hooks do Nest: encerra o WS no mesmo sinal. `once`: o Nest reenvia o
  // sinal ao fim do close e, sem ouvintes, o processo sai.
  for (const sinal of ["SIGTERM", "SIGINT"] as const) {
    process.once(sinal, () => {
      servidorWs.fechar().catch((erro) => console.error("[tempo-real] falha ao fechar o WebSocket", erro));
    });
  }
}

await app.listen(porta);
console.log(`[api] ouvindo em http://localhost:${porta}/api`);
