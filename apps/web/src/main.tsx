import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PaginaEmMigracao } from "@/paginas/pagina-em-migracao";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <PaginaEmMigracao caminhoNext="src/app/layout.tsx" />
  </StrictMode>
);
