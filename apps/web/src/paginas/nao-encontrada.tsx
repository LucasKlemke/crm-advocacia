import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

export function PaginaNaoEncontrada() {
  useTituloPagina("Página não encontrada");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-muted-foreground">O endereço acessado não existe ou foi movido.</p>
      <Link to="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </div>
  );
}
