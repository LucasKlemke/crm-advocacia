import { EscritorioForm } from "@/components/configuracoes/escritorio-form";
import { PageContainer } from "@/components/shared/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { useEscritorioAtual } from "@/hooks/use-escritorios";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaConfiguracoesEscritorio() {
  useTituloPagina("Escritório");
  const { role } = useSessaoDoEscritorio();
  const { data: escritorio, isLoading } = useEscritorioAtual();
  const somenteLeitura = role === "padrao";

  return (
    <PageContainer className="gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dados do escritório</h1>
        <p className="text-sm text-muted-foreground">
          {somenteLeitura
            ? "Somente owners e admins podem editar estes dados."
            : "Essas informações aparecem nas mensagens e documentos do escritório."}
        </p>
      </div>
      {isLoading ? (
        <div role="status" aria-label="Carregando escritório" className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : !escritorio ? (
        // Erro só quando não há dado: um refetch que falha não desmonta o formulário.
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar o escritório.
        </p>
      ) : (
        // key: depois do refresh() de um save, o form remonta com o valor salvo (o
        // EscritorioForm guarda máscara de OAB/WhatsApp em estado inicializado das props).
        <EscritorioForm
          key={`${escritorio.id}:${escritorio.nome}:${escritorio.oabResponsavel}:${escritorio.telefoneWhatsapp}`}
          escritorio={{
            nome: escritorio.nome,
            oabResponsavel: escritorio.oabResponsavel,
            telefoneWhatsapp: escritorio.telefoneWhatsapp,
          }}
          somenteLeitura={somenteLeitura}
        />
      )}
    </PageContainer>
  );
}
