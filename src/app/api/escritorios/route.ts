import { NextResponse } from "next/server";
import { z } from "zod";
import { escritorioService, EmailJaCadastradoError } from "@/services/escritorio.service";

const cadastroSchema = z.object({
  nomeEscritorio: z.string().min(1, "Informe o nome do escritório"),
  oabResponsavel: z.string().optional(),
  telefoneWhatsapp: z.string().optional(),
  nomeTitular: z.string().min(1, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
  oabTitular: z.string().optional(),
  telefoneTitular: z.string().optional(),
});

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
    const { escritorio, titular } = await escritorioService.cadastrarEscritorio(parsed.data);
    return NextResponse.json(
      {
        escritorio: { id: escritorio.id, nome: escritorio.nome },
        usuario: { id: titular.id, email: titular.email, role: titular.role },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof EmailJaCadastradoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Erro ao cadastrar escritório", error);
    return NextResponse.json(
      { error: "Não foi possível concluir o cadastro. Tente novamente." },
      { status: 500 }
    );
  }
}
