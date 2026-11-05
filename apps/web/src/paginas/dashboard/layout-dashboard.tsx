import { Outlet } from "react-router";

// PROVISÓRIO (Fase 4, parte A). A parte B porta aqui o shell de
// src/app/(dashboard)/layout.tsx: header com marca, EscritorioSwitcher (lista de
// escritórios do usuário) e HeaderData; SidebarProvider + AppSidebar com NavUsuario
// (nome/e-mail de useSessao()). Sessão, redirect e QueryProvider já vêm da
// RotaProtegida; o Toaster é global (app.tsx) — não renderizar outro aqui.
export function LayoutDashboard() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <Outlet />
    </main>
  );
}
