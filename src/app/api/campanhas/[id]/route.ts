import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeCampanha } from "@/lib/api/erros-campanha";
import { paginaCampanhaSchema } from "@/lib/api/schemas-campanha";
import { campanhaService } from "@/services/campanha.service";

// Devolve a campanha junto da página de itens pedida (?pagina=N): a tela de detalhe
// precisa das duas coisas, e separar em duas rotas dobraria a checagem de tenant.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;
    const pagina = paginaCampanhaSchema.parse(
      new URL(request.url).searchParams.get("pagina") ?? 1
    );

    const campanha = await campanhaService.obter(ctx, id);
    const itens = await campanhaService.listarItens(ctx, id, { pagina });

    return NextResponse.json({ campanha, ...itens });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCampanha(error);
    if (resposta) return resposta;
    console.error("Erro ao obter campanha", error);
    return NextResponse.json({ error: "Não foi possível carregar a campanha." }, { status: 500 });
  }
}
