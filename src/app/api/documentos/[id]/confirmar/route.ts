import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { nomeArquivoSchema } from "@/lib/api/schemas-comuns";
import { documentoParaPublico } from "@/lib/documentos/publico";
import { documentoService } from "@/services/documento.service";

// Sem `storageKey`: a key é derivada pela Service a partir do id da URL, nunca enviada
// pelo cliente (senão a linha poderia apontar para um objeto arbitrário do bucket).
const confirmarUploadSchema = z.object({
  escopo: z.enum(["cliente", "caso"]),
  escopoId: z.uuid(),
  nomeArquivo: nomeArquivoSchema,
  tipoArquivo: z.enum(["pdf", "docx", "jpg", "png", "jpeg"]),
  tamanhoKb: z.number().int().positive(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = confirmarUploadSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const documento = await documentoService.confirmarUpload(ctx, id, parsed.data);
    return NextResponse.json({ documento: documentoParaPublico(documento) }, { status: 201 });
  } catch (error) {
    const resposta =
      tratarErroDeContexto(error) ??
      tratarErroDeCliente(error) ??
      tratarErroDeCaso(error) ??
      tratarErroDeDocumento(error);
    if (resposta) return resposta;
    console.error("Erro ao confirmar upload de documento", error);
    return NextResponse.json({ error: "Não foi possível confirmar o upload." }, { status: 500 });
  }
}
