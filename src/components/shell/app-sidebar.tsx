"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarClock,
  LayoutDashboard,
  MessageCircle,
  Scale,
  Settings,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavUsuario } from "@/components/shell/nav-usuario";

const NAV_ITEMS = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/casos", label: "Casos", icon: Briefcase },
  { href: "/prazos", label: "Prazos", icon: CalendarClock },
  { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export interface AppSidebarProps {
  usuario: { nome: string; email: string };
}

export function AppSidebar({ usuario }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-1.5 font-heading text-sm font-semibold"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <Scale className="size-4" />
          </span>
          <span className="group-data-[collapsible=icon]:hidden">CRM Advocacia</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const ativo =
                  item.href === "/" ? pathname === "/" : (pathname?.startsWith(item.href) ?? false);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={ativo}
                      tooltip={item.label}
                      render={
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUsuario usuario={usuario} />
      </SidebarFooter>
    </Sidebar>
  );
}
