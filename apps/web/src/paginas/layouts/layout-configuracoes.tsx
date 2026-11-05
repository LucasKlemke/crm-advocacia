import { Outlet } from "react-router";
import { ConfiguracoesNav } from "@/components/configuracoes/configuracoes-nav";

export function LayoutConfiguracoes() {
  return (
    <div className="grid flex-1 gap-8 md:grid-cols-[220px_1fr]">
      <div className="md:border-r md:border-border md:pr-6">
        <ConfiguracoesNav />
      </div>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
