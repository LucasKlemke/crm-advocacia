import { NextResponse } from "next/server";
import { novoEventoSchema, parseFiltrosEventosDaQuery } from "@/lib/api/schemas-evento";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeEvento } from "@/lib/api/erros-evento";
import { serializarEvento, serializarEventos } from "@/lib/api/serializa-evento";
import { eventoService } from "@/services/evento.service";

export async function GET(request: Request) {
  try {
    const ctx = await getTenantContext();

    const { searchParams } = new URL(request.url);
    const filtros = parseFiltrosEventosDaQuery(searchParams);
    if (!filtros.success) return respostaDadosInvalidos(filtros.error);

    const membro = await eventoService.membroAtual(ctx);
    const eventos = await eventoService.listarNoPeriodo(ctx, {
      inicio: new Date(filtros.data.inicio),
      fim: new Date(filtros.data.fim),
    });

    return NextResponse.json({
      eventos: await serializarEventos(eventos, (evento) =>
        eventoService.podeEditar(ctx, membro.id, evento)
      ),
    });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeEvento(error);
    if (resposta) return resposta;
    console.error("Erro ao listar eventos", error);
    return NextResponse.json({ error: "Não foi possível listar os eventos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = novoEventoSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const criado = await eventoService.criar(ctx, parsed.data);
    // Recarrega com as relações: o cliente precisa do criador e dos participantes
    // hidratados para desenhar o evento sem uma segunda chamada.
    const evento = await eventoService.obter(ctx, criado.id);
    const membro = await eventoService.membroAtual(ctx);

    return NextResponse.json(
      {
        evento: await serializarEvento(evento, (e) =>
          eventoService.podeEditar(ctx, membro.id, e)
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeEvento(error);
    if (resposta) return resposta;
    console.error("Erro ao criar evento", error);
    return NextResponse.json({ error: "Não foi possível criar o evento." }, { status: 500 });
  }
}
