import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos } from "@/lib/api/erros";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { documentoParaPublico } from "@/lib/documentos/publico";
import { documentoService } from "@/services/documento.service";

const escopoSchema = z.object({
  escopo: z.enum(["cliente", "caso"]),
  escopoId: z.uuid(),
});

export async function GET(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { searchParams } = new URL(request.url);

    const parsed = escopoSchema.safeParse({
      escopo: searchParams.get("escopo"),
      escopoId: searchParams.get("escopoId"),
    });
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const documentos = await documentoService.listarPorEscopo(
      ctx,
      parsed.data.escopo,
      parsed.data.escopoId
    );
    return NextResponse.json({ documentos: documentos.map(documentoParaPublico) });
  } catch (error) {
    const resposta =
      tratarErroDeContexto(error) ??
      tratarErroDeCliente(error) ??
      tratarErroDeCaso(error) ??
      tratarErroDeDocumento(error);
    if (resposta) return resposta;
    console.error("Erro ao listar documentos", error);
    return NextResponse.json({ error: "Não foi possível listar os documentos." }, { status: 500 });
  }
}
