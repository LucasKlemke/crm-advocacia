import { useEffect } from "react";
import { siteConfig } from "@/lib/site-config";

export function montarTitulo(titulo?: string): string {
  return titulo ? `${titulo} | ${siteConfig.name}` : siteConfig.name;
}

// Define o título da aba com o template "%s | CRM Advocacia".
// Cada página chama no topo: useTituloPagina("Clientes").
export function useTituloPagina(titulo?: string): void {
  useEffect(() => {
    const anterior = document.title;
    document.title = montarTitulo(titulo);
    return () => {
      document.title = anterior;
    };
  }, [titulo]);
}
