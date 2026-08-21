import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Crie seu escritório</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Você poderá convidar colegas e criar outros escritórios depois.
        </p>
        <NovoEscritorioForm />
      </div>
    </div>
  );
}
