import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getTenantContext,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
} from "@/lib/auth/tenant-context";
import {
  conviteService,
  PermissaoNegadaError,
  ConviteJaExisteError,
  JaEhMembroError,
} from "@/services/convite.service";

const convidarSchema = z.object({
  email: z.string().email("E-mail inválido"),
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

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const convites = await conviteService.listarPendentes(ctx);
    return NextResponse.json({ convites });
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    if (error instanceof PermissaoNegadaError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Erro ao listar convites", error);
    return NextResponse.json({ error: "Não foi possível listar os convites." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const parsed = convidarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const resultado = await conviteService.convidar(ctx, parsed.data);
    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    if (error instanceof PermissaoNegadaError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ConviteJaExisteError || error instanceof JaEhMembroError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Erro ao criar convite", error);
    return NextResponse.json({ error: "Não foi possível enviar o convite." }, { status: 500 });
  }
}
