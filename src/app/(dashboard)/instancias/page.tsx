import type { Metadata } from "next";
import { getTenantContextOuRedirect } from "../_lib/tenant-context-pagina";
import { PageContainer } from "@/components/shared/page-container";
import { ListaInstancias } from "./_components/lista-instancias";

export const metadata: Metadata = {
  title: "Instâncias",
};

export default async function InstanciasPage() {
  const ctx = await getTenantContextOuRedirect();

  return (
    <PageContainer className="max-w-5xl">
      <ListaInstancias somenteLeitura={ctx.role === "padrao"} />
    </PageContainer>
  );
}
