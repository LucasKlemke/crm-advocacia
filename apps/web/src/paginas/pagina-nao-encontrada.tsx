import Link from "@/compat/next-link";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaNaoEncontrada() {
  useTituloPagina("Página não encontrada");

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground">O endereço acessado não existe no CRM.</p>
      <Link
        href="/"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Voltar ao início
      </Link>
    </section>
  );
}
