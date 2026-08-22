"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, Plus, Search, Table2, Tag, User, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { chaveCasosFiltroOpcoes, useCasoFiltroOpcoes } from "@/hooks/use-casos";
import { FiltroMultiSelect } from "@/components/casos/filtro-multi-select";
import { FiltroPeriodo, type PeriodoFiltro } from "@/components/casos/filtro-periodo";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatarCpf } from "@/lib/utils/cpf";
import { SEM_RESPONSAVEL } from "@/types/caso";
import type { FiltrosCasos } from "@/types/caso";

export type VisaoCasos = "kanban" | "tabela";

export interface CasosHeaderProps {
  filtros: FiltrosCasos;
  onFiltrosChange: (filtros: FiltrosCasos) => void;
  visao: VisaoCasos;
  onVisaoChange: (visao: VisaoCasos) => void;
  onNovoCaso: () => void;
}

// Cabeçalho da tela: busca + alternância Kanban/Tabela + filtros multi-select
// (responsável/cliente/status/tipo) + período de criação + "+ Novo processo" — ver
// referencias_visuais/header-filtros.png.
export function CasosHeader({
  filtros,
  onFiltrosChange,
  visao,
  onVisaoChange,
  onNovoCaso,
}: CasosHeaderProps) {
  const queryClient = useQueryClient();
  const [buscaDigitada, setBuscaDigitada] = useState(filtros.busca);
  const [criandoCliente, setCriandoCliente] = useState(false);
  const { data: opcoes } = useCasoFiltroOpcoes();

  // Debounce da busca: cada tecla não pode virar uma chamada de API.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (buscaDigitada !== filtros.busca) {
        onFiltrosChange({ ...filtros, busca: buscaDigitada, pagina: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaDigitada]);

  const opcoesResponsavel = [
    { id: SEM_RESPONSAVEL, nome: "Sem responsável" },
    ...(opcoes?.membros ?? []),
  ];

  function periodo(): PeriodoFiltro {
    return { dataInicio: filtros.dataInicio, dataFim: filtros.dataFim };
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar processos"
          placeholder="Buscar por título ou descrição"
          className="pl-8"
          value={buscaDigitada}
          onChange={(evento) => setBuscaDigitada(evento.target.value)}
        />
      </div>

      <div role="group" aria-label="Alternar visão" className="flex items-center rounded-lg border border-border p-0.5">
        <Button
          type="button"
          variant={visao === "kanban" ? "default" : "ghost"}
          size="sm"
          onClick={() => onVisaoChange("kanban")}
        >
          <LayoutGrid />
          Kanban
        </Button>
        <Button
          type="button"
          variant={visao === "tabela" ? "default" : "ghost"}
          size="sm"
          onClick={() => onVisaoChange("tabela")}
        >
          <Table2 />
          Tabela
        </Button>
      </div>

      <FiltroMultiSelect
        label="Responsável"
        icone={Users}
        opcoes={opcoesResponsavel}
        selecionados={filtros.responsavelIds}
        onChange={(responsavelIds) => onFiltrosChange({ ...filtros, responsavelIds, pagina: 1 })}
        buscaPlaceholder="Buscar responsável..."
        avatares
      />

      <FiltroMultiSelect
        label="Cliente"
        icone={User}
        opcoes={(opcoes?.clientes ?? []).map((c) => ({
          id: c.id,
          nome: c.nome,
          subtitulo: formatarCpf(c.cpf),
        }))}
        selecionados={filtros.clienteIds}
        onChange={(clienteIds) => onFiltrosChange({ ...filtros, clienteIds, pagina: 1 })}
        buscaPlaceholder="Buscar cliente..."
        acaoCriar={{ label: "Novo cliente", onSelecionar: () => setCriandoCliente(true) }}
      />

      <FiltroMultiSelect
        label="Status"
        icone={Tag}
        opcoes={(opcoes?.status ?? []).map((s) => ({
          id: s.id,
          nome: s.nome,
          cor: s.cor,
          descricao: s.descricao,
        }))}
        selecionados={filtros.statusIds}
        onChange={(statusIds) => onFiltrosChange({ ...filtros, statusIds, pagina: 1 })}
        buscaPlaceholder="Buscar status..."
      />

      <FiltroMultiSelect
        label="Tipo de status"
        opcoes={(opcoes?.tipos ?? []).map((t) => ({
          id: t.id,
          nome: t.nome,
          cor: t.cor,
          descricao: t.descricao,
        }))}
        selecionados={filtros.tipoStatusIds}
        onChange={(tipoStatusIds) => onFiltrosChange({ ...filtros, tipoStatusIds, pagina: 1 })}
        buscaPlaceholder="Buscar tipo de status..."
      />

      <FiltroPeriodo
        valor={periodo()}
        onChange={(novoPeriodo) => onFiltrosChange({ ...filtros, ...novoPeriodo, pagina: 1 })}
      />

      <Button onClick={onNovoCaso}>
        <Plus />
        Novo processo
      </Button>

      <Sheet open={criandoCliente} onOpenChange={setCriandoCliente}>
        <SheetContent className="w-full gap-0 sm:max-w-xl">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Novo cliente</SheetTitle>
              <SheetDescription>Cadastre um cliente do escritório sem sair dos processos.</SheetDescription>
            </SheetHeader>
            <div className="px-4 py-4">
              <ClienteForm
                onSucesso={(cliente) => {
                  queryClient.invalidateQueries({ queryKey: chaveCasosFiltroOpcoes() });
                  onFiltrosChange({
                    ...filtros,
                    clienteIds: [...filtros.clienteIds, cliente.id],
                    pagina: 1,
                  });
                  setCriandoCliente(false);
                }}
                onCancelar={() => setCriandoCliente(false)}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
