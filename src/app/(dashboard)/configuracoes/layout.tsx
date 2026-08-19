import type { ReactNode } from "react";
import { ConfiguracoesNav } from "@/components/configuracoes/configuracoes-nav";

export default function ConfiguracoesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      <ConfiguracoesNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
