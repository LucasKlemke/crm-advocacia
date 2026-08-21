import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { clienteService } from "@/services/cliente.service";
import { documentoService } from "@/services/documento.service";
import { montarZipDocumentos } from "@/lib/documentos/zip";

// archiver usa streams Node — precisa do runtime Node, não roda no Edge.
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const cliente = await clienteService.obter(ctx, id);
    const documentos = await documentoService.listarPorEscopo(ctx, "cliente", id);
    const zip = montarZipDocumentos(documentos);
    // A resposta já saiu com 200 quando o stream começa: erro daqui pra frente (interno do
    // archiver) não tem mais como virar status HTTP — pelo menos fica no log do servidor.
    zip.on("error", (err) => console.error("Erro ao montar zip de documentos", err));

    return new NextResponse(Readable.toWeb(zip) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="documentos-cliente-${cliente.nome}.zip"`,
      },
    });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCliente(error);
    if (resposta) return resposta;
    console.error("Erro ao montar zip de documentos do cliente", error);
    return NextResponse.json({ error: "Não foi possível gerar o arquivo zip." }, { status: 502 });
  }
}
