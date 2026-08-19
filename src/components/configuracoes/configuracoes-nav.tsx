"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/configuracoes/escritorio", label: "Escritório" },
  { href: "/configuracoes/usuarios", label: "Usuários" },
];

// Nav lateral simples de /configuracoes — sem aninhar outro SidebarProvider.
export function ConfiguracoesNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const ativo = pathname?.startsWith(item.href) ?? false;
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={ativo || undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              ativo && "bg-muted font-medium text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
