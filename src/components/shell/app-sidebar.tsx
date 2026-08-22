"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Smartphone,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavUsuario } from "@/components/shell/nav-usuario";

const NAV_GROUPS = [
  {
    label: "CRM",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/casos", label: "Processos", icon: Briefcase },
      { href: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    label: "Disparo",
    items: [
      { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
      { href: "/instancias", label: "Instâncias", icon: Smartphone },
    ],
  },
  {
    label: "Configurações",
    items: [{ href: "/configuracoes", label: "Configurações", icon: Settings }],
  },
];

export interface AppSidebarProps {
  usuario: { nome: string; email: string };
}

export function AppSidebar({ usuario }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="none" className="h-full border-r border-sidebar-border">
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const ativo =
                    item.href === "/"
                      ? pathname === "/"
                      : (pathname?.startsWith(item.href) ?? false);
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
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUsuario usuario={usuario} />
      </SidebarFooter>
    </Sidebar>
  );
}
