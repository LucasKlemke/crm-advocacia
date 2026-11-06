import { Body, Controller, HttpCode, Inject, NotFoundException, Param, Post } from "@nestjs/common";
import { assinaturaValida } from "@dominio/lib/auth/assinatura-webhook";
import type { AgendadorSincronizacao } from "../tempo-real/agendador-sincronizacao";
import { AGENDADOR_SINCRONIZACAO } from "../tempo-real/tokens";

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

// Parse tolerante do corpo bruto: o que interessa é só o tipo do evento e o tamanho.
function metadados(corpo: unknown): { tipo: string; bytes: number } {
  const bruto = typeof corpo === "string" ? corpo : "";
  let payload: unknown = bruto;
  try {
    payload = bruto ? JSON.parse(bruto) : null;
  } catch {
    // corpo não-JSON: segue só com o tamanho e o tipo "string"
  }
  return { tipo: tipoDoEvento(payload), bytes: Buffer.byteLength(bruto) };
}

// Endpoints PÚBLICOS (sem TenantGuard — a UAZAPI não carrega sessão nossa). O corpo chega
// como string bruta: configurarApp monta um text parser em /api/webhooks/uazapi (e, por ser
// app.use, em todos os subcaminhos) antes do parser JSON global (ver criar-app.ts). O
// payload traz telefone e texto de mensagem (LGPD): só metadados vão para o log.
@Controller("webhooks/uazapi")
export class UazapiWebhookController {
  constructor(@Inject(AGENDADOR_SINCRONIZACAO) private readonly agendador: AgendadorSincronizacao) {}

  // Rota antiga, mantida para webhooks já configurados na UAZAPI: só observa, sempre 200
  // (para a UAZAPI não desativar o webhook) e nunca dispara trabalho.
  @Post()
  @HttpCode(200)
  receber(@Body() corpo: unknown) {
    console.log("[webhook uazapi]", metadados(corpo));
    return { ok: true };
  }

  // Rota assinada (URL registrada pela API na instância): a assinatura é o HMAC do id da
  // instância com UAZAPI_WEBHOOK_SECRET. Inválida (ou segredo ausente) → 404, como uma rota
  // inexistente, sem log nem trabalho. Válida → só agenda: o webhook é gatilho, a fonte de
  // verdade é a releitura de /sender/listfolders na sincronização, então o payload não é lido.
  @Post(":instanciaId/:assinatura")
  @HttpCode(200)
  receberAssinado(
    @Param("instanciaId") instanciaId: string,
    @Param("assinatura") assinatura: string,
    @Body() corpo: unknown
  ) {
    const segredo = process.env.UAZAPI_WEBHOOK_SECRET;
    if (!segredo || !assinaturaValida(instanciaId, assinatura, segredo)) {
      throw new NotFoundException();
    }

    console.log("[webhook uazapi]", { ...metadados(corpo), instanciaId });
    this.agendador.agendarInstancia(instanciaId);
    return { ok: true };
  }
}
