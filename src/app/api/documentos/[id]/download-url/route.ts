import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { documentoService } from "@/services/documento.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const downloadUrl = await documentoService.gerarUrlDownload(ctx, id);
    return NextResponse.json({ downloadUrl });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeDocumento(error);
    if (resposta) return resposta;
    console.error("Erro ao gerar URL de download de documento", error);
    return NextResponse.json({ error: "Não foi possível gerar o link de download." }, { status: 502 });
  }
}
