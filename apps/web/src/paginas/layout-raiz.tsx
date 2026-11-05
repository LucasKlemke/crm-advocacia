import { Outlet, ScrollRestoration } from "react-router";

// Equivalente ao src/app/layout.tsx: <html>/<body>, fontes e metadata padrão vivem em
// index.html + main.tsx; aqui fica só o que depende do router. ScrollRestoration
// reproduz o "volta ao topo a cada navegação" do App Router (e respeita scroll: false).
export function LayoutRaiz() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
