import type { Metadata } from "next";
import { getTenantContextOuRedirect } from "../../_lib/tenant-context-pagina";
import { PageContainer } from "@/components/shared/page-container";
import { StatusTable } from "@/components/configuracoes/status-table";

export const metadata: Metadata = {
  title: "Status do Kanban",
};

export default async function ConfiguracoesStatusPage() {
  const ctx = await getTenantContextOuRedirect();

  return (
    <PageContainer className="max-w-5xl">
      <StatusTable somenteLeitura={ctx.role === "padrao"} />
    </PageContainer>
  );
}
