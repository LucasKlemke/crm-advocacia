import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { tratarErroDeComentario } from "@/lib/api/erros-comentario";
import { comentarioService } from "@/services/comentario.service";
import { usuarioService } from "@/services/usuario.service";

const escopoSchema = z.enum(["cliente", "caso"]);

const novoComentarioSchema = z.object({
  escopo: escopoSchema,
  escopoId: z.uuid(),
  conteudo: z.string().trim().min(1, "Escreva algo antes de comentar.").max(5000),
});

export async function GET(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { searchParams } = new URL(request.url);

    const parsed = z
      .object({ escopo: escopoSchema, escopoId: z.uuid() })
      .safeParse({ escopo: searchParams.get("escopo"), escopoId: searchParams.get("escopoId") });
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const comentarios = await comentarioService.listar(
      ctx,
      parsed.data.escopo,
      parsed.data.escopoId
    );
    const comentariosComAvatar = await Promise.all(
      comentarios.map(async (comentario) => ({
        ...comentario,
        autor: {
          ...comentario.autor,
          avatarUrl: await usuarioService.assinarUrlAvatar(comentario.autor.avatarUrl),
        },
      }))
    );
    return NextResponse.json({ comentarios: comentariosComAvatar });
  } catch (error) {
    const resposta =
      tratarErroDeContexto(error) ??
      tratarErroDeCliente(error) ??
      tratarErroDeCaso(error) ??
      tratarErroDeComentario(error);
    if (resposta) return resposta;
    console.error("Erro ao listar comentários", error);
    return NextResponse.json({ error: "Não foi possível listar os comentários." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = novoComentarioSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const comentario = await comentarioService.criar(
      ctx,
      parsed.data.escopo,
      parsed.data.escopoId,
      parsed.data.conteudo
    );
    return NextResponse.json({ comentario }, { status: 201 });
  } catch (error) {
    const resposta =
      tratarErroDeContexto(error) ??
      tratarErroDeCliente(error) ??
      tratarErroDeCaso(error) ??
      tratarErroDeComentario(error);
    if (resposta) return resposta;
    console.error("Erro ao criar comentário", error);
    return NextResponse.json({ error: "Não foi possível salvar o comentário." }, { status: 500 });
  }
}
