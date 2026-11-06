interface ProgressoCampanhaProps {
  enviadas: number;
  falhas: number;
  total: number;
}

// Processada = a UAZAPI já tentou (enviada ou falhou). Retentativas podem fazer a soma
// passar do total: o valor é limitado, e o percentual arredonda para baixo para só
// mostrar 100% quando todas as mensagens terminaram.
export function ProgressoCampanha({ enviadas, falhas, total }: ProgressoCampanhaProps) {
  const processadas = Math.min(enviadas + falhas, total);
  const percentual = total > 0 ? Math.floor((processadas / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label="Progresso do disparo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentual}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${percentual}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {processadas} de {total} processadas · {percentual}%
      </p>
    </div>
  );
}
