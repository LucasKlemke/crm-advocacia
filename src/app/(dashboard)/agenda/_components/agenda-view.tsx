"use client";

import { useEffect, useState } from "react";
import { CalendarX } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEventos } from "@/hooks/use-eventos";
import { useNavegacaoAgenda } from "@/hooks/use-navegacao-agenda";
import { diasDaSemana } from "@/lib/utils/agenda-grade";
import { Skeleton } from "@/components/ui/skeleton";
import { AgendaToolbar } from "./agenda-toolbar";
import { GradeMes } from "./grade-mes";
import { GradeSemana } from "./grade-semana";
import { EventoSheet, type ModoEventoSheet } from "./evento-sheet";
import type { EventoDTO } from "@/types/evento";

interface SheetAberta {
  modo: ModoEventoSheet;
  evento: EventoDTO | null;
  inicioSugerido?: Date;
  fimSugerido?: Date;
}

// Dono do estado da tela: a navegação (visão + data de foco) vive na URL via
// useNavegacaoAgenda, e só a drawer é estado local — assim recarregar a página mantém o
// período, mas não reabre um formulário pela metade.
export function AgendaView() {
  const nav = useNavegacaoAgenda();
  const compacto = useIsMobile();
  const [sheet, setSheet] = useState<SheetAberta | null>(null);

  const { data, isPending, isError } = useEventos({
    inicio: nav.periodo.inicio.toISOString(),
    fim: nav.periodo.fim.toISOString(),
  });
  const eventos = data?.eventos ?? [];

  // Mês e semana em 375px de largura viram colunas de 40px: no mobile a agenda abre
  // direto na visão de dia, a única legível.
  useEffect(() => {
    if (compacto && nav.visao !== "dia") {
      nav.trocarVisao("dia");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compacto]);

  function abrirEvento(evento: EventoDTO) {
    setSheet({ modo: "ver", evento });
  }

  function criarEm(inicio: Date, fim: Date) {
    setSheet({ modo: "criar", evento: null, inicioSugerido: inicio, fimSugerido: fim });
  }

  function criarNoDia(dia: Date) {
    // Clique numa célula de mês não diz a hora: 09:00 é o começo do expediente.
    const inicio = new Date(dia);
    inicio.setHours(9, 0, 0, 0);
    criarEm(inicio, new Date(inicio.getTime() + 3_600_000));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <AgendaToolbar
        visao={nav.visao}
        rotulo={nav.rotulo}
        compacto={compacto}
        onTrocarVisao={nav.trocarVisao}
        onAnterior={nav.anterior}
        onProximo={nav.proximo}
        onHoje={nav.hoje}
        onNovoEvento={() => criarNoDia(nav.dataFoco)}
      />

      {isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-border p-8 text-center">
          <CalendarX className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a agenda. Tente novamente.
          </p>
        </div>
      ) : isPending ? (
        <Skeleton className="min-h-96 flex-1 rounded-lg" />
      ) : nav.visao === "mes" ? (
        <GradeMes
          dataFoco={nav.dataFoco}
          eventos={eventos}
          onSelecionarEvento={abrirEvento}
          onSelecionarDia={criarNoDia}
          onVerDia={(dia) => nav.irPara(dia, "dia")}
        />
      ) : (
        <GradeSemana
          dias={nav.visao === "semana" ? diasDaSemana(nav.dataFoco) : [nav.dataFoco]}
          eventos={eventos}
          onSelecionarEvento={abrirEvento}
          onSelecionarSlot={criarEm}
        />
      )}

      {sheet ? (
        <EventoSheet
          modo={sheet.modo}
          evento={sheet.evento}
          inicioSugerido={sheet.inicioSugerido}
          fimSugerido={sheet.fimSugerido}
          aberto
          onOpenChange={(aberto) => {
            if (!aberto) setSheet(null);
          }}
        />
      ) : null}
    </div>
  );
}
