import { Body, Controller, HttpCode, Post } from "@nestjs/common";

// Endpoint PÚBLICO (sem TenantGuard — a UAZAPI não carrega sessão nossa), por ora só
// para observar os eventos reais antes de decidir o que persistir e como correlacionar
// com instancia_whatsapp. Sempre responde 200 para a UAZAPI não desativar o webhook,
// mesmo com corpo vazio ou não-JSON. O corpo chega como string bruta: configurarApp
// monta um text parser neste caminho antes do parser JSON global (ver criar-app.ts).
@Controller("webhooks/uazapi")
export class UazapiWebhookController {
  @Post()
  @HttpCode(200)
  receber(@Body() corpo: unknown) {
    const bruto = typeof corpo === "string" ? corpo : "";
    let payload: unknown = bruto;
    try {
      payload = bruto ? JSON.parse(bruto) : null;
    } catch {
      // corpo não-JSON: loga como texto bruto mesmo assim
    }

    console.log("[webhook uazapi]", payload);

    return { ok: true };
  }
}
