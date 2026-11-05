import { Controller, Get } from "@nestjs/common";

// Usado pelo rewrite do Next e pelo deploy para saber se a API está de pé.
@Controller("saude")
export class SaudeController {
  @Get()
  verificar() {
    return { ok: true };
  }
}
