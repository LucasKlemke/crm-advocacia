import type { Metadata } from "next";
import { getTenantContextOuRedirect } from "../../_lib/tenant-context-pagina";
import { PageContainer } from "@/components/shared/page-container";
import { DetalheCampanha } from "./_components/detalhe-campanha";

export const metadata: Metadata = {
  title: "Campanha",
};

export default async function CampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  await getTenantContextOuRedirect();
  const { id } = await params;

  return (
    <PageContainer className="max-w-5xl">
      <DetalheCampanha campanhaId={id} />
    </PageContainer>
  );
}
