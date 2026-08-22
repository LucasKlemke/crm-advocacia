"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarDays, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSaudacaoRotativa } from "@/hooks/use-saudacao-rotativa";
import { formatarDataExtensa } from "@/lib/utils/data";

export interface DashboardSaudacaoCardProps {
  nome: string;
}

// Só o primeiro nome, normalizado — o nome cadastrado pode vir todo em caixa alta
// ou minúscula, e a saudação em destaque expõe isso.
function primeiroNome(nomeCompleto: string): string {
  const primeiro = nomeCompleto.trim().split(/\s+/)[0] ?? "";
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

// Tamanho do nome se ajusta ao comprimento — primeiros nomes longos estouram
// o max-w do card se ficarem sempre no maior tamanho.
function tamanhoNome(texto: string): string {
  if (texto.length <= 18) return "text-3xl sm:text-4xl";
  return "text-2xl sm:text-3xl";
}

// Faixa de boas-vindas acima dos cards de status: saudação como rótulo pequeno,
// nome em destaque, imagem sangrando pela direita com fade (mesmo idioma visual do
// AuthBrandingPanel) e uma barra escura com o contexto do dia sobre a imagem.
export function DashboardSaudacaoCard({ nome }: DashboardSaudacaoCardProps) {
  const { saudacao, subtitulo } = useSaudacaoRotativa();
  const nomeExibido = primeiroNome(nome);
  // Data no fuso do navegador: o card só é montado no cliente (depende do resumo
  // carregado), então não há SSR para divergir na hidratação.
  const [dataHoje] = useState(() => formatarDataExtensa(new Date()));

  return (
    <Card className="relative w-full max-w-2xl min-w-0 flex-1 gap-0 overflow-hidden rounded-2xl bg-linear-to-br from-brand/15 via-brand/5 to-transparent py-0 ring-foreground/10">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[58%] sm:w-[54%]">
        <Image
          src="/images/justica-estatua.webp"
          alt=""
          aria-hidden
          fill
          sizes="(min-width: 640px) 380px, 240px"
          className="object-cover object-top mask-[linear-gradient(to_right,transparent,black_45%)]"
        />
      </div>

      <div className="relative flex min-h-40 flex-col justify-between gap-6 p-5 sm:min-h-44 sm:p-6">
        <div className="max-w-[60%] sm:max-w-sm">
          <p className="text-xs font-medium tracking-wide text-muted-foreground sm:text-sm">
            {saudacao}
          </p>
          <p
            className={`font-heading mt-1 leading-tight font-normal text-balance text-foreground ${tamanhoNome(nomeExibido)}`}
          >
            {nomeExibido}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-full bg-overlay/50 px-4 py-2.5 text-xs text-brand-foreground backdrop-blur-sm sm:text-sm">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 opacity-70" aria-hidden />
            <span className="min-w-24">{dataHoje}</span>
          </span>
          <span className="flex items-center gap-2">
            <Scale className="size-4 shrink-0 opacity-70" aria-hidden />
            <span>{subtitulo}</span>
          </span>
        </div>
      </div>
    </Card>
  );
}
