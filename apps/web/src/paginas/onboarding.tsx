import { Scale } from "lucide-react";
import { NovoEscritorioForm } from "@/components/shell/novo-escritorio-form";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

// Alcançável pelo cadastro sem convite pendente. Fica sob
// <RotaProtegida exigirEscritorio={false}>: exige sessão, mas não escritório. Criar
// um escritório adicional pelo shell usa o dialog do switcher, não esta página.
export function PaginaOnboarding() {
  useTituloPagina("Criar escritório");

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-brand">
            <Scale className="size-4" />
            CRM Advocacia
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Conte-nos sobre o seu escritório
          </h1>
          <p className="max-w-md text-balance text-muted-foreground">
            Essas informações ajudam colegas e clientes a identificar o seu escritório dentro do CRM.
          </p>
        </div>

        <NovoEscritorioForm />
      </div>
    </div>
  );
}
