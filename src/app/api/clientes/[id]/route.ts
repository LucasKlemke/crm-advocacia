import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { clienteService } from "@/services/cliente.service";

// Todos os campos opcionais: PATCH parcial. `null` limpa o campo, ausente não mexe.
const edicaoClienteSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo.").max(140).optional(),
  cpf: z.string().trim().min(11).max(14).optional(),
  email: z.email("E-mail inválido.").max(140).or(z.literal("")).nullish(),
  telefone: z.string().trim().max(20).nullish(),
  endereco: z.string().trim().max(255).nullish(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const cliente = await clienteService.obter(ctx, id);
    return NextResponse.json({ cliente });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCliente(error);
    if (resposta) return resposta;
    console.error("Erro ao buscar cliente", error);
    return NextResponse.json({ error: "Não foi possível buscar o cliente." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = edicaoClienteSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const cliente = await clienteService.atualizar(ctx, id, parsed.data);
    return NextResponse.json({ cliente });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCliente(error);
    if (resposta) return resposta;
    console.error("Erro ao atualizar cliente", error);
    return NextResponse.json({ error: "Não foi possível atualizar o cliente." }, { status: 500 });
  }
}
