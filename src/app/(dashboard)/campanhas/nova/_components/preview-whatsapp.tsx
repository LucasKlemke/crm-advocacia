"use client";

import { ArrowLeft, EllipsisVertical, Phone, Video } from "lucide-react";
import { AvatarIniciais } from "@/components/shared/avatar-iniciais";
import { cn } from "@/lib/utils";
import { segmentarFormatacaoWhatsapp } from "@/lib/utils/whatsapp-formatacao";

export interface PreviewWhatsappProps {
  mensagem: string;
  // Quem envia: a instância escolhida no passo anterior. É o que o destinatário vê no
  // topo da conversa, então mostrar aqui confirma de qual número a campanha vai sair.
  remetenteNome: string;
  remetenteFoto?: string | null;
}

const CLASSE_ESTILO = {
  negrito: "font-semibold",
  italico: "italic",
  riscado: "line-through",
  mono: "font-mono text-[0.9em]",
} as const;

// Rabinho da bolha, no canto superior esquerdo. SVG e não triângulo de borda CSS: o truque
// das bordas rende um bloco visível quando a cor vem de custom property, e o recorte curvo
// do WhatsApp não sai de borda nenhuma. `currentColor` herda a cor da bolha, então o
// rabinho acompanha o tema sem repetir o token.
function RabinhoBolha() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 8 13"
      className="absolute top-0 -left-2 h-[13px] w-2 text-zap-bolha-recebida"
      fill="currentColor"
    >
      <path d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568Z" />
    </svg>
  );
}

function TextoFormatado({ texto }: { texto: string }) {
  return (
    <>
      {segmentarFormatacaoWhatsapp(texto).map((segmento, indice) => (
        <span
          key={indice}
          className={cn(segmento.estilos.map((estilo) => CLASSE_ESTILO[estilo]))}
        >
          {segmento.texto}
        </span>
      ))}
    </>
  );
}

export function PreviewWhatsapp({
  mensagem,
  remetenteNome,
  remetenteFoto,
}: PreviewWhatsappProps) {
  const agora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
      <div className="flex items-center gap-3 bg-zap-cabecalho px-3 py-2.5 text-zap-cabecalho-texto">
        <ArrowLeft className="size-5 shrink-0 opacity-70" aria-hidden />
        <AvatarIniciais nome={remetenteNome} avatarUrl={remetenteFoto} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{remetenteNome}</p>
          <p className="truncate text-xs opacity-60">online</p>
        </div>
        <Video className="size-5 shrink-0 opacity-70" aria-hidden />
        <Phone className="size-5 shrink-0 opacity-70" aria-hidden />
        <EllipsisVertical className="size-5 shrink-0 opacity-70" aria-hidden />
      </div>

      <div
        className="flex min-h-32 flex-col justify-end gap-2 bg-zap-fundo px-4 py-5 pl-6"
        // O padrão de rabiscos é token porque muda entre claro e escuro (traço preto x branco).
        style={{ backgroundImage: "var(--zap-rabiscos)" }}
      >
        {/* Bolha recebida (esquerda): a prévia mostra a conversa do ponto de vista do
            cliente, que é quem precisa entender a mensagem. */}
        <div className="flex">
          <div className="relative max-w-[85%] rounded-lg rounded-tl-none bg-zap-bolha-recebida px-2.5 py-1.5 shadow-sm">
            <RabinhoBolha />
            <p className="text-sm whitespace-pre-wrap text-zap-texto">
              <TextoFormatado texto={mensagem} />
              {/* Espaço reservado para o horário não cobrir a última linha do texto —
                  mesmo truque do WhatsApp. */}
              <span className="float-right ml-2 translate-y-1.5 text-[0.68rem] text-zap-meta">
                {agora}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
