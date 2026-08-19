import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

// Centraliza o conteúdo de páginas de formulário/configuração numa largura de leitura confortável.
export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={cn("mx-auto flex w-full max-w-lg flex-col gap-8", className)}>{children}</div>;
}
