import { ClientesTable } from "@/components/clientes/clientes-table";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaClientes() {
  useTituloPagina("Clientes");
  const sessao = useSessaoDoEscritorio();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">Cadastro e histórico dos clientes do escritório.</p>
      </div>

      <ClientesTable
        atorUsuarioId={sessao.usuario.id}
        atorNome={sessao.usuario.nome}
        atorRole={sessao.role}
      />
    </div>
  );
}
