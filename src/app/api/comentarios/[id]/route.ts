import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeComentario } from "@/lib/api/erros-comentario";
import { comentarioService } from "@/services/comentario.service";

const edicaoComentarioSchema = z.object({
  conteudo: z.string().trim().min(1, "Escreva algo antes de salvar.").max(5000),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = edicaoComentarioSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const comentario = await comentarioService.atualizar(ctx, id, parsed.data.conteudo);
    return NextResponse.json({ comentario });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeComentario(error);
    if (resposta) return resposta;
    console.error("Erro ao editar comentário", error);
    return NextResponse.json({ error: "Não foi possível editar o comentário." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    await comentarioService.excluir(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeComentario(error);
    if (resposta) return resposta;
    console.error("Erro ao excluir comentário", error);
    return NextResponse.json({ error: "Não foi possível excluir o comentário." }, { status: 500 });
  }
}
