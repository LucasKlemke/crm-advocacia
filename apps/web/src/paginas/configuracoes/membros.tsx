import { MembrosTable } from "@/components/configuracoes/membros-table";
import { ConvitesTable } from "@/components/configuracoes/convites-table";
import { NovoMembroDrawer } from "@/components/configuracoes/novo-membro-drawer";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useConvitesPendentes, useMembros } from "@/hooks/use-membros";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

// Membros e convites vêm da API (o avatar já chega assinado). Depois de alterar papel,
// remover membro, convidar ou cancelar convite, os componentes chamam refresh(), que
// invalida estas queries.
export function PaginaConfiguracoesMembros() {
  useTituloPagina("Membros");
  const sessao = useSessaoDoEscritorio();
  const podeGerenciarMembros = sessao.role !== "padrao";
  const membros = useMembros();
  const convites = useConvitesPendentes(podeGerenciarMembros);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Membros</h1>
          <p className="text-sm text-muted-foreground">Gerencie os membros e permissões da sua equipe.</p>
        </div>
        {podeGerenciarMembros ? <NovoMembroDrawer /> : null}
      </div>

      <div className="rounded-xl border border-border">
        {membros.isLoading ? (
          <div role="status" aria-label="Carregando membros" className="flex flex-col gap-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !membros.data ? (
          // Erro só quando não há dado: um refetch que falha não desmonta a tabela.
          <p role="alert" className="p-4 text-sm text-destructive">
            Não foi possível carregar os membros.
          </p>
        ) : (
          <MembrosTable membros={membros.data} atorUsuarioId={sessao.usuario.id} atorRole={sessao.role} />
        )}
        {podeGerenciarMembros && convites.data && convites.data.length > 0 ? (
          <>
            <Separator />
            <ConvitesTable convites={convites.data} />
          </>
        ) : null}
      </div>
    </div>
  );
}
