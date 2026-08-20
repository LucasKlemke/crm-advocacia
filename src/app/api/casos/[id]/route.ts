import { NextResponse } from "next/server";
import { edicaoCasoSchema } from "@/lib/api/schemas-caso";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { casoService } from "@/services/caso.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const caso = await casoService.obter(ctx, id);
    return NextResponse.json({ caso });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCaso(error);
    if (resposta) return resposta;
    console.error("Erro ao buscar caso", error);
    return NextResponse.json({ error: "Não foi possível buscar o processo." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = edicaoCasoSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const caso = await casoService.atualizar(ctx, id, parsed.data);
    return NextResponse.json({ caso });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCaso(error);
    if (resposta) return resposta;
    console.error("Erro ao atualizar caso", error);
    return NextResponse.json({ error: "Não foi possível atualizar o processo." }, { status: 500 });
  }
}

// Não é uma exclusão de fato: um caso nunca é apagado, só arquivado (RN08/RN09) —
// DELETE aqui é só a semântica REST esperada pelo client para "remover da visão ativa".
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const caso = await casoService.arquivar(ctx, id);
    return NextResponse.json({ caso });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCaso(error);
    if (resposta) return resposta;
    console.error("Erro ao arquivar caso", error);
    return NextResponse.json({ error: "Não foi possível arquivar o processo." }, { status: 500 });
  }
}
