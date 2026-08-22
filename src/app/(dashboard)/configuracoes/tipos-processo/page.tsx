import type { Metadata } from "next";
import { getTenantContextOuRedirect } from "../../_lib/tenant-context-pagina";
import { PageContainer } from "@/components/shared/page-container";
import { TipoProcessoTable } from "@/components/configuracoes/tipo-processo-table";

export const metadata: Metadata = {
  title: "Tipos de processo",
};

export default async function ConfiguracoesTiposProcessoPage() {
  const ctx = await getTenantContextOuRedirect();

  return (
    <PageContainer className="max-w-5xl">
      <TipoProcessoTable somenteLeitura={ctx.role === "padrao"} />
    </PageContainer>
  );
}
