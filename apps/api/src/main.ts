import "reflect-metadata";
import { resolve } from "node:path";
import { config } from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { OPCOES_APP, configurarApp } from "./criar-app";

// Mesmo .env do Next: DATABASE_URL e AUTH_SECRET precisam ser idênticos, senão a API e o
// proxy.ts do Next não conseguem verificar o cookie crm_sessao um do outro.
const raiz = resolve(import.meta.dirname, "../../..");
config({ path: [resolve(raiz, ".env.local"), resolve(raiz, ".env")], quiet: true });

const app = configurarApp(await NestFactory.create(AppModule, OPCOES_APP));
const porta = Number(process.env.API_PORT ?? 3001);
await app.listen(porta);
console.log(`[api] ouvindo em http://localhost:${porta}/api`);
