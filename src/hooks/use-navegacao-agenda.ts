"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { navegar, rangeDaVisao, rotuloDoPeriodo, chaveDoDia } from "@/lib/utils/agenda-grade";
import type { VisaoAgenda } from "@/types/evento";

const VISOES: VisaoAgenda[] = ["mes", "semana", "dia"];

function lerVisao(valor: string | null): VisaoAgenda {
  return VISOES.includes(valor as VisaoAgenda) ? (valor as VisaoAgenda) : "mes";
}

// Data de foco vem de ?data=YYYY-MM-DD interpretada em hora LOCAL: `new Date("2026-09-10")`
// seria meia-noite UTC e, a oeste de Greenwich, cairia no dia 9.
function lerData(valor: string | null): Date {
  const partes = valor?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!partes) return new Date();
  return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
}

// Estado da navegação do calendário espelhado na URL, como os filtros de /casos: um
// link para a agenda leva o interlocutor exatamente ao período que estava na tela, e
// F5 não joga o usuário de volta para hoje.
export function useNavegacaoAgenda() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const visao = lerVisao(searchParams.get("visao"));
  const dataFoco = useMemo(() => lerData(searchParams.get("data")), [searchParams]);

  const aplicar = useCallback(
    (proximaVisao: VisaoAgenda, proximaData: Date) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("visao", proximaVisao);
      params.set("data", chaveDoDia(proximaData));
      // replace, não push: navegar meses não deve encher o histórico do navegador.
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const periodo = useMemo(() => rangeDaVisao(visao, dataFoco), [visao, dataFoco]);

  return {
    visao,
    dataFoco,
    periodo,
    rotulo: rotuloDoPeriodo(visao, dataFoco),
    trocarVisao: (proxima: VisaoAgenda) => aplicar(proxima, dataFoco),
    irPara: (data: Date, proximaVisao: VisaoAgenda = visao) => aplicar(proximaVisao, data),
    anterior: () => aplicar(visao, navegar(visao, dataFoco, -1)),
    proximo: () => aplicar(visao, navegar(visao, dataFoco, 1)),
    hoje: () => aplicar(visao, new Date()),
  };
}
