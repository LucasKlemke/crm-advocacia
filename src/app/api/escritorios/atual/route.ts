import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getTenantContext,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
} from "@/lib/auth/tenant-context";
import {
  escritorioService,
  EscritorioNaoEncontradoError,
  PermissaoNegadaError,
} from "@/services/escritorio.service";

const atualizarEscritorioSchema = z.object({
  nome: z.string().min(1).optional(),
  oabResponsavel: z.string().optional(),
  telefoneWhatsapp: z.string().optional(),
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

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const escritorio = await escritorioService.obterEscritorioAtivo(ctx);
    return NextResponse.json({ escritorio });
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    if (error instanceof EscritorioNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Erro ao obter escritório ativo", error);
    return NextResponse.json({ error: "Não foi possível carregar o escritório." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getTenantContext();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const parsed = atualizarEscritorioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const escritorio = await escritorioService.atualizarEscritorio(ctx, parsed.data);
    return NextResponse.json({ escritorio });
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    if (error instanceof PermissaoNegadaError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Erro ao atualizar escritório", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar o escritório." },
      { status: 500 }
    );
  }
}
