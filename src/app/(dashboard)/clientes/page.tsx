import { auth } from "@/lib/auth/config";
import { getTenantContextOuRedirect } from "../_lib/tenant-context-pagina";
import { ClientesTable } from "@/components/clientes/clientes-table";

export default async function ClientesPage() {
  const ctx = await getTenantContextOuRedirect();

  // O nome do autor do comentário em rascunho sai da sessão: o TenantContext carrega
  // só ids e papel.
  const session = await auth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro e histórico dos clientes do escritório.
        </p>
      </div>

      <ClientesTable
        atorUsuarioId={ctx.usuarioId}
        atorNome={session?.user?.name ?? ""}
        atorRole={ctx.role}
      />
    </div>
  );
}
