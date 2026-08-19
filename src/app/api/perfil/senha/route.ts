import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { usuarioService, SenhaAtualIncorretaError } from "@/services/usuario.service";

const alterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres"),
});

export async function PATCH(request: Request) {
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

  const parsed = alterarSenhaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    await usuarioService.alterarSenha(
      session.user.id,
      parsed.data.senhaAtual,
      parsed.data.novaSenha
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SenhaAtualIncorretaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Erro ao alterar senha", error);
    return NextResponse.json({ error: "Não foi possível alterar a senha." }, { status: 500 });
  }
}
