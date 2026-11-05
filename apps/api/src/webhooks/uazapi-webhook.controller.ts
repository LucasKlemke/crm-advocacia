import { Body, Controller, HttpCode, Post } from "@nestjs/common";

// Campo que identifica o evento no payload da UAZAPI (EventType ou event); sem ele, o
// typeof do que chegou ("string" para corpo não-JSON, "null" para corpo vazio).
function tipoDoEvento(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const { EventType, event } = payload as { EventType?: unknown; event?: unknown };
    for (const candidato of [EventType, event]) {
      if (typeof candidato === "string") return candidato;
    }
  }
  return payload === null ? "null" : typeof payload;
}

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
      // corpo não-JSON: segue só com o tamanho e o tipo "string"
    }

    // O payload traz telefone e texto de mensagem (LGPD): só metadados vão para o log.
    console.log("[webhook uazapi]", { tipo: tipoDoEvento(payload), bytes: Buffer.byteLength(bruto) });

    return { ok: true };
  }
}
