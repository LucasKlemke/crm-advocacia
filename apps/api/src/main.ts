import "reflect-metadata";
import { resolve } from "node:path";
import { config } from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configurarApp } from "./criar-app";

// Mesmo .env do Next: DATABASE_URL e AUTH_SECRET/NEXTAUTH_SECRET precisam ser
// idênticos, senão o guard não consegue abrir o cookie de sessão.
const raiz = resolve(import.meta.dirname, "../../..");
config({ path: [resolve(raiz, ".env.local"), resolve(raiz, ".env")], quiet: true });

const app = configurarApp(await NestFactory.create(AppModule));
const porta = Number(process.env.API_PORT ?? 3001);
await app.listen(porta);
console.log(`[api] ouvindo em http://localhost:${porta}/api`);
