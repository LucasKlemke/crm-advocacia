-- CreateEnum
CREATE TYPE "RoleUsuario" AS ENUM ('titular', 'colaborador');

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
    "escritorio_id" TEXT NOT NULL,
    "nome" VARCHAR(140) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "oab" VARCHAR(20),
    "telefone" VARCHAR(20),
    "role" "RoleUsuario" NOT NULL DEFAULT 'titular',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_escritorio_id_idx" ON "usuario"("escritorio_id");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
