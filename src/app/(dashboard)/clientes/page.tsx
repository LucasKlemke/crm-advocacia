import type { Metadata } from "next";
import { obterUsuarioDaSessao } from "@/lib/auth/sessao-servidor";
import { getTenantContextOuRedirect } from "../_lib/tenant-context-pagina";
import { ClientesTable } from "@/components/clientes/clientes-table";

export const metadata: Metadata = {
  title: "Clientes",
};

export default async function ClientesPage() {
  const ctx = await getTenantContextOuRedirect();

  // O nome do autor do comentário em rascunho sai do banco: o TenantContext e o JWT
  // carregam só ids e papel.
  const usuario = await obterUsuarioDaSessao();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro e histórico dos clientes do escritório.
        </p>
      </div>

      <ClientesTable
        atorUsuarioId={ctx.usuarioId}
        atorNome={usuario?.nome ?? ""}
        atorRole={ctx.role}
      />
    </div>
  );
}
