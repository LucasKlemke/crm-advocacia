import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { PerfilForm } from "@/components/perfil/perfil-form";
import { SenhaForm } from "@/components/perfil/senha-form";
import { Separator } from "@/components/ui/separator";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const usuario = { nome: session.user.name ?? "", email: session.user.email ?? "" };

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        <p className="text-muted-foreground">Gerencie seus dados pessoais e sua senha.</p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Foto</h2>
        <p className="text-sm text-muted-foreground">Upload de avatar em breve.</p>
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
    </div>
  );
}
