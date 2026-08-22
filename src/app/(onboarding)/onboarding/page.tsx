import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Scale } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { NovoEscritorioForm } from "@/components/shell/novo-escritorio-form";

export const metadata: Metadata = {
  title: "Criar escritório",
};

// Alcançável pelo cadastro sem convite pendente — exige apenas sessão válida.
// Criar um escritório adicional a partir do shell autenticado usa o dialog do
// switcher (ver EscritorioSwitcher), não esta página.
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

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
