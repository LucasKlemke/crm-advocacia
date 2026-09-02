import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeCampanha } from "@/lib/api/erros-campanha";
import { campanhaService } from "@/services/campanha.service";

// Status mensagem a mensagem, consultado ao vivo na UAZAPI — o banco guarda o que foi
// enviado, não o que aconteceu depois com cada mensagem.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const { mensagens, total } = await campanhaService.listarMensagens(ctx, id);
    return NextResponse.json({ mensagens, total });
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
