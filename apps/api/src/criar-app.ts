import type { INestApplication } from "@nestjs/common";

// Configuração única usada pelo main.ts e pelos testes — o teste exercita exatamente
// o mesmo prefixo/filtros que a API real.
export function configurarApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  return app;
}
