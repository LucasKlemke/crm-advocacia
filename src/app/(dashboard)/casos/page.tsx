import { auth } from "@/lib/auth/config";
import { getTenantContextOuRedirect } from "../_lib/tenant-context-pagina";
import { CasosView } from "@/components/casos/casos-view";

export default async function CasosPage() {
  const ctx = await getTenantContextOuRedirect();

  // Nome do autor do comentário em rascunho sai da sessão, como em /clientes.
  const session = await auth();

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
        atorNome={session?.user?.name ?? ""}
        atorRole={ctx.role}
      />
    </div>
  );
}
