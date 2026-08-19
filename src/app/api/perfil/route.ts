import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { usuarioService, EmailJaCadastradoError } from "@/services/usuario.service";

const atualizarPerfilSchema = z.object({
  nome: z.string().min(1, "Informe seu nome").optional(),
  email: z.string().email("E-mail inválido").optional(),
});

// Perfil é do usuário, não do tenant — não passa por getTenantContext() (o usuário
// pode estar no meio do onboarding, sem nenhum escritório ainda).
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

  const parsed = atualizarPerfilSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const usuario = await usuarioService.atualizarPerfil(session.user.id, parsed.data);
    return NextResponse.json({
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
    });
  } catch (error) {
    if (error instanceof EmailJaCadastradoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Erro ao atualizar perfil", error);
    return NextResponse.json({ error: "Não foi possível atualizar o perfil." }, { status: 500 });
  }
}
