import Image from "next/image";
import { cn } from "@/lib/utils";

export interface EmConstrucaoProps {
  titulo: string;
  descricao?: string;
  className?: string;
}

// Estado padrão das páginas ainda não implementadas: reaproveita a estátua da Justiça
// das telas de login/cadastro para manter a identidade visual do produto.
export function EmConstrucao({ titulo, descricao, className }: EmConstrucaoProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      <Image
        src="/images/justica-estatua.webp"
        alt="Estátua da Justiça, com balança e venda nos olhos"
        width={320}
        height={320}
        // A estátua está a 68% da largura da arte (o resto é transparente): o deslocamento
        // horizontal compensa isso e a deixa opticamente centralizada, sem cortar nada.
        className="size-40 -translate-x-[18.3%] object-contain"
      />
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Em construção
        </p>
        <h2 className="text-xl font-semibold text-balance">{titulo}</h2>
        {descricao ? (
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">{descricao}</p>
        ) : null}
      </div>
    </div>
  );
}
