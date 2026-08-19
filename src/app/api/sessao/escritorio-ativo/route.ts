import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, unstable_update } from "@/lib/auth/config";
import { membroService, PermissaoNegadaError } from "@/services/membro.service";

const trocarEscritorioSchema = z.object({
  escritorioId: z.string().min(1, "Informe o escritório"),
});

// Só troca a sessão para um escritório onde o usuário é membro — nunca confia no
// escritorioId enviado sem revalidar contra o banco (RN19).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
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
    const membro = await membroService.trocarEscritorioAtivo(
      session.user.id,
      parsed.data.escritorioId
    );

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
