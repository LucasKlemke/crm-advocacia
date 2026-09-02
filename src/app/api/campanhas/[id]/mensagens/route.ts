import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeCampanha } from "@/lib/api/erros-campanha";
import { campanhaService } from "@/services/campanha.service";
import { paginaCampanhaSchema } from "@/lib/api/schemas-campanha";

// Status mensagem a mensagem, consultado ao vivo na UAZAPI — o banco guarda o que foi
// enviado, não o que aconteceu depois com cada mensagem.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;
    // Mesma página da tabela de destinatários: o service devolve só o status dos números
    // dessa página, em vez de mandar a campanha inteira para o browser.
    const pagina = paginaCampanhaSchema.parse(
      new URL(request.url).searchParams.get("pagina") ?? 1
    );

    const { mensagens, total, truncado } = await campanhaService.listarMensagens(ctx, id, {
      pagina,
    });
    return NextResponse.json({ mensagens, total, truncado });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCampanha(error);
    if (resposta) return resposta;
    console.error("Erro ao listar mensagens da campanha", error);
    return NextResponse.json(
      { error: "Não foi possível consultar o status das mensagens." },
      { status: 500 }
    );
  }
}
