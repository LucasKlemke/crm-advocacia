import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { usuarioService } from "@/services/usuario.service";

// Perfil é do usuário, não do tenant — não passa por getTenantContext() (mesmo
// motivo dos outros endpoints de /api/perfil/avatar).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  try {
    const downloadUrl = await usuarioService.gerarUrlDownloadAvatar(session.user.id);
    return NextResponse.json({ downloadUrl });
  } catch (error) {
    console.error("Erro ao gerar URL de download de avatar", error);
    return NextResponse.json({ error: "Não foi possível gerar o link do avatar." }, { status: 502 });
  }
}
