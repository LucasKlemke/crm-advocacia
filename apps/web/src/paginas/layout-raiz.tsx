import { Outlet, ScrollRestoration } from "react-router";

// Layout raiz das rotas: <html>/<body>, fontes e metadata padrão vivem em
// index.html + main.tsx; aqui fica só o que depende do router. ScrollRestoration
// volta ao topo a cada navegação.
export function LayoutRaiz() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
