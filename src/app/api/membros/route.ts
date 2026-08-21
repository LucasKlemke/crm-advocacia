import { NextResponse } from "next/server";
import {
  getTenantContext,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
} from "@/lib/auth/tenant-context";
import { membroService } from "@/services/membro.service";

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

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const membros = await membroService.listarMembros(ctx);
    return NextResponse.json({ membros });
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    console.error("Erro ao listar membros", error);
    return NextResponse.json({ error: "Não foi possível listar os membros." }, { status: 500 });
  }
}
