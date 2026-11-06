export interface ConfigTempoReal {
  // Desligado no deploy Supabase (Vercel Functions não mantém processo vivo): sem polling,
  // sem servidor WS e o webhook assinado só responde.
  habilitado: boolean;
  // Intervalo do polling de fallback no servidor; 0 desliga.
  pollingMs: number;
  // Origens da SPA aceitas no upgrade do WebSocket, além da própria origem da API.
  origensWeb: string[];
}

export const POLLING_PADRAO_MS = 15000;

function lerPollingMs(valor: string | undefined): number {
  const texto = valor?.trim();
  if (!texto) return POLLING_PADRAO_MS;
  const numero = Number(texto);
  // Valor inválido não desliga nada por acidente: volta ao padrão. Só "0" desliga.
  return Number.isInteger(numero) && numero >= 0 ? numero : POLLING_PADRAO_MS;
}

// O header Origin nunca tem barra final; normalizar aqui evita uma recusa 4403 por um
// WEB_ORIGINS escrito com "https://site/".
function lerOrigens(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((origem) => origem.trim().replace(/\/+$/, ""))
    .filter((origem) => origem.length > 0);
}

export function lerConfigTempoReal(env: NodeJS.ProcessEnv = process.env): ConfigTempoReal {
  return {
    // Padrão ligado: só o valor explícito "false" desliga.
    habilitado: env.TEMPO_REAL_HABILITADO?.trim().toLowerCase() !== "false",
    pollingMs: lerPollingMs(env.TEMPO_REAL_POLLING_MS),
    origensWeb: lerOrigens(env.WEB_ORIGINS),
  };
}
