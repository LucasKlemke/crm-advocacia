import type { ReactNode } from "react";
import { ConfiguracoesNav } from "@/components/configuracoes/configuracoes-nav";

export default function ConfiguracoesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid flex-1 gap-8 md:grid-cols-[220px_1fr]">
      <div className="md:border-r md:border-border md:pr-6">
        <ConfiguracoesNav />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
