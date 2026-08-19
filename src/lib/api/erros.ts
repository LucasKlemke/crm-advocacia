import { NextResponse } from "next/server";
import {
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
} from "@/lib/auth/tenant-context";
import type { ZodError } from "zod";

// Os erros de tenant têm sempre o mesmo mapeamento HTTP em toda rota protegida —
// centralizado aqui para que uma rota nova não invente um código diferente por descuido.
export function tratarErroDeContexto(error: unknown) {
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

export function respostaDadosInvalidos(error?: ZodError) {
  return NextResponse.json(
    {
      error: "Dados inválidos",
      ...(error ? { detalhes: error.flatten().fieldErrors } : {}),
    },
    { status: 400 }
  );
}

// Body malformado é erro do cliente, não 500: devolve null para a rota responder 400.
export async function lerJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
