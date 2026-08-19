"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarClock,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
    <Sidebar collapsible="none" className="h-full border-r border-sidebar-border">
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
