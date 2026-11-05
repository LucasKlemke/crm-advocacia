import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

// Mesma origem no browser: /api vai para a API Nest pelo proxy do Vite (dev e preview).
// O cookie httpOnly crm_sessao continua first-party, sem CORS, como era com os rewrites
// do Next (docs/arquitetura/migracao-nestjs.md).
const proxyDaApi = {
  "/api": { target: process.env.API_NEST_URL ?? "http://localhost:3001", changeOrigin: false },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // public/ continua na raiz enquanto o Next existir; a parte B move para apps/web/public.
  publicDir: caminho("../../public"),
  resolve: {
    alias: [
      // Domínio puro (tipos, utils, permissões) até a Fase 5 mover src/ para apps/api.
      { find: /^@dominio\//, replacement: caminho("../../src/") },
      { find: /^@\//, replacement: caminho("./src/") },
    ],
  },
  server: { port: 5173, strictPort: true, proxy: proxyDaApi },
  preview: { port: 5173, strictPort: true, proxy: proxyDaApi },
});
