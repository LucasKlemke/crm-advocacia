import { PerfilForm } from "@/components/perfil/perfil-form";
import { SenhaForm } from "@/components/perfil/senha-form";
import { AvatarUpload } from "@/components/perfil/avatar-upload";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/shared/page-container";
import { usePerfil } from "@/hooks/use-perfil";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

// Os dados vêm do banco (GET /api/perfil), não da sessão do login. Depois de salvar,
// PerfilForm/AvatarUpload chamam router.refresh(), que invalida esta query e a sessão
// (de onde o header tira o nome).
export function PaginaPerfil() {
  useTituloPagina("Perfil");
  const { data: perfil, isLoading, isError } = usePerfil();

  return (
    <PageContainer>
      <div>
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        <p className="text-muted-foreground">Gerencie seus dados pessoais e sua senha.</p>
      </div>

      {isLoading ? (
        <div role="status" aria-label="Carregando perfil" className="flex flex-col gap-4">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="h-9 w-full max-w-md" />
        </div>
      ) : isError || !perfil ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar seu perfil.
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">Foto</h2>
            <AvatarUpload usuario={{ nome: perfil.nome }} temAvatarInicial={perfil.temAvatar} />
          </section>

          <Separator />

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">Dados pessoais</h2>
            {/* key: o formulário usa defaultValue; remonta quando o perfil relido muda. */}
            <PerfilForm key={`${perfil.nome}|${perfil.email}`} usuario={{ nome: perfil.nome, email: perfil.email }} />
          </section>

          <Separator />

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">Senha</h2>
            <SenhaForm />
          </section>
        </>
      )}
    </PageContainer>
  );
}
