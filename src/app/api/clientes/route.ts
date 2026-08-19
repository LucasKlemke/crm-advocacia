import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { clienteService } from "@/services/cliente.service";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";

const POR_PAGINA = 20;

const novoClienteSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo.").max(140),
  cpf: z.string().trim().min(11).max(14),
  email: z.email("E-mail inválido.").max(140).or(z.literal("")).nullish(),
  telefone: z.string().trim().max(20).nullish(),
  endereco: z.string().trim().max(255).nullish(),
});

export async function GET(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { searchParams } = new URL(request.url);
    const pagina = Math.max(1, Number(searchParams.get("pagina") ?? "1") || 1);

    const { clientes, total } = await clienteService.listar(ctx, {
      busca: searchParams.get("busca") ?? undefined,
      incluirExcluidos: searchParams.get("incluirExcluidos") === "true",
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    });

    return NextResponse.json({ clientes, total, pagina, porPagina: POR_PAGINA });
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    console.error("Erro ao listar clientes", error);
    return NextResponse.json({ error: "Não foi possível listar os clientes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = novoClienteSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const cliente = await clienteService.criar(ctx, parsed.data);
    return NextResponse.json({ cliente }, { status: 201 });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCliente(error);
    if (resposta) return resposta;
    console.error("Erro ao criar cliente", error);
    return NextResponse.json({ error: "Não foi possível criar o cliente." }, { status: 500 });
  }
}
