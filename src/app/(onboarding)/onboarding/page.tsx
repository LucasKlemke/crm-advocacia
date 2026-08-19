import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { OnboardingForm } from "./onboarding-form";

// Alcançável tanto pelo cadastro sem convite pendente quanto pelo switcher
// ("Criar escritório") — em ambos os casos exige apenas sessão válida.
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
        <OnboardingForm />
      </div>
    </div>
  );
}
