import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos } from "@/lib/api/erros";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { documentoService } from "@/services/documento.service";

const modoSchema = z.object({ modo: z.enum(["anexo", "inline"]).optional() });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const parsed = modoSchema.safeParse({ modo: searchParams.get("modo") ?? undefined });
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const downloadUrl = await documentoService.gerarUrlDownload(ctx, id, parsed.data.modo === "inline");
    return NextResponse.json({ downloadUrl });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeDocumento(error);
    if (resposta) return resposta;
    console.error("Erro ao gerar URL de download de documento", error);
    return NextResponse.json({ error: "Não foi possível gerar o link de download." }, { status: 502 });
  }
}
