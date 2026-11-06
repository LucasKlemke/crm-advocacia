import { createHmac, timingSafeEqual } from "node:crypto";

// O webhook da UAZAPI não manda cabeçalho de autenticação que a gente controle, então o segredo vai na própria URL: a assinatura é um HMAC do id da instância, o que impede forjar a URL de outra instância sem conhecer UAZAPI_WEBHOOK_SECRET.
export function assinarInstancia(instanciaId: string, segredo: string): string {
  return createHmac("sha256", segredo).update(instanciaId).digest("base64url");
}

// timingSafeEqual lança se os buffers têm tamanhos diferentes; checamos antes para responder false (assinatura truncada/vazia) em vez de estourar, e para não vazar o resultado por tempo de comparação.
export function assinaturaValida(
  instanciaId: string,
  assinatura: string,
  segredo: string
): boolean {
  const esperada = Buffer.from(assinarInstancia(instanciaId, segredo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length) {
    return false;
  }
  return timingSafeEqual(esperada, recebida);
}

// Sem URL pública ou sem segredo não há como registrar um webhook seguro: devolve null e o chamador simplesmente não registra (cai no polling).
export function urlWebhookDaInstancia(
  instanciaId: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const base = env.API_PUBLIC_URL?.replace(/\/+$/, "");
  const segredo = env.UAZAPI_WEBHOOK_SECRET;
  if (!base || !segredo) {
    return null;
  }
  return `${base}/api/webhooks/uazapi/${instanciaId}/${assinarInstancia(instanciaId, segredo)}`;
}
