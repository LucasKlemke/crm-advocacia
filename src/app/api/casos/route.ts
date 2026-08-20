import { NextResponse } from "next/server";
import { novoCasoSchema, parseFiltrosCasoDaQuery } from "@/lib/api/schemas-caso";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { casoService } from "@/services/caso.service";

const POR_PAGINA = 20;

export async function GET(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { searchParams } = new URL(request.url);
    const pagina = Math.max(1, Number(searchParams.get("pagina") ?? "1") || 1);

    const { casos, total } = await casoService.listar(ctx, {
      ...parseFiltrosCasoDaQuery(searchParams),
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    });

    return NextResponse.json({ casos, total, pagina, porPagina: POR_PAGINA });
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    console.error("Erro ao listar casos", error);
    return NextResponse.json({ error: "Não foi possível listar os processos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = novoCasoSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const caso = await casoService.criar(ctx, parsed.data);
    return NextResponse.json({ caso }, { status: 201 });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCaso(error);
    if (resposta) return resposta;
    console.error("Erro ao criar caso", error);
    return NextResponse.json({ error: "Não foi possível criar o processo." }, { status: 500 });
  }
}
