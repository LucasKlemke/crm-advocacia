// Isolado num módulo próprio porque o Jest roda em CommonJS e não aceita `import.meta`:
// nos testes este arquivo é trocado por test/env-ws.ts (moduleNameMapper do jest.config).
// Vazio = API na mesma origem da página (proxy do Vite / Vercel Services).
export const urlBaseWs: string | undefined = import.meta.env.VITE_WS_URL || undefined;
