import { useState } from "react";
import { CasosHeader, type VisaoCasos } from "@/components/casos/casos-header";
import { CasosKanban } from "@/components/casos/casos-kanban";
import { CasosTable } from "@/components/casos/casos-table";
import { CasoSheet, type ModoSheet } from "@/components/casos/caso-sheet";
import { filtrosCasosPadrao } from "@crm/compartilhado/tipos/caso";
import type { CasoDTO, FiltrosCasos } from "@crm/compartilhado/tipos/caso";
import type { RoleMembro } from "@crm/compartilhado/enums";

export interface CasosViewProps {
  atorUsuarioId: string;
  atorNome: string;
  atorRole: RoleMembro;
}

// Componente de topo da tela /casos: mantém o estado de filtros e visão (Kanban/Tabela)
// compartilhado pelos dois modos — a filtragem é toda feita no backend (nunca client-side).
export function CasosView({ atorUsuarioId, atorNome, atorRole }: CasosViewProps) {
  const [filtros, setFiltros] = useState<FiltrosCasos>(filtrosCasosPadrao);
  const [visao, setVisao] = useState<VisaoCasos>("kanban");
  const [sheet, setSheet] = useState<{ modo: ModoSheet; caso: CasoDTO | null } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <CasosHeader
        filtros={filtros}
        onFiltrosChange={setFiltros}
        visao={visao}
        onVisaoChange={setVisao}
        onNovoCaso={() => setSheet({ modo: "criar", caso: null })}
        atorRole={atorRole}
      />

      {visao === "kanban" ? (
        <CasosKanban filtros={filtros} onAbrirCaso={(caso) => setSheet({ modo: "ver", caso })} />
      ) : (
        <CasosTable
          filtros={filtros}
          onFiltrosChange={setFiltros}
          onAbrirCaso={(caso) => setSheet({ modo: "ver", caso })}
        />
      )}

      <CasoSheet
        modo={sheet?.modo ?? "criar"}
        caso={sheet?.caso ?? null}
        aberto={sheet !== null}
        onOpenChange={(aberto) => setSheet(aberto ? sheet : null)}
        atorUsuarioId={atorUsuarioId}
        atorNome={atorNome}
        atorRole={atorRole}
      />
    </div>
  );
}
