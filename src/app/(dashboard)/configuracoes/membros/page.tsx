import type { Metadata } from "next";
import { getTenantContextOuRedirect } from "../../_lib/tenant-context-pagina";
import { membroService } from "@/services/membro.service";
import { conviteService } from "@/services/convite.service";
import { usuarioService } from "@/services/usuario.service";
import { MembrosTable } from "@/components/configuracoes/membros-table";
import { ConvitesTable } from "@/components/configuracoes/convites-table";
import { NovoMembroDrawer } from "@/components/configuracoes/novo-membro-drawer";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Membros",
};

export default async function ConfiguracoesMembrosPage() {
  const ctx = await getTenantContextOuRedirect();

  const membrosBrutos = await membroService.listarMembros(ctx);
  const membros = await Promise.all(
    membrosBrutos.map(async (membro) => ({
      ...membro,
      usuario: {
        ...membro.usuario,
        avatarUrl: await usuarioService.assinarUrlAvatar(membro.usuario.avatarUrl),
      },
    }))
  );
  const podeGerenciarMembros = ctx.role !== "padrao";
  const convites = podeGerenciarMembros ? await conviteService.listarPendentes(ctx) : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Membros</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os membros e permissões da sua equipe.
          </p>
        </div>
        {podeGerenciarMembros ? <NovoMembroDrawer /> : null}
      </div>

      <div className="rounded-xl border border-border">
        <MembrosTable
          membros={membros.map((membro) => ({
            id: membro.id,
            role: membro.role,
            usuario: {
              id: membro.usuario.id,
              nome: membro.usuario.nome,
              email: membro.usuario.email,
              telefone: membro.usuario.telefone,
              avatarUrl: membro.usuario.avatarUrl,
            },
          }))}
          atorUsuarioId={ctx.usuarioId}
          atorRole={ctx.role}
        />
        {podeGerenciarMembros && convites.length > 0 ? (
          <>
            <Separator />
            <ConvitesTable
              convites={convites.map((convite) => ({
                id: convite.id,
                email: convite.email,
                role: convite.role,
              }))}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
