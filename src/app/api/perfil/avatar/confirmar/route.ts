import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { usuarioService } from "@/services/usuario.service";

const confirmarAvatarSchema = z.object({
  storageKey: z.string().min(1).max(500),
});

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

  const parsed = confirmarAvatarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const usuario = await usuarioService.confirmarUploadAvatar(session.user.id, parsed.data.storageKey);
    return NextResponse.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        avatarUrl: usuario.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Erro ao confirmar upload de avatar", error);
    return NextResponse.json({ error: "Não foi possível confirmar o avatar." }, { status: 500 });
  }
}
