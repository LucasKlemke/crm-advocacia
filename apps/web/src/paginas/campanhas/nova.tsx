import { Navigate } from "react-router";
import { PageContainer } from "@/components/shared/page-container";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { FormularioCampanha } from "./nova/_components/formulario-campanha";

export function PaginaNovaCampanha() {
  useTituloPagina("Nova campanha");
  const { role } = useSessaoDoEscritorio();

  // Criar campanha é ação de gestão (a API recusaria de qualquer forma). Barrar aqui
  // evita mostrar um formulário inteiro que vai falhar no último passo.
  if (role === "padrao") return <Navigate to="/campanhas" replace />;

  return (
    <PageContainer className="max-w-6xl">
      <FormularioCampanha />
    </PageContainer>
  );
}
