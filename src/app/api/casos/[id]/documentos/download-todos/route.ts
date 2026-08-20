import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { casoService } from "@/services/caso.service";
import { documentoService } from "@/services/documento.service";
import { montarZipDocumentos } from "@/lib/documentos/zip";

// archiver usa streams Node — precisa do runtime Node, não roda no Edge.
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const caso = await casoService.obter(ctx, id);
    const documentos = await documentoService.listarPorEscopo(ctx, "caso", id);
    const zip = montarZipDocumentos(documentos);

    return new NextResponse(Readable.toWeb(zip) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="documentos-caso-${caso.titulo}.zip"`,
      },
    });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCaso(error);
    if (resposta) return resposta;
    console.error("Erro ao montar zip de documentos do caso", error);
    return NextResponse.json({ error: "Não foi possível gerar o arquivo zip." }, { status: 502 });
  }
}
