import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Os comandos do Prisma rodam com cwd = apps/api (npm run -w @crm/api ...).
// .env.local tem prioridade sobre .env, igual ao main.ts. Na Vercel/CI as
// variáveis já vêm do ambiente e o dotenv não as sobrescreve.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
