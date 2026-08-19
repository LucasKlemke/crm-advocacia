import { getTenantContextOuRedirect } from "../../_lib/tenant-context-pagina";
import { PageContainer } from "@/components/shared/page-container";
import { StatusTable } from "@/components/configuracoes/status-table";

export default async function ConfiguracoesStatusPage() {
  const ctx = await getTenantContextOuRedirect();

  return (
    <PageContainer className="max-w-5xl">
      <StatusTable somenteLeitura={ctx.role === "padrao"} />
    </PageContainer>
  );
}
