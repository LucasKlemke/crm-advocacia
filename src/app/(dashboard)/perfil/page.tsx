import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { lerSessaoDoServidor } from "@/lib/auth/sessao-servidor";
import { usuarioService } from "@/services/usuario.service";
import { PerfilForm } from "@/components/perfil/perfil-form";
import { SenhaForm } from "@/components/perfil/senha-form";
import { AvatarUpload } from "@/components/perfil/avatar-upload";
import { Separator } from "@/components/ui/separator";
import { PageContainer } from "@/components/shared/page-container";

export const metadata: Metadata = {
  title: "Perfil",
};

export default async function PerfilPage() {
  const sessao = await lerSessaoDoServidor();
  if (!sessao) {
    redirect("/login");
  }

  // Nome/e-mail sempre do banco (o JWT só carrega ids); o router.refresh() do
  // PerfilForm re-renderiza este Server Component com o valor novo.
  const perfil = await usuarioService.obterPerfil(sessao.sub);
  if (!perfil) {
    redirect("/login");
  }

  const usuario = { nome: perfil.nome, email: perfil.email };

  return (
    <PageContainer>
      <div>
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        <p className="text-muted-foreground">Gerencie seus dados pessoais e sua senha.</p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Foto</h2>
        <AvatarUpload usuario={{ nome: perfil.nome }} temAvatarInicial={perfil.avatarUrl != null} />
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Dados pessoais</h2>
        <PerfilForm usuario={usuario} />
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Senha</h2>
        <SenhaForm />
      </section>
    </PageContainer>
  );
}
