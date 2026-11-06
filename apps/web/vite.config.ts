import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

// Mesma origem no browser: /api vai para a API Nest pelo proxy do Vite (dev e preview).
// O cookie httpOnly crm_sessao continua first-party, sem CORS
// (docs/arquitetura/migracao-nestjs.md). `ws: true` repassa também o upgrade do
// WebSocket /api/ws (tempo real das campanhas), na mesma origem e com o mesmo Origin.
const proxyDaApi = {
  "/api": {
    target: process.env.API_NEST_URL ?? "http://localhost:3001",
    changeOrigin: false,
    ws: true,
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\//, replacement: caminho("./src/") },
    ],
  },
  server: { port: 5173, strictPort: true, proxy: proxyDaApi },
  preview: { port: 5173, strictPort: true, proxy: proxyDaApi },
});
