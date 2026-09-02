"use client";

import { useState } from "react";
import { Briefcase, Check, Link2Off, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCasos } from "@/hooks/use-casos";
import { useClientes } from "@/hooks/use-clientes";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { filtrosCasosPadrao } from "@/types/caso";
import type { DadosEventoForm } from "@/types/evento";

export type VinculoEvento = DadosEventoForm["vinculo"];

export interface SeletorVinculoProps {
  valor: VinculoEvento;
  onChange: (vinculo: VinculoEvento) => void;
  disabled?: boolean;
}

// O vínculo é exclusivo (RN31): um único seletor com as duas listas resolve isso na UI
// melhor que dois campos independentes, que deixariam o usuário escolher os dois e só
// descobrir o erro no 422 do servidor.
export function SeletorVinculo({ valor, onChange, disabled }: SeletorVinculoProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  // Busca no servidor em vez de baixar tudo: o teto por escritório é 1.000 clientes e
  // 5.000 casos (requisitos não funcionais), volume que não cabe num popover.
  const casos = useCasos({ ...filtrosCasosPadrao, busca });
  const clientes = useClientes({ busca, incluirExcluidos: false, pagina: 1 });

  const casoSelecionado =
    valor.tipo === "caso" ? casos.data?.casos.find((c) => c.id === valor.id) : undefined;
  const clienteSelecionado =
    valor.tipo === "cliente" ? clientes.data?.clientes.find((c) => c.id === valor.id) : undefined;

  function rotulo(): string {
    if (valor.tipo === "nenhum") return "Sem vínculo";
    if (valor.tipo === "caso") {
      return casoSelecionado
        ? `${casoSelecionado.tipoProcesso.nome} — ${casoSelecionado.cliente.nome}`
        : "Processo vinculado";
    }
    return clienteSelecionado?.nome ?? "Cliente vinculado";
  }

  function selecionar(vinculo: VinculoEvento) {
    onChange(vinculo);
    setAberto(false);
  }

  const Icone = valor.tipo === "caso" ? Briefcase : valor.tipo === "cliente" ? User : Link2Off;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-start font-normal"
            aria-label="Vínculo do evento"
          />
        }
      >
        <Icone className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn("truncate", valor.tipo === "nenhum" && "text-muted-foreground")}>
          {rotulo()}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar processo ou cliente..."
            value={busca}
            onValueChange={setBusca}
          />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>

            <CommandGroup>
              <CommandItem value="nenhum" onSelect={() => selecionar({ tipo: "nenhum" })}>
                <Link2Off className="size-4 text-muted-foreground" />
                <span>Sem vínculo</span>
                {valor.tipo === "nenhum" ? <Check className="ml-auto size-4" /> : null}
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Processos">
              {(casos.data?.casos ?? []).map((caso) => (
                <CommandItem
                  key={caso.id}
                  value={`caso-${caso.id}`}
                  onSelect={() => selecionar({ tipo: "caso", id: caso.id })}
                >
                  <Briefcase className="size-4 text-muted-foreground" />
                  <span className="flex flex-col">
                    <span className="truncate">{caso.tipoProcesso.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {caso.cliente.nome}
                      {caso.numeroProcesso ? ` · ${caso.numeroProcesso}` : ""}
                    </span>
                  </span>
                  {valor.tipo === "caso" && valor.id === caso.id ? (
                    <Check className="ml-auto size-4" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading="Clientes">
              {(clientes.data?.clientes ?? []).map((cliente) => (
                <CommandItem
                  key={cliente.id}
                  value={`cliente-${cliente.id}`}
                  onSelect={() => selecionar({ tipo: "cliente", id: cliente.id })}
                >
                  <User className="size-4 text-muted-foreground" />
                  <span className="truncate">{cliente.nome}</span>
                  {valor.tipo === "cliente" && valor.id === cliente.id ? (
                    <Check className="ml-auto size-4" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
