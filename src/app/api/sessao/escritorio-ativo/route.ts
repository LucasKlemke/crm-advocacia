import { NextResponse } from "next/server";
import { z } from "zod";
import { unstable_update } from "@/lib/auth/config";
import { lerUsuarioIdDaSessao } from "@/lib/auth/token";
import { membroService, PermissaoNegadaError } from "@/services/membro.service";

const trocarEscritorioSchema = z.object({
  escritorioId: z.string().min(1, "Informe o escritório"),
});

// Só troca a sessão para um escritório onde o usuário é membro — nunca confia no
// escritorioId enviado sem revalidar contra o banco (RN19).
//
// Usa leitura pura do JWT em vez de auth(): auth() sempre reemite um Set-Cookie de
// "rolling refresh" da sessão, que colide com o Set-Cookie emitido por
// unstable_update() logo abaixo — o browser acaba não aplicando a troca de escritório.
// A detecção do cookie `__Secure-` fica centralizada em src/lib/auth/token.ts.
export async function POST(request: Request) {
  const usuarioId = await lerUsuarioIdDaSessao(request);
  if (!usuarioId) {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const parsed = trocarEscritorioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const membro = await membroService.trocarEscritorioAtivo(usuarioId, parsed.data.escritorioId);

    await unstable_update({ user: { escritorioId: membro.escritorioId } });

    return NextResponse.json({ escritorioId: membro.escritorioId, role: membro.role });
  } catch (error) {
    if (error instanceof PermissaoNegadaError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Erro ao trocar escritório ativo", error);
    return NextResponse.json(
      { error: "Não foi possível trocar de escritório." },
      { status: 500 }
    );
  }
}
