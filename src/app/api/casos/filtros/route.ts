import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { montarOpcoesFiltroCaso } from "@/lib/api/payloads/casos-filtros";

export async function GET() {
  try {
    const ctx = await getTenantContext();
    return NextResponse.json(await montarOpcoesFiltroCaso(ctx));
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    console.error("Erro ao montar opções de filtro de casos", error);
    return NextResponse.json(
      { error: "Não foi possível carregar as opções de filtro." },
      { status: 500 }
    );
  }
}
