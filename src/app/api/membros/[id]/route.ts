import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getTenantContext,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
} from "@/lib/auth/tenant-context";
import {
  membroService,
  PermissaoNegadaError,
  MembroNaoEncontradoError,
  UltimoOwnerError,
} from "@/services/membro.service";

const alterarRoleSchema = z.object({
  role: z.enum(["owner", "admin", "padrao"]),
});

function tratarErroDeContexto(error: unknown) {
  if (error instanceof NaoAutenticadoError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof SemEscritorioAtivoError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof AcessoNegadoError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return null;
}

function tratarErroDeMembro(error: unknown) {
  if (error instanceof MembroNaoEncontradoError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoNegadaError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof UltimoOwnerError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const parsed = alterarRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const membro = await membroService.alterarRole(ctx, id, parsed.data.role);
    return NextResponse.json({ membro });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeMembro(error);
    if (resposta) return resposta;
    console.error("Erro ao alterar role do membro", error);
    return NextResponse.json({ error: "Não foi possível alterar o membro." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    await membroService.remover(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeMembro(error);
    if (resposta) return resposta;
    console.error("Erro ao remover membro", error);
    return NextResponse.json({ error: "Não foi possível remover o membro." }, { status: 500 });
  }
}
