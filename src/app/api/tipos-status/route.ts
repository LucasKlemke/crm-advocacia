import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tipoStatusService } from "@/services/tipo-status.service";

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const tipos = await tipoStatusService.listar(ctx);
    return NextResponse.json({ tipos });
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    console.error("Erro ao listar tipos de status", error);
    return NextResponse.json(
      { error: "Não foi possível listar os tipos de status." },
      { status: 500 }
    );
  }
}
