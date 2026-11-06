import { PageContainer } from "@/components/shared/page-container";
import { StatusTable } from "@/components/configuracoes/status-table";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaConfiguracoesStatus() {
  useTituloPagina("Status do Kanban");
  const { role } = useSessaoDoEscritorio();

  return (
    <PageContainer className="max-w-5xl">
      <StatusTable somenteLeitura={role === "padrao"} />
    </PageContainer>
  );
}
