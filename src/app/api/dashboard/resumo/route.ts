import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { parseFiltrosCasoDaQuery } from "@/lib/api/schemas-caso";
import { dashboardService } from "@/services/dashboard.service";

export async function GET(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { searchParams } = new URL(request.url);
    // Mesmo filtro do header de /casos aplicado a todo o resumo — só o subconjunto
    // cliente/responsável/período faz sentido fora da tabela.
    const { clienteIds, responsavelIds, dataInicio, dataFim } = parseFiltrosCasoDaQuery(searchParams);
    const resumo = await dashboardService.resumo(ctx, {
      clienteIds,
      responsavelIds,
      dataInicio,
      dataFim,
    });
    return NextResponse.json(resumo);
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    console.error("Erro ao montar o resumo do dashboard", error);
    return NextResponse.json({ error: "Não foi possível montar o resumo." }, { status: 500 });
  }
}
