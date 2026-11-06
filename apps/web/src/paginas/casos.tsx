import { CasosView } from "@/components/casos/casos-view";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaCasos() {
  useTituloPagina("Processos");
  const sessao = useSessaoDoEscritorio();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Processos</h1>
        <p className="text-sm text-muted-foreground">Kanban e histórico dos processos do escritório.</p>
      </div>

      <CasosView
        atorUsuarioId={sessao.usuario.id}
        atorNome={sessao.usuario.nome}
        atorRole={sessao.role}
      />
    </div>
  );
}
