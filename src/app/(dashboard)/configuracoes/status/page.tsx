import { getTenantContextOuRedirect } from "../../_lib/tenant-context-pagina";
import { PageContainer } from "@/components/shared/page-container";
import { StatusTable } from "@/components/configuracoes/status-table";

export default async function ConfiguracoesStatusPage() {
  const ctx = await getTenantContextOuRedirect();

  return (
    <PageContainer className="max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Status</h1>
          <p className="text-sm text-muted-foreground">
            Configure as etapas do funil de casos do seu escritório.
          </p>
        </div>
      </div>

      <StatusTable somenteLeitura={ctx.role === "padrao"} />
    </PageContainer>
  );
}
