import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeInstanciaWhatsapp } from "@/lib/api/erros-instancia-whatsapp";
import { instanciaWhatsappService } from "@/services/instancia-whatsapp.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const instancia = await instanciaWhatsappService.desconectar(ctx, id);
    return NextResponse.json({ instancia });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeInstanciaWhatsapp(error);
    if (resposta) return resposta;
    console.error("Erro ao desconectar instância de WhatsApp", error);
    return NextResponse.json(
      { error: "Não foi possível desconectar a instância de WhatsApp." },
      { status: 500 }
    );
  }
}
