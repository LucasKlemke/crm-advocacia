import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { clienteRepository } from "@/repositories/cliente.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { statusRepository } from "@/repositories/status.repository";
import { tipoStatusRepository } from "@/repositories/tipo-status.repository";

// Payload único para as opções dos filtros de /casos (dropdowns de cliente,
// responsável, status e tipo) — evita 4 requisições separadas na tela.
export async function GET() {
  try {
    const ctx = await getTenantContext();

    const [clientes, membros, status, tipos] = await Promise.all([
      clienteRepository.listar(ctx.escritorioId),
      membroRepository.listarComUsuarioPorEscritorio(ctx.escritorioId),
      statusRepository.listar(ctx.escritorioId),
      tipoStatusRepository.listar(),
    ]);

    return NextResponse.json({
      clientes: clientes.map((c) => ({ id: c.id, nome: c.nome })),
      membros: membros.map((m) => ({ id: m.id, nome: m.usuario.nome })),
      status: status.map((s) => ({ id: s.id, nome: s.nome, cor: s.cor })),
      tipos: tipos.map((t) => ({ id: t.id, nome: t.nome, chave: t.chave })),
    });
  } catch (error) {
    const resposta = tratarErroDeContexto(error);
    if (resposta) return resposta;
    console.error("Erro ao montar opções de filtro de casos", error);
    return NextResponse.json(
      { error: "Não foi possível carregar as opções de filtro." },
      { status: 500 }
    );
  }
}
