// Portas e segredos do ambiente E2E, compartilhados pelo playwright.config.ts e pelos
// specs. Só valores de teste: nada aqui vale fora do e2e.

// A porta da API é configurável para rodar o e2e numa máquina onde a 3001 já está em
// uso; o padrão continua 3001, o mesmo do CI.
export const PORTA_API_E2E = Number(process.env.E2E_API_PORT ?? 3001);
export const PORTA_UAZAPI_FALSA = Number(process.env.E2E_UAZAPI_PORT ?? 3999);

export const URL_UAZAPI_FALSA = `http://localhost:${PORTA_UAZAPI_FALSA}`;
export const SEGREDO_WEBHOOK_E2E = "segredo-e2e";
