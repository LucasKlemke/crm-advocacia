import type { Metadata } from "next";
import { auth } from "@/lib/auth/config";
import { getTenantContextOuRedirect } from "./_lib/tenant-context-pagina";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const ctx = await getTenantContextOuRedirect();

  // A tabela de processos abaixo dos gráficos abre o CasoSheet ao clicar num caso,
  // por isso precisa do ator autenticado — mesmo padrão de /casos.
  const session = await auth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral dos processos do escritório.
        </p>
      </div>

      <DashboardView
        atorUsuarioId={ctx.usuarioId}
        atorNome={session?.user?.name ?? ""}
        atorRole={ctx.role}
      />
    </div>
  );
}
