import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTenantContextOuRedirect } from "../../_lib/tenant-context-pagina";
import { PageContainer } from "@/components/shared/page-container";
import { FormularioCampanha } from "./_components/formulario-campanha";

export const metadata: Metadata = {
  title: "Nova campanha",
};

export default async function NovaCampanhaPage() {
  const ctx = await getTenantContextOuRedirect();
  // Criar campanha é ação de gestão (o service recusaria de qualquer forma) — barrar aqui
  // evita mostrar um formulário inteiro que vai falhar no último passo.
  if (ctx.role === "padrao") redirect("/campanhas");

  return (
    <PageContainer className="max-w-6xl">
      <FormularioCampanha />
    </PageContainer>
  );
}
