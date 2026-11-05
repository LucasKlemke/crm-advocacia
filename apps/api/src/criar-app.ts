import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { text } from "express";
import { ErrosHttpFilter } from "./comum/erros-http.filter";

// POST /api/campanhas manda o CSV inteiro como JSON (até MAX_DESTINATARIOS linhas, ver
// schemas-campanha.ts) — passa fácil dos 100 KB padrão do Express. O Route Handler do
// Next não tinha limite próprio (o teto era o de 4,5 MB do Vercel); 10 MB garante que
// a API nunca seja o gargalo. O limite de negócio continua sendo o do schema.
export const LIMITE_CORPO_JSON = "10mb";

// O webhook da UAZAPI precisa responder 2xx sempre. O parser JSON global transformaria
// JSON malformado em 400 antes do roteamento (filtros de controller não alcançam erro de
// middleware), então este caminho lê o corpo como texto, de qualquer content-type, e o
// controller faz o parse tolerante. Caminho absoluto: app.use não aplica o prefixo global.
export const CAMINHO_WEBHOOK_UAZAPI = "/api/webhooks/uazapi";
export const LIMITE_CORPO_WEBHOOK = "10mb";

// Opções de criação da app, compartilhadas por main.ts e testes. O body parser padrão do
// Nest registra também o urlencoded, o único tipo (além de multipart/text) que um <form>
// cross-site consegue enviar: com ele, POST /api/auth/login viraria CSRF de login (a
// vítima ficaria logada na conta do atacante). Só registramos o que a API usa (ver abaixo).
export const OPCOES_APP = { bodyParser: false } as const;

// Configuração única usada pelo main.ts e pelos testes — o teste exercita exatamente
// o mesmo prefixo/filtros/parsers que a API real.
export function configurarApp(app: INestApplication): INestApplication {
  // A ordem importa: o text parser do webhook consome o stream primeiro, e o parser JSON
  // seguinte vê a requisição já lida e não faz nada.
  (app as NestExpressApplication).use(CAMINHO_WEBHOOK_UAZAPI, text({ type: () => true, limit: LIMITE_CORPO_WEBHOOK }));
  // Registrado antes do init: o Nest não adiciona o parser JSON padrão quando já existe um.
  (app as NestExpressApplication).useBodyParser("json", { limit: LIMITE_CORPO_JSON });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ErrosHttpFilter());
  app.enableShutdownHooks();
  return app;
}
