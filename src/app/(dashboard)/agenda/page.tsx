import type { Metadata } from "next";
import { Suspense } from "react";
import { getTenantContextOuRedirect } from "../_lib/tenant-context-pagina";
import { Skeleton } from "@/components/ui/skeleton";
import { AgendaView } from "./_components/agenda-view";

export const metadata: Metadata = {
  title: "Agenda",
};

export default async function AgendaPage() {
  // Só garante a sessão e o escritório ativo (RN19); os eventos são buscados no cliente,
  // porque o período depende da visão escolhida, que vive na URL e muda a cada clique.
  await getTenantContextOuRedirect();

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Audiências, reuniões e compromissos do escritório.
        </p>
      </div>

      {/* useSearchParams exige Suspense num Server Component pai. */}
      <Suspense fallback={<Skeleton className="min-h-96 flex-1 rounded-lg" />}>
        <AgendaView />
      </Suspense>
    </div>
  );
}
