import { cn } from "@/lib/utils";

type Nivel = { label: string; className: string };

const NIVEIS: Nivel[] = [
  { label: "Fraca", className: "bg-destructive" },
  { label: "Média", className: "bg-brand/60" },
  { label: "Forte", className: "bg-brand" },
];

export function calcularForcaSenha(senha: string): { score: number } & Nivel {
  if (!senha) {
    return { score: 0, label: "", className: "" };
  }

  let score = 0;
  if (senha.length >= 8) score += 1;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) score += 1;
  if (/\d/.test(senha)) score += 1;
  if (/[^A-Za-z0-9]/.test(senha)) score += 1;

  const nivel = score <= 1 ? NIVEIS[0] : score <= 3 ? NIVEIS[1] : NIVEIS[2];
  return { score, ...nivel };
}

export function PasswordStrengthMeter({ senha }: { senha: string }) {
  const { score, label, className } = calcularForcaSenha(senha);

  if (!senha) {
    return null;
  }

  const segmentos = 4;

  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="flex gap-1">
        {Array.from({ length: segmentos }).map((_, index) => (
          <span
            key={index}
            className={cn("h-1.5 flex-1 rounded-full bg-muted", index < score && className)}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Força da senha: {label}</p>
    </div>
  );
}
