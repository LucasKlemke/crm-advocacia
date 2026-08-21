import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // "archiver" (e "zip-stream"/"is-stream", suas deps internas) é publicado como
  // pacote ESM puro (package.json "type": "module"). Sem transpilePackages o Jest
  // (via next/jest) ignora node_modules por padrão e falha ao interpretar o
  // `import` do pacote — precisa ser transpilado como o resto do app.
  transpilePackages: ["archiver", "zip-stream", "compress-commons", "crc32-stream", "is-stream"],
};

export default nextConfig;
