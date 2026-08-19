import { redirect } from "next/navigation";
import {
  getTenantContext,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
} from "@/lib/auth/tenant-context";
import { ClientesTable } from "@/components/clientes/clientes-table";

export default async function ClientesPage() {
  let ctx;
  try {
    ctx = await getTenantContext();
  } catch (error) {
    if (error instanceof NaoAutenticadoError) redirect("/login");
    if (error instanceof SemEscritorioAtivoError) redirect("/onboarding");
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro e histórico dos clientes do escritório.
        </p>
      </div>

      <ClientesTable atorUsuarioId={ctx.usuarioId} atorRole={ctx.role} />
    </div>
  );
}
