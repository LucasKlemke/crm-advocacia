# Imagem de produção da API (ECS Fargate, linux/arm64). Contexto de build: a RAIZ do monorepo.
#   docker build -f apps/api/Dockerfile -t crm-api .
# A migration NÃO roda no start: o deploy a executa como run-task separada com
# `npm run migrar -w @crm/api` (por isso o Prisma CLI e o schema ficam na imagem final).

# ---- build: instala tudo, gera o Prisma Client e compila com tsup
FROM node:24-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Camada de dependências: só os manifests + schema (o postinstall roda `prisma generate`),
# então o cache só invalida quando o lock/manifests/schema mudam.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/compartilhado/package.json packages/compartilhado/
COPY apps/api/prisma apps/api/prisma
RUN npm ci

COPY packages/compartilhado packages/compartilhado
COPY apps/api apps/api
RUN npm run prisma:generate -w @crm/api && npm run build -w @crm/api

# ---- runtime: só dependências de produção da API (inclui `prisma` CLI para o migrar)
FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/compartilhado/package.json packages/compartilhado/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --omit=dev -w @crm/api --include-workspace-root=false \
  && npm cache clean --force

COPY apps/api/prisma.config.ts apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
RUN chown -R node:node /app

USER node
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "--enable-source-maps", "--import", "./dist/instrumentacao.js", "dist/main.js"]
