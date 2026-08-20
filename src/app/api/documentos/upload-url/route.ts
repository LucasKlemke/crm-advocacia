import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { documentoService } from "@/services/documento.service";

const uploadUrlSchema = z.object({
  escopo: z.enum(["cliente", "caso"]),
  escopoId: z.uuid(),
  nomeArquivo: z.string().trim().min(1).max(255),
  tipoArquivo: z.enum(["pdf", "docx", "jpg", "png", "jpeg"]),
  tamanhoKb: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = uploadUrlSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const resultado = await documentoService.gerarUrlUpload(ctx, parsed.data);
    return NextResponse.json(resultado);
  } catch (error) {
    const resposta =
      tratarErroDeContexto(error) ??
      tratarErroDeCliente(error) ??
      tratarErroDeCaso(error) ??
      tratarErroDeDocumento(error);
    if (resposta) return resposta;
    console.error("Erro ao gerar URL de upload de documento", error);
    return NextResponse.json({ error: "Não foi possível iniciar o upload." }, { status: 502 });
  }
}
