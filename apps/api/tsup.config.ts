import { defineConfig } from "tsup";

// Build de produção da API. esbuild (via tsup):
// - resolve os aliases do tsconfig (@dominio/*) e o @crm/compartilhado;
// - deixa externas as dependências do package.json (Nest, Prisma, bcrypt, AWS SDK,
//   newrelic...), que a Vercel rastreia e empacota junto com a função;
// - emite decorators legados (experimentalDecorators). NÃO emite design:paramtypes:
//   a injeção é sempre por token explícito (@Inject(TOKEN)), ver docs/arquitetura/migracao-nestjs.md.
export default defineConfig({
  entry: { main: "src/main.ts" },
  format: ["esm"],
  platform: "node",
  target: "node24",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  bundle: true,
  // O compartilhado é só TypeScript-fonte (exports → .ts), então precisa ser embutido.
  noExternal: [/^@crm\//],
  tsconfig: "tsconfig.json",
});
