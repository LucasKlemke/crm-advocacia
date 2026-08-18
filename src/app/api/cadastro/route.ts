import { NextResponse } from "next/server";
import { z } from "zod";
import { usuarioService, EmailJaCadastradoError } from "@/services/usuario.service";

const cadastroSchema = z.object({
  nome: z.string().min(1, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
});

// Rota pública (RN02): cadastro coleta só nome/e-mail/senha. Se havia convite pendente
// para o e-mail, o usuário já entra no(s) escritório(s) — senão vai para o onboarding.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const parsed = cadastroSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const { usuario, temEscritorio } = await usuarioService.cadastrarUsuario(parsed.data);
    return NextResponse.json(
      {
        usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
        temEscritorio,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof EmailJaCadastradoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Erro ao cadastrar usuário", error);
    return NextResponse.json(
      { error: "Não foi possível concluir o cadastro. Tente novamente." },
      { status: 500 }
    );
  }
}
