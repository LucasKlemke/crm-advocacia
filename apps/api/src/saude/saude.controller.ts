import { Controller, Get } from "@nestjs/common";

// Usado pelo deploy e pelo health check do proxy para saber se a API está de pé.
@Controller("saude")
export class SaudeController {
  @Get()
  verificar() {
    return { ok: true };
  }
}
