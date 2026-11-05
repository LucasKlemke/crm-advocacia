import type { Metadata } from "next";
import { obterUsuarioDaSessao } from "@/lib/auth/sessao-servidor";
import { getTenantContextOuRedirect } from "../_lib/tenant-context-pagina";
import { CasosView } from "@/components/casos/casos-view";

export const metadata: Metadata = {
  title: "Processos",
};

export default async function CasosPage() {
  const ctx = await getTenantContextOuRedirect();

  // O nome do autor do comentário em rascunho sai do banco: o TenantContext e o JWT
  // carregam só ids e papel.
  const usuario = await obterUsuarioDaSessao();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Processos</h1>
        <p className="text-sm text-muted-foreground">
          Kanban e histórico dos processos do escritório.
        </p>
      </div>

      <CasosView
        atorUsuarioId={ctx.usuarioId}
        atorNome={usuario?.nome ?? ""}
        atorRole={ctx.role}
      />
    </div>
  );
}
