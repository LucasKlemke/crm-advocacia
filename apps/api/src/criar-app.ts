import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ErrosHttpFilter } from "./comum/erros-http.filter";

// POST /api/campanhas manda o CSV inteiro como JSON (até MAX_DESTINATARIOS linhas, ver
// schemas-campanha.ts) — passa fácil dos 100 KB padrão do Express. O Route Handler do
// Next não tinha limite próprio (o teto era o de 4,5 MB do Vercel); 10 MB garante que
// a API nunca seja o gargalo. O limite de negócio continua sendo o do schema.
export const LIMITE_CORPO_JSON = "10mb";

// Configuração única usada pelo main.ts e pelos testes — o teste exercita exatamente
// o mesmo prefixo/filtros/parsers que a API real.
export function configurarApp(app: INestApplication): INestApplication {
  // Registrado antes do init: o Nest não adiciona o parser JSON padrão quando já existe um.
  (app as NestExpressApplication).useBodyParser("json", { limit: LIMITE_CORPO_JSON });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ErrosHttpFilter());
  app.enableShutdownHooks();
  return app;
}
