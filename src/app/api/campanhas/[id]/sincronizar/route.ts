import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeCampanha } from "@/lib/api/erros-campanha";
import { campanhaService } from "@/services/campanha.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const campanha = await campanhaService.sincronizar(ctx, id);
    return NextResponse.json({ campanha });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCampanha(error);
    if (resposta) return resposta;
    console.error("Erro ao sincronizar campanha", error);
    return NextResponse.json(
      { error: "Não foi possível sincronizar a campanha." },
      { status: 500 }
    );
  }
}
