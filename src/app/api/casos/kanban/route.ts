import { NextResponse } from "next/server";
import { parseFiltrosCasoDaQuery } from "@/lib/api/schemas-caso";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { serializarCasos } from "@/lib/api/serializa-caso";
import { casoService } from "@/services/caso.service";

export async function GET(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { searchParams } = new URL(request.url);
    const filtros = parseFiltrosCasoDaQuery(searchParams);

    const colunas = await casoService.listarKanban(ctx, filtros);
    const colunasSerializadas = await Promise.all(
      colunas.map(async (coluna) => ({ ...coluna, casos: await serializarCasos(coluna.casos) }))
    );
    return NextResponse.json({ colunas: colunasSerializadas });
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    console.error("Erro ao montar o kanban de casos", error);
    return NextResponse.json({ error: "Não foi possível montar o kanban." }, { status: 500 });
  }
}
