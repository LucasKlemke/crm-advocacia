import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { unstable_update } from "@/lib/auth/config";
import { escritorioService } from "@/services/escritorio.service";

const criarEscritorioSchema = z.object({
  nome: z.string().min(1, "Informe o nome do escritório"),
  oabResponsavel: z.string().optional(),
  telefoneWhatsapp: z.string().optional(),
});

// Sessão exigida (onboarding do primeiro escritório ou criação de outro pelo switcher),
// mas NÃO passa por getTenantContext() — o usuário pode não ter nenhum escritório ainda.
//
// Usa getToken() (leitura pura do JWT) em vez de auth() aqui: auth() sempre reemite um
// Set-Cookie de "rolling refresh" da sessão JWT, e como este handler já emite outro
// Set-Cookie via unstable_update(), os dois juntos confundem o cookie jar do browser
// (a sessão nunca reflete o escritório recém-criado). getToken() só lê, sem gravar.
export async function POST(request: Request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const usuarioId = token?.sub;
  if (!usuarioId) {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const parsed = criarEscritorioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const { escritorio, membro } = await escritorioService.criarEscritorio(
      usuarioId,
      parsed.data
    );

    // Escritório recém-criado vira o ativo da sessão.
    await unstable_update({ user: { escritorioId: escritorio.id } });

    return NextResponse.json(
      { escritorio: { id: escritorio.id, nome: escritorio.nome }, role: membro.role },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar escritório", error);
    return NextResponse.json(
      { error: "Não foi possível criar o escritório. Tente novamente." },
      { status: 500 }
    );
  }
}
