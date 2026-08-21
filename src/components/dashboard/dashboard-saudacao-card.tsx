import Image from "next/image";
import { Card } from "@/components/ui/card";
import { useSaudacaoRotativa } from "@/hooks/use-saudacao-rotativa";

export interface DashboardSaudacaoCardProps {
  nome: string;
}

// Tamanho do texto se ajusta ao comprimento do par sorteado (algumas saudações/subtítulos
// são bem mais longos que outros — sem isso o texto maior estoura o max-w do card).
function tamanhoTitulo(texto: string): string {
  if (texto.length <= 20) return "text-2xl sm:text-3xl";
  if (texto.length <= 35) return "text-xl sm:text-2xl";
  return "text-lg sm:text-xl";
}

function tamanhoSubtitulo(texto: string): string {
  if (texto.length <= 30) return "text-base";
  if (texto.length <= 40) return "text-sm";
  return "text-xs";
}

// Faixa de boas-vindas acima dos cards de status — mesmo padrão visual de
// gradiente + imagem sangrando pela borda do AuthBrandingPanel (auth-branding-panel.tsx),
// aqui reaproveitando a estátua da Justiça já usada no branding do login.
export function DashboardSaudacaoCard({ nome }: DashboardSaudacaoCardProps) {
  const { saudacao, subtitulo } = useSaudacaoRotativa();
  const titulo = `${saudacao}, ${nome}`;

  return (
    <Card className="relative w-full max-w-2xl min-w-0 flex-1 overflow-hidden bg-linear-to-br from-brand/15 via-brand/5 to-transparent">
      <div className="flex min-h-24 items-center px-(--card-spacing) sm:min-h-28">
        <div className="max-w-[65%] sm:max-w-md">
          <p
            className={`font-heading leading-snug font-normal text-foreground ${tamanhoTitulo(titulo)}`}
          >
            {titulo}
          </p>
          <p className={`mt-1 text-muted-foreground ${tamanhoSubtitulo(subtitulo)}`}>
            {subtitulo}
          </p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-2 w-40 sm:right-4 sm:w-56 lg:right-6 lg:w-72">
        <Image
          src="/images/justica-estatua.webp"
          alt=""
          aria-hidden
          fill
          sizes="(min-width: 1024px) 288px, (min-width: 640px) 224px, 160px"
          className="object-cover object-top"
        />
      </div>
    </Card>
  );
}
