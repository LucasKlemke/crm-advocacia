import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { membroService } from "@/services/membro.service";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { EscritorioSwitcher } from "@/components/shell/escritorio-switcher";

// Sem SessionProvider — sessão é lida só no server via auth(); mutações do client
// (ex. EscritorioSwitcher) chamam a API e disparam router.refresh().
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (!session.user.escritorioId) {
    redirect("/onboarding");
  }

  const escritorios = await membroService.listarEscritoriosDoUsuario(session.user.id);

  return (
    <SidebarProvider>
      <AppSidebar
        usuario={{ nome: session.user.name ?? "", email: session.user.email ?? "" }}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <EscritorioSwitcher
            escritorios={escritorios.map(({ escritorio }) => ({
              id: escritorio.id,
              nome: escritorio.nome,
            }))}
            ativoId={session.user.escritorioId}
          />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
