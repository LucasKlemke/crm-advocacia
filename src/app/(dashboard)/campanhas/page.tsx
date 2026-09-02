import type { Metadata } from "next";
import { getTenantContextOuRedirect } from "../_lib/tenant-context-pagina";
import { PageContainer } from "@/components/shared/page-container";
import { ListaCampanhas } from "./_components/lista-campanhas";

export const metadata: Metadata = {
  title: "Campanhas",
};

export default async function CampanhasPage() {
  const ctx = await getTenantContextOuRedirect();

  return (
    <PageContainer className="max-w-6xl">
      <ListaCampanhas somenteLeitura={ctx.role === "padrao"} />
    </PageContainer>
  );
}
