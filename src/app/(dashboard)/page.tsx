import type { Metadata } from "next";
import { auth } from "@/lib/auth/config";
import { getTenantContextOuRedirect } from "./_lib/tenant-context-pagina";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const ctx = await getTenantContextOuRedirect();
  const session = await auth();

  return (
    <div className="flex flex-col gap-6">
      <DashboardView
        atorUsuarioId={ctx.usuarioId}
        atorNome={session?.user?.name ?? ""}
        atorRole={ctx.role}
      />
    </div>
  );
}
