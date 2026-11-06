import { PageContainer } from "@/components/shared/page-container";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { ListaInstancias } from "./instancias/_components/lista-instancias";

export function PaginaInstancias() {
  useTituloPagina("Instâncias");
  const { role } = useSessaoDoEscritorio();

  return (
    <PageContainer className="max-w-5xl">
      <ListaInstancias somenteLeitura={role === "padrao"} />
    </PageContainer>
  );
}
