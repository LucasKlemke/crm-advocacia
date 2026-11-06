-- CreateEnum
CREATE TYPE "RoleMembro" AS ENUM ('owner', 'admin', 'padrao');

-- CreateTable
CREATE TABLE "escritorio" (
    "id" TEXT NOT NULL,
    "nome" VARCHAR(140) NOT NULL,
    "oab_responsavel" VARCHAR(20),
    "telefone_whatsapp" VARCHAR(20),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escritorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nome" VARCHAR(140) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "avatar_url" VARCHAR(500),
    "oab" VARCHAR(20),
    "telefone" VARCHAR(20),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membro" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "role" "RoleMembro" NOT NULL DEFAULT 'padrao',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convite" (
    "id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "RoleMembro" NOT NULL DEFAULT 'padrao',
    "criado_por_usuario_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "convite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "membro_escritorio_id_idx" ON "membro"("escritorio_id");

-- CreateIndex
CREATE INDEX "membro_usuario_id_idx" ON "membro"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "membro_usuario_id_escritorio_id_key" ON "membro"("usuario_id", "escritorio_id");

-- CreateIndex
CREATE INDEX "convite_email_idx" ON "convite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "convite_escritorio_id_email_key" ON "convite"("escritorio_id", "email");

-- AddForeignKey
ALTER TABLE "membro" ADD CONSTRAINT "membro_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membro" ADD CONSTRAINT "membro_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convite" ADD CONSTRAINT "convite_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convite" ADD CONSTRAINT "convite_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
