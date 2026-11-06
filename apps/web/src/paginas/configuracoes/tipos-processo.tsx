import { PageContainer } from "@/components/shared/page-container";
import { TipoProcessoTable } from "@/components/configuracoes/tipo-processo-table";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaConfiguracoesTiposProcesso() {
  useTituloPagina("Tipos de processo");
  const { role } = useSessaoDoEscritorio();

  return (
    <PageContainer className="max-w-5xl">
      <TipoProcessoTable somenteLeitura={role === "padrao"} />
    </PageContainer>
  );
}
