"use client";

import { useState } from "react";
import {
  MessageCircle,
  Search,
  CircleCheck,
  FileText,
  Trophy,
  CircleX,
  Phone,
  Mail,
  Calendar,
  Clock,
  Gavel,
  Scale,
  FileSignature,
  Handshake,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Star,
  Flag,
  Archive,
  Users,
  UserCheck,
  Briefcase,
  ClipboardCheck,
  BadgeCheck,
  TrendingUp,
  TrendingDown,
  Send,
  Eye,
  Loader,
  UserPlus,
  FolderOpen,
  Ban,
  type LucideIcon,
} from "lucide-react";
import { ICONES_STATUS_PERMITIDOS } from "@/lib/utils/icones-status";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

// Precisa ficar em sincronia com ICONES_STATUS_PERMITIDOS (icones-status.ts) — se um nome
// for adicionado/renomeado lá, atualizar o import e o mapa aqui também. Exportado para que
// a tabela de status (status-table.tsx) reaproveite o mesmo mapa em vez de duplicá-lo.
export const MAPA_ICONES_STATUS: Record<string, LucideIcon> = {
  MessageCircle,
  Search,
  CircleCheck,
  FileText,
  Trophy,
  CircleX,
  Phone,
  Mail,
  Calendar,
  Clock,
  Gavel,
  Scale,
  FileSignature,
  Handshake,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Star,
  Flag,
  Archive,
  Users,
  UserCheck,
  Briefcase,
  ClipboardCheck,
  BadgeCheck,
  TrendingUp,
  TrendingDown,
  Send,
  Eye,
  Loader,
  UserPlus,
  FolderOpen,
  Ban,
};

export interface StatusIconePickerProps {
  value: string | null;
  onChange: (icone: string) => void;
  disabled?: boolean;
}

export function StatusIconePicker({ value, onChange, disabled }: StatusIconePickerProps) {
  const [aberto, setAberto] = useState(false);
  const IconeSelecionado = value ? MAPA_ICONES_STATUS[value] : undefined;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            disabled={disabled}
            aria-label="Selecionar ícone"
          />
        }
      >
        {IconeSelecionado ? (
          <IconeSelecionado className="size-4" />
        ) : (
          "Selecione um ícone"
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Buscar ícone..." />
          <CommandList>
            <CommandEmpty>Nenhum ícone encontrado.</CommandEmpty>
            <CommandGroup className="**:[[cmdk-group-items]]:grid **:[[cmdk-group-items]]:grid-cols-3 **:[[cmdk-group-items]]:gap-1">
              {ICONES_STATUS_PERMITIDOS.map((nomeIcone) => {
                const Icone = MAPA_ICONES_STATUS[nomeIcone];
                return (
                  <CommandItem
                    key={nomeIcone}
                    value={nomeIcone}
                    aria-label={nomeIcone}
                    data-checked={nomeIcone === value}
                    onSelect={() => {
                      onChange(nomeIcone);
                      setAberto(false);
                    }}
                    className="aspect-square items-center justify-center rounded-md p-0 data-[checked=true]:bg-muted data-[checked=true]:ring-2 data-[checked=true]:ring-foreground [&>svg:last-child]:hidden"
                  >
                    {Icone ? <Icone className="size-4" /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
