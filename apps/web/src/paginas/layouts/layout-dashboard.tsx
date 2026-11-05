import { Link, Outlet } from "react-router";
import { Scale } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { QueryProvider } from "@/components/providers/query-provider";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { EscritorioSwitcher } from "@/components/shell/escritorio-switcher";
import { HeaderData } from "@/components/shell/header-data";
import { formatarDataExtensa } from "@/lib/utils/data";
import { useMeusEscritorios } from "@/hooks/use-escritorios";
import { useSessaoDoEscritorio, type SessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";

// Shell das telas autenticadas. O Toaster é global (Provedores, Task 4.8): não renderizar outro aqui.
// Fica sob <RotaProtegida>, que já redirecionou quem não
// tem sessão (/login) ou escritório ativo (/onboarding).
//
// O QueryProvider nasce por escritório: trocar de tenant (trocarEscritorio → novo
// escritorioId na sessão) cria um client novo e remonta a árvore, descartando o cache
// do escritório anterior. O header fica dentro dele de propósito, porque a lista do
// switcher também é dado da sessão atual.
export function LayoutDashboard() {
  const sessao = useSessaoDoEscritorio();

  return (
    <QueryProvider escritorioId={sessao.escritorioId}>
      <Shell sessao={sessao} />
    </QueryProvider>
  );
}

function Shell({ sessao }: { sessao: SessaoDoEscritorio }) {
  // Enquanto a lista não chega, o switcher mostra o rótulo padrão. Uma falha aqui não
  // derruba a tela: só o switcher fica sem opções.
  const { data: escritorios } = useMeusEscritorios();

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <Link to="/" className="flex items-center" aria-label="CRM Advocacia">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <Scale className="size-4" />
          </span>
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <EscritorioSwitcher
          escritorios={(escritorios ?? []).map(({ id, nome }) => ({ id, nome }))}
          ativoId={sessao.escritorioId}
        />
        <HeaderData data={formatarDataExtensa(new Date())} />
      </header>
      <SidebarProvider className="min-h-0 flex-1">
        <AppSidebar usuario={{ nome: sessao.usuario.nome, email: sessao.usuario.email }} />
        <SidebarInset className="min-h-0 overflow-y-auto">
          <main className="flex flex-1 flex-col gap-4 p-4">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
