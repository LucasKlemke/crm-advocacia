import { useParams } from "react-router";
import { PageContainer } from "@/components/shared/page-container";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { DetalheCampanha } from "./detalhe/_components/detalhe-campanha";

export function PaginaCampanha() {
  useTituloPagina("Campanha");
  const { role } = useSessaoDoEscritorio();
  // A rota é "campanhas/:id", então o parâmetro sempre existe quando a página monta.
  const { id = "" } = useParams<{ id: string }>();

  return (
    <PageContainer className="max-w-5xl">
      {/* Pausar/retomar é ação de gestão (a API recusaria de qualquer forma). */}
      <DetalheCampanha campanhaId={id} somenteLeitura={role === "padrao"} />
    </PageContainer>
  );
}
