import type { ReactNode } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { membroService } from "@/services/membro.service";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { EscritorioSwitcher } from "@/components/shell/escritorio-switcher";
import { formatarDataExtensa } from "@/lib/utils/data";

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
    <div className="flex h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <Link href="/" className="flex items-center" aria-label="CRM Advocacia">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <Scale className="size-4" />
          </span>
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <EscritorioSwitcher
          escritorios={escritorios.map(({ escritorio }) => ({
            id: escritorio.id,
            nome: escritorio.nome,
          }))}
          ativoId={session.user.escritorioId}
        />
        <span className="ml-auto text-sm text-muted-foreground">
          {formatarDataExtensa(new Date())}
        </span>
      </header>
      <SidebarProvider className="min-h-0 flex-1">
        <AppSidebar
          usuario={{ nome: session.user.name ?? "", email: session.user.email ?? "" }}
        />
        <SidebarInset className="min-h-0 overflow-y-auto">
          <main className="flex flex-1 flex-col gap-4 p-4">
            <QueryProvider escritorioId={session.user.escritorioId}>{children}</QueryProvider>
          </main>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </div>
  );
}
