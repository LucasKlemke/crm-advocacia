import { NextResponse } from "next/server";
import { edicaoTipoProcessoSchema } from "@/lib/api/schemas-tipo-processo";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeTipoProcesso } from "@/lib/api/erros-tipo-processo";
import { tipoProcessoService } from "@/services/tipo-processo.service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = edicaoTipoProcessoSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const tipo = await tipoProcessoService.atualizar(ctx, id, parsed.data);
    return NextResponse.json({ tipo });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeTipoProcesso(error);
    if (resposta) return resposta;
    console.error("Erro ao atualizar tipo de processo", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar o tipo de processo." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    await tipoProcessoService.excluir(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeTipoProcesso(error);
    if (resposta) return resposta;
    console.error("Erro ao excluir tipo de processo", error);
    return NextResponse.json(
      { error: "Não foi possível excluir o tipo de processo." },
      { status: 500 }
    );
  }
}
