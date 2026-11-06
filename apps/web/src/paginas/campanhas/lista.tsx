import { PageContainer } from "@/components/shared/page-container";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { ListaCampanhas } from "./_components/lista-campanhas";

export function PaginaCampanhas() {
  useTituloPagina("Campanhas");
  const { role } = useSessaoDoEscritorio();

  return (
    <PageContainer className="max-w-6xl">
      <ListaCampanhas somenteLeitura={role === "padrao"} />
    </PageContainer>
  );
}
