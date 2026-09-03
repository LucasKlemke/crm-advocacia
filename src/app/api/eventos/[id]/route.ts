import { NextResponse } from "next/server";
import { edicaoEventoSchema } from "@/lib/api/schemas-evento";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeEvento } from "@/lib/api/erros-evento";
import { serializarEvento } from "@/lib/api/serializa-evento";
import { eventoService } from "@/services/evento.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const evento = await eventoService.obter(ctx, id);
    const membro = await eventoService.membroAtual(ctx);

    return NextResponse.json({
      evento: await serializarEvento(evento, (e) => eventoService.podeEditar(ctx, membro.id, e)),
    });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeEvento(error);
    if (resposta) return resposta;
    console.error("Erro ao obter evento", error);
    return NextResponse.json({ error: "Não foi possível carregar o evento." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = edicaoEventoSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    await eventoService.atualizar(ctx, id, parsed.data);
    const evento = await eventoService.obter(ctx, id);
    const membro = await eventoService.membroAtual(ctx);

    return NextResponse.json({
      evento: await serializarEvento(evento, (e) => eventoService.podeEditar(ctx, membro.id, e)),
    });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeEvento(error);
    if (resposta) return resposta;
    console.error("Erro ao atualizar evento", error);
    return NextResponse.json({ error: "Não foi possível atualizar o evento." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    await eventoService.excluir(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeEvento(error);
    if (resposta) return resposta;
    console.error("Erro ao excluir evento", error);
    return NextResponse.json({ error: "Não foi possível excluir o evento." }, { status: 500 });
  }
}
