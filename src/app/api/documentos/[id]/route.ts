import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { documentoService } from "@/services/documento.service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    await documentoService.excluir(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeDocumento(error);
    if (resposta) return resposta;
    console.error("Erro ao excluir documento", error);
    return NextResponse.json({ error: "Não foi possível excluir o documento." }, { status: 500 });
  }
}
