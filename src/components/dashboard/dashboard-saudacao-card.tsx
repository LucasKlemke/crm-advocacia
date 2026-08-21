import Image from "next/image";
import { Card } from "@/components/ui/card";

export interface DashboardSaudacaoCardProps {
  nome: string;
}

// Faixa de boas-vindas acima dos cards de status — mesmo padrão visual de
// gradiente + imagem sangrando pela borda do AuthBrandingPanel (auth-branding-panel.tsx),
// aqui reaproveitando a estátua da Justiça já usada no branding do login.
export function DashboardSaudacaoCard({ nome }: DashboardSaudacaoCardProps) {
  return (
    <Card className="relative w-full max-w-2xl min-w-0 flex-1 overflow-hidden bg-linear-to-br from-brand/15 via-brand/5 to-transparent">
      <div className="flex min-h-24 items-center px-(--card-spacing) sm:min-h-28">
        <div className="max-w-[50%] sm:max-w-sm">
          <p className="font-heading text-xl leading-snug font-medium text-foreground sm:text-3xl">
            Olá, {nome}
          </p>
          <p className="mt-1 text-base text-muted-foreground">Aqui está o seu relatório.</p>
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
