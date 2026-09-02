import { NextResponse } from "next/server";
import { novaCampanhaSchema } from "@/lib/api/schemas-campanha";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeCampanha } from "@/lib/api/erros-campanha";
import { campanhaService } from "@/services/campanha.service";

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const campanhas = await campanhaService.listar(ctx);
    return NextResponse.json({ campanhas });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCampanha(error);
    if (resposta) return resposta;
    console.error("Erro ao listar campanhas", error);
    return NextResponse.json({ error: "Não foi possível listar as campanhas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = novaCampanhaSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const { agendadaPara, ...resto } = parsed.data;
    const campanha = await campanhaService.criar(ctx, {
      ...resto,
      ...(agendadaPara ? { agendadaPara: new Date(agendadaPara) } : {}),
    });

    return NextResponse.json({ campanha }, { status: 201 });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCampanha(error);
    if (resposta) return resposta;
    console.error("Erro ao criar campanha", error);
    return NextResponse.json({ error: "Não foi possível criar a campanha." }, { status: 500 });
  }
}
