import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeInstanciaWhatsapp } from "@/lib/api/erros-instancia-whatsapp";
import { instanciaWhatsappService } from "@/services/instancia-whatsapp.service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    await instanciaWhatsappService.excluir(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeInstanciaWhatsapp(error);
    if (resposta) return resposta;
    console.error("Erro ao excluir instância de WhatsApp", error);
    return NextResponse.json(
      { error: "Não foi possível excluir a instância de WhatsApp." },
      { status: 500 }
    );
  }
}
