import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { clienteService } from "@/services/cliente.service";

const acaoEmLoteSchema = z.object({
  ids: z.array(z.uuid()).min(1, "Selecione ao menos um cliente.").max(200),
  acao: z.enum(["desativar", "restaurar"]),
});

// Ação em lote da tabela de clientes. O Service descarta ids de outro escritório
// (RN19) e já desativados, devolvendo quantos foram ignorados.
export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = acaoEmLoteSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const { ids, acao } = parsed.data;
    const resultado =
      acao === "desativar"
        ? await clienteService.desativarEmLote(ctx, ids)
        : await clienteService.restaurarEmLote(ctx, ids);

    return NextResponse.json(resultado);
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCliente(error);
    if (resposta) return resposta;
    console.error("Erro na ação em lote de clientes", error);
    return NextResponse.json({ error: "Não foi possível concluir a ação." }, { status: 500 });
  }
}
