import { NextResponse } from "next/server";
import {
  getTenantContext,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
} from "@/lib/auth/tenant-context";
import {
  conviteService,
  PermissaoNegadaError,
  ConviteNaoEncontradoError,
} from "@/services/convite.service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    await conviteService.cancelar(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof NaoAutenticadoError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof SemEscritorioAtivoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof AcessoNegadoError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ConviteNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PermissaoNegadaError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Erro ao cancelar convite", error);
    return NextResponse.json({ error: "Não foi possível cancelar o convite." }, { status: 500 });
  }
}
