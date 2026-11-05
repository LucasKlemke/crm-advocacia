import "reflect-metadata";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { carregarEnvLocal } from "./config/carregar-env";
import { OPCOES_APP, configurarApp } from "./criar-app";

// src/main.ts (tsx) e dist/main.js (build) ficam ambos um nível abaixo de apps/api.
// Lê apps/api/.env.local e apps/api/.env (nada na Vercel). Sem sobrescrever o ambiente.
carregarEnvLocal(resolve(import.meta.dirname, ".."));

const app = configurarApp(await NestFactory.create(AppModule, OPCOES_APP));
// Na Vercel a plataforma define PORT; localmente vale API_PORT (padrão 3001).
const porta = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
await app.listen(porta);
console.log(`[api] ouvindo em http://localhost:${porta}/api`);
