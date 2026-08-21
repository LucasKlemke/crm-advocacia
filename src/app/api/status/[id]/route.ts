import { NextResponse } from "next/server";
import { edicaoStatusSchema } from "@/lib/api/schemas-status";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeStatus } from "@/lib/api/erros-status";
import { statusService } from "@/services/status.service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = edicaoStatusSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const status = await statusService.atualizar(ctx, id, parsed.data);
    return NextResponse.json({ status });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeStatus(error);
    if (resposta) return resposta;
    console.error("Erro ao atualizar status", error);
    return NextResponse.json({ error: "Não foi possível atualizar o status." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    await statusService.excluir(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeStatus(error);
    if (resposta) return resposta;
    console.error("Erro ao excluir status", error);
    return NextResponse.json({ error: "Não foi possível excluir o status." }, { status: 500 });
  }
}
