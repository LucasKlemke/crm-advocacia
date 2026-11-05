import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import "./fontes.css";
import { PaginaEmMigracao } from "@/paginas/pagina-em-migracao";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <PaginaEmMigracao caminhoNext="src/app/layout.tsx" />
  </StrictMode>
);
