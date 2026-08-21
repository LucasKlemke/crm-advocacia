import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { nomeArquivoSchema } from "@/lib/api/schemas-comuns";
import { documentoParaPublico } from "@/lib/documentos/publico";
import { documentoService } from "@/services/documento.service";

const renomearSchema = z.object({
  nomeArquivo: nomeArquivoSchema,
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = renomearSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const documento = await documentoService.renomear(ctx, id, parsed.data.nomeArquivo);
    return NextResponse.json({ documento: documentoParaPublico(documento) });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeDocumento(error);
    if (resposta) return resposta;
    console.error("Erro ao renomear documento", error);
    return NextResponse.json({ error: "Não foi possível renomear o documento." }, { status: 500 });
  }
}

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
