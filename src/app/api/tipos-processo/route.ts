import { NextResponse } from "next/server";
import { novoTipoProcessoSchema } from "@/lib/api/schemas-tipo-processo";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeTipoProcesso } from "@/lib/api/erros-tipo-processo";
import { tipoProcessoService } from "@/services/tipo-processo.service";

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const tipos = await tipoProcessoService.listar(ctx);
    return NextResponse.json({ tipos });
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    console.error("Erro ao listar tipos de processo", error);
    return NextResponse.json(
      { error: "Não foi possível listar os tipos de processo." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = novoTipoProcessoSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const tipo = await tipoProcessoService.criar(ctx, parsed.data);
    return NextResponse.json({ tipo }, { status: 201 });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeTipoProcesso(error);
    if (resposta) return resposta;
    console.error("Erro ao criar tipo de processo", error);
    return NextResponse.json(
      { error: "Não foi possível criar o tipo de processo." },
      { status: 500 }
    );
  }
}
