import type { NextConfig } from "next";

// Migração strangler para NestJS (docs/arquitetura/migracao-nestjs.md): cada grupo de
// rota listado aqui é respondido pela API em apps/api. O browser continua falando só
// com o Next (mesma origem), então o cookie de sessão segue sem CORS.
const ROTAS_NA_API_NEST = [
  "status",
  "tipos-status",
  "tipos-processo",
  "clientes",
  "casos",
  "comentarios",
  "perfil",
  "membros",
  "convites",
  "dashboard",
  "eventos",
  "documentos",
  "instancias",
  "campanhas",
  "webhooks/uazapi",
  // Fase 3: sessão própria (crm_sessao) — login/logout/sessão, cadastro, troca e
  // criação de escritório. Com "auth" aqui, /api/auth/* do NextAuth fica inalcançável.
  "auth",
  "cadastro",
  "sessao",
  "escritorios",
];

const nextConfig: NextConfig = {
  // "archiver" (e "zip-stream"/"is-stream", suas deps internas) é publicado como
  // pacote ESM puro (package.json "type": "module"). Sem transpilePackages o Jest
  // (via next/jest) ignora node_modules por padrão e falha ao interpretar o
  // `import` do pacote — precisa ser transpilado como o resto do app.
  transpilePackages: ["archiver", "zip-stream", "compress-commons", "crc32-stream", "is-stream", "jose"],

  async rewrites() {
    const api = process.env.API_NEST_URL;
    if (!api) {
      return { beforeFiles: [], afterFiles: [], fallback: [] };
    }
    return {
      beforeFiles: ROTAS_NA_API_NEST.flatMap((rota) => [
        { source: `/api/${rota}`, destination: `${api}/api/${rota}` },
        { source: `/api/${rota}/:caminho*`, destination: `${api}/api/${rota}/:caminho*` },
      ]),
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
