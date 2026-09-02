"use client";

import { Fragment, useState } from "react";
import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AvatarIniciais } from "@/components/shared/avatar-iniciais";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SEM_RESPONSAVEL } from "@/types/caso";

export interface OpcaoMultiSelect {
  id: string;
  nome: string;
  // Cor opcional (bolinha) para diferenciar status na lista, como no picker de ícones.
  cor?: string;
  // Linha secundária abaixo do nome (ex.: CPF do cliente), como no combobox de cliente.
  subtitulo?: string;
  // Texto explicativo do item (descrição do status/tipo de status) — mostrado em
  // tooltip ao passar o mouse sobre a opção, como nos cards do dashboard.
  descricao?: string | null;
  avatarUrl?: string | null;
}

export interface AcaoCriarMultiSelect {
  label: string;
  onSelecionar: () => void;
}

export interface FiltroMultiSelectProps {
  label: string;
  icone?: LucideIcon;
  opcoes: OpcaoMultiSelect[];
  selecionados: string[];
  onChange: (selecionados: string[]) => void;
  buscaPlaceholder?: string;
  // Filtro de responsável: mostra o avatar de iniciais ao lado do nome, como no
  // select de responsável do formulário de caso.
  avatares?: boolean;
  // Item extra no topo da lista (ex.: "Criar cliente"), como o combobox do form de
  // caso — fecha o popover e delega a ação a quem renderiza o filtro.
  acaoCriar?: AcaoCriarMultiSelect;
}

// Popover + Command genérico para os filtros de casos (responsável/cliente/status/tipo):
// botão mostra o rótulo com a contagem de selecionados, lista com busca e checkboxes.
// A seleção é disparada por onSelect (não onClick) — cmdk não repassa onClick ao item.
export function FiltroMultiSelect({
  label,
  icone: Icone,
  opcoes,
  selecionados,
  onChange,
  buscaPlaceholder,
  avatares,
  acaoCriar,
}: FiltroMultiSelectProps) {
  const [aberto, setAberto] = useState(false);

  function alternar(id: string) {
    onChange(
      selecionados.includes(id)
        ? selecionados.filter((item) => item !== id)
        : [...selecionados, id]
    );
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={label}
          />
        }
      >
        {Icone ? <Icone className="size-4" /> : null}
        {label}
        {selecionados.length > 0 ? ` (${selecionados.length})` : ""}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput placeholder={buscaPlaceholder ?? `Buscar ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
            {acaoCriar ? (
              <CommandGroup>
                <CommandItem
                  value={acaoCriar.label}
                  onSelect={() => {
                    setAberto(false);
                    acaoCriar.onSelecionar();
                  }}
                >
                  <Plus className="size-3.5" />
                  {acaoCriar.label}
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup>
              {opcoes.map((opcao) => {
                const marcado = selecionados.includes(opcao.id);
                const item = (
                  <CommandItem
                    value={opcao.nome}
                    onSelect={() => alternar(opcao.id)}
                  >
                    <Checkbox checked={marcado} aria-hidden tabIndex={-1} />
                    {opcao.cor ? (
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: opcao.cor }}
                      />
                    ) : null}
                    {avatares && opcao.id !== SEM_RESPONSAVEL ? (
                      <AvatarIniciais
                        nome={opcao.nome}
                        avatarUrl={opcao.avatarUrl}
                        className="size-5 text-[10px]"
                      />
                    ) : null}
                    {opcao.subtitulo ? (
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{opcao.nome}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {opcao.subtitulo}
                        </span>
                      </span>
                    ) : (
                      opcao.nome
                    )}
                  </CommandItem>
                );

                if (!opcao.descricao) {
                  return <Fragment key={opcao.id}>{item}</Fragment>;
                }

                // A linha inteira é o gatilho e `delay={0}` sobrescreve os 600ms padrão do
                // Base UI: a descrição aparece assim que o mouse entra na opção. Fica ao
                // lado da lista para não cobrir os itens vizinhos do popover.
                return (
                  <Tooltip key={opcao.id}>
                    <TooltipTrigger delay={0} render={item} />
                    <TooltipContent side="right">{opcao.descricao}</TooltipContent>
                  </Tooltip>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
