import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeCampanha } from "@/lib/api/erros-campanha";
import { acaoCampanhaSchema } from "@/lib/api/schemas-campanha";
import { campanhaService } from "@/services/campanha.service";

// Pausar/retomar/excluir o envio (POST /sender/edit na UAZAPI). Com acao="delete" a
// campanha deixa de existir localmente e a resposta traz `campanha: null`.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = acaoCampanhaSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const campanha = await campanhaService.controlar(ctx, id, parsed.data.acao);
    return NextResponse.json({ campanha });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCampanha(error);
    if (resposta) return resposta;
    console.error("Erro ao controlar campanha", error);
    return NextResponse.json({ error: "Não foi possível controlar a campanha." }, { status: 500 });
  }
}
