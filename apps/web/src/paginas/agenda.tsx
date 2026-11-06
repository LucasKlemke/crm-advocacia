import { AgendaView } from "./agenda/_components/agenda-view";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

// Eventos buscados no cliente: o período depende da visão (mês/semana/dia) que vive na
// URL. O tenant já foi garantido pela RotaProtegida.
export function PaginaAgenda() {
  useTituloPagina("Agenda");

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Agenda</h1>
        <p className="text-sm text-muted-foreground">Audiências, reuniões e compromissos do escritório.</p>
      </div>

      <AgendaView />
    </div>
  );
}
