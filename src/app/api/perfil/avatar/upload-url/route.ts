import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { nomeArquivoSchema } from "@/lib/api/schemas-comuns";
import { usuarioService, TamanhoAvatarInvalidoError } from "@/services/usuario.service";

const uploadUrlAvatarSchema = z.object({
  nomeArquivo: nomeArquivoSchema,
  tipoArquivo: z.enum(["jpeg", "png", "webp"]),
  tamanhoKb: z.number().int().positive(),
});

// Perfil é do usuário, não do tenant — não passa por getTenantContext() (mesmo
// motivo de src/app/api/perfil/route.ts: pode estar em onboarding, sem escritório).
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

  const parsed = uploadUrlAvatarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const resultado = await usuarioService.gerarUrlUploadAvatar(session.user.id, parsed.data);
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof TamanhoAvatarInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Erro ao gerar URL de upload de avatar", error);
    return NextResponse.json({ error: "Não foi possível iniciar o upload." }, { status: 502 });
  }
}
