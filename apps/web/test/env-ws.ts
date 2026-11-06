// Substituto de src/lib/env-ws.ts nos testes (o Jest não entende `import.meta`): sem
// VITE_WS_URL, o socket usa a origem da página.
export const urlBaseWs: string | undefined = undefined;
