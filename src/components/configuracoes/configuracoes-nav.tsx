"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const GRUPOS = [
  {
    label: "Empresa",
    items: [
      { href: "/configuracoes/escritorio", label: "Escritório", icon: Building2 },
      { href: "/configuracoes/membros", label: "Membros", icon: Users },
    ],
  },
];

// Nav lateral simples de /configuracoes — sem aninhar outro SidebarProvider.
export function ConfiguracoesNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6">
      {GRUPOS.map((grupo) => (
        <div key={grupo.label} className="flex flex-col gap-1">
          <span className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {grupo.label}
          </span>
          {grupo.items.map((item) => {
            const ativo = pathname?.startsWith(item.href) ?? false;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={ativo || undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  ativo && "bg-accent font-medium text-accent-foreground"
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
