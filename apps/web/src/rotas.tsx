import { Navigate, type RouteObject } from "react-router";
import { LayoutRaiz } from "@/paginas/layout-raiz";
import { RotaProtegida } from "@/paginas/rota-protegida";
import { PaginaEmMigracao } from "@/paginas/pagina-em-migracao";
import { PaginaNaoEncontrada } from "@/paginas/pagina-nao-encontrada";
import { LayoutAuth } from "@/paginas/layouts/layout-auth";
import { PaginaLogin } from "@/paginas/login";
import { PaginaCadastro } from "@/paginas/cadastro";
import { PaginaOnboarding } from "@/paginas/onboarding";
import { PaginaInicio } from "@/paginas/inicio";
import { PaginaClientes } from "@/paginas/clientes";
import { PaginaCasos } from "@/paginas/casos";
import { PaginaAgenda } from "@/paginas/agenda";
import { PaginaCampanhas } from "@/paginas/campanhas/lista";
import { PaginaNovaCampanha } from "@/paginas/campanhas/nova";
import { PaginaCampanha } from "@/paginas/campanhas/detalhe";
import { PaginaInstancias } from "@/paginas/instancias";
import { PaginaPerfil } from "@/paginas/perfil";
import { LayoutDashboard } from "@/paginas/layouts/layout-dashboard";
import { LayoutConfiguracoes } from "@/paginas/layouts/layout-configuracoes";

// Placeholder da parte A: a parte B troca cada chamada pela página portada.
const emMigracao = (caminhoNext: string) => <PaginaEmMigracao caminhoNext={caminhoNext} />;

// Espelha src/app do Next: route groups viram rotas de layout sem `path`; [id] vira :id.
// Mapa completo Next → rota → arquivo no plano da Fase 4.
export const rotas: RouteObject[] = [
  {
    element: <LayoutRaiz />,
    children: [
      // (auth) — públicas
      {
        element: <LayoutAuth />,
        children: [
          { path: "login", element: <PaginaLogin /> },
          { path: "cadastro", element: <PaginaCadastro /> },
        ],
      },
      // (onboarding) — exige sessão, ainda sem escritório
      {
        element: <RotaProtegida exigirEscritorio={false} />,
        children: [
          { path: "onboarding", element: <PaginaOnboarding /> },
        ],
      },
      // (dashboard) — sessão + escritório ativo
      {
        element: <RotaProtegida />,
        children: [
          {
            element: <LayoutDashboard />,
            children: [
              { index: true, element: <PaginaInicio /> },
              { path: "clientes", element: <PaginaClientes /> },
              { path: "casos", element: <PaginaCasos /> },
              { path: "agenda", element: <PaginaAgenda /> },
              {
                path: "campanhas",
                children: [
                  { index: true, element: <PaginaCampanhas /> },
                  { path: "nova", element: <PaginaNovaCampanha /> },
                  { path: ":id", element: <PaginaCampanha /> },
                ],
              },
              { path: "instancias", element: <PaginaInstancias /> },
              { path: "perfil", element: <PaginaPerfil /> },
              {
                path: "configuracoes",
                element: <LayoutConfiguracoes />,
                children: [
                  { index: true, element: <Navigate replace to="/configuracoes/escritorio" /> },
                  {
                    path: "escritorio",
                    element: emMigracao("src/app/(dashboard)/configuracoes/escritorio/page.tsx"),
                  },
                  {
                    path: "membros",
                    element: emMigracao("src/app/(dashboard)/configuracoes/membros/page.tsx"),
                  },
                  {
                    path: "status",
                    element: emMigracao("src/app/(dashboard)/configuracoes/status/page.tsx"),
                  },
                  {
                    path: "tipos-processo",
                    element: emMigracao("src/app/(dashboard)/configuracoes/tipos-processo/page.tsx"),
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <PaginaNaoEncontrada /> },
    ],
  },
];
