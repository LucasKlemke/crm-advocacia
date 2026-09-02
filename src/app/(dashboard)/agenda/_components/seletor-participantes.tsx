"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { AvatarIniciais } from "@/components/shared/avatar-iniciais";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { OpcaoFiltroCaso } from "@/types/caso";

export interface SeletorParticipantesProps {
  opcoes: OpcaoFiltroCaso[];
  selecionados: string[];
  onChange: (membroIds: string[]) => void;
  // O criador do evento é participante obrigatório (RN33): aparece como chip fixo,
  // sem o botão de remover, para a regra ficar visível em vez de virar um 422.
  fixoMembroId?: string | null;
  disabled?: boolean;
}

// Chips com avatar + popover de busca, em vez do FiltroMultiSelect compartilhado: num
// formulário o usuário precisa ver quem já está no evento, não só a contagem.
export function SeletorParticipantes({
  opcoes,
  selecionados,
  onChange,
  fixoMembroId,
  disabled,
}: SeletorParticipantesProps) {
  const [aberto, setAberto] = useState(false);

  const porId = new Map(opcoes.map((opcao) => [opcao.id, opcao]));
  const visiveis = [
    ...(fixoMembroId ? [fixoMembroId] : []),
    ...selecionados.filter((id) => id !== fixoMembroId),
  ];

  function alternar(id: string) {
    if (id === fixoMembroId) return;
    onChange(
      selecionados.includes(id)
        ? selecionados.filter((item) => item !== id)
        : [...selecionados, id]
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {visiveis.map((id) => {
          const membro = porId.get(id);
          const ehFixo = id === fixoMembroId;
          return (
            <span
              key={id}
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 py-0.5 pl-0.5 pr-2 text-sm"
            >
              <AvatarIniciais
                nome={membro?.nome ?? "?"}
                avatarUrl={membro?.avatarUrl}
                className="size-6"
              />
              <span className="max-w-40 truncate">{membro?.nome ?? "Membro"}</span>
              {ehFixo ? (
                <span className="text-xs text-muted-foreground">(organizador)</span>
              ) : (
                <button
                  type="button"
                  onClick={() => alternar(id)}
                  disabled={disabled}
                  aria-label={`Remover ${membro?.nome ?? "participante"}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </span>
          );
        })}

        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                aria-label="Adicionar participantes"
              />
            }
          >
            <UserPlus className="size-4" />
            Adicionar
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar membro..." />
              <CommandList>
                <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
                <CommandGroup>
                  {opcoes.map((opcao) => {
                    const ehFixo = opcao.id === fixoMembroId;
                    return (
                      <CommandItem
                        key={opcao.id}
                        value={opcao.nome}
                        disabled={ehFixo}
                        onSelect={() => alternar(opcao.id)}
                      >
                        <Checkbox
                          checked={ehFixo || selecionados.includes(opcao.id)}
                          disabled={ehFixo}
                          aria-hidden
                          tabIndex={-1}
                        />
                        <AvatarIniciais
                          nome={opcao.nome}
                          avatarUrl={opcao.avatarUrl}
                          className="size-6"
                        />
                        <span className="truncate">{opcao.nome}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
