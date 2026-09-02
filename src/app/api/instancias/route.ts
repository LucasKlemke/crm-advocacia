import { NextResponse } from "next/server";
import { novaInstanciaWhatsappSchema } from "@/lib/api/schemas-instancia-whatsapp";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeInstanciaWhatsapp } from "@/lib/api/erros-instancia-whatsapp";
import { instanciaWhatsappService } from "@/services/instancia-whatsapp.service";

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const instancias = await instanciaWhatsappService.listar(ctx);
    return NextResponse.json({ instancias });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeInstanciaWhatsapp(error);
    if (resposta) return resposta;
    console.error("Erro ao listar instâncias de WhatsApp", error);
    return NextResponse.json(
      { error: "Não foi possível listar as instâncias de WhatsApp." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = novaInstanciaWhatsappSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const { instancia, qrcode, paircode } = await instanciaWhatsappService.criarEConectar(
      ctx,
      parsed.data
    );
    return NextResponse.json({ instancia, qrcode, paircode }, { status: 201 });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeInstanciaWhatsapp(error);
    if (resposta) return resposta;
    console.error("Erro ao criar instância de WhatsApp", error);
    return NextResponse.json(
      { error: "Não foi possível criar a instância de WhatsApp." },
      { status: 500 }
    );
  }
}
