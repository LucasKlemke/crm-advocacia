import { NextResponse } from "next/server";
import { novoStatusSchema } from "@/lib/api/schemas-status";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeStatus } from "@/lib/api/erros-status";
import { statusService } from "@/services/status.service";

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const status = await statusService.listar(ctx);
    return NextResponse.json({ status });
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    console.error("Erro ao listar status", error);
    return NextResponse.json({ error: "Não foi possível listar os status." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = novoStatusSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const status = await statusService.criar(ctx, parsed.data);
    return NextResponse.json({ status }, { status: 201 });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeStatus(error);
    if (resposta) return resposta;
    console.error("Erro ao criar status", error);
    return NextResponse.json({ error: "Não foi possível criar o status." }, { status: 500 });
  }
}
