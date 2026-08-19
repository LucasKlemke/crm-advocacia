import { redirect } from "next/navigation";
import { getTenantContext, NaoAutenticadoError, SemEscritorioAtivoError } from "@/lib/auth/tenant-context";
import { membroService } from "@/services/membro.service";
import { conviteService } from "@/services/convite.service";
import { MembrosTable } from "@/components/configuracoes/membros-table";
import { ConviteForm } from "@/components/configuracoes/convite-form";
import { ConvitesTable } from "@/components/configuracoes/convites-table";
import { Separator } from "@/components/ui/separator";

export default async function ConfiguracoesUsuariosPage() {
  let ctx;
  try {
    ctx = await getTenantContext();
  } catch (error) {
    if (error instanceof NaoAutenticadoError) redirect("/login");
    if (error instanceof SemEscritorioAtivoError) redirect("/onboarding");
    throw error;
  }

  const membros = await membroService.listarMembros(ctx);
  const podeGerenciarUsuarios = ctx.role !== "padrao";
  const convites = podeGerenciarUsuarios ? await conviteService.listarPendentes(ctx) : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie quem tem acesso a este escritório.
        </p>
      </div>

      <MembrosTable
        membros={membros.map((membro) => ({
          id: membro.id,
          role: membro.role,
          usuario: { id: membro.usuario.id, nome: membro.usuario.nome, email: membro.usuario.email },
        }))}
        atorUsuarioId={ctx.usuarioId}
        atorRole={ctx.role}
      />

      {podeGerenciarUsuarios ? (
        <>
          <Separator />
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">Convidar colaborador</h2>
            <ConviteForm />
            <ConvitesTable
              convites={convites.map((convite) => ({
                id: convite.id,
                email: convite.email,
                role: convite.role,
              }))}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
