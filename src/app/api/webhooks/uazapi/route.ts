import { NextResponse } from "next/server";

// Endpoint público (sem Tenant Context — a UAZAPI não carrega sessão nossa) só para
// observar os eventos reais que a UAZAPI envia antes de decidir o que persistir e como
// correlacionar com instancia_whatsapp. Sempre responde 200 pra UAZAPI não desativar o
// webhook por falha, mesmo com corpo vazio ou não-JSON.
export async function POST(request: Request) {
  const bruto = await request.text();
  let corpo: unknown = bruto;
  try {
    corpo = bruto ? JSON.parse(bruto) : null;
  } catch {
    // corpo não-JSON: loga como texto bruto mesmo assim
  }

  console.log("[webhook uazapi]", corpo);

  return NextResponse.json({ ok: true });
}
