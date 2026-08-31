import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeInstanciaWhatsapp } from "@/lib/api/erros-instancia-whatsapp";
import { instanciaWhatsappService } from "@/services/instancia-whatsapp.service";

export async function POST() {
  try {
    const ctx = await getTenantContext();

    const instancias = await instanciaWhatsappService.sincronizarTodas(ctx);
    return NextResponse.json({ instancias });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeInstanciaWhatsapp(error);
    if (resposta) return resposta;
    console.error("Erro ao sincronizar instâncias de WhatsApp", error);
    return NextResponse.json(
      { error: "Não foi possível sincronizar as instâncias de WhatsApp." },
      { status: 500 }
    );
  }
}
