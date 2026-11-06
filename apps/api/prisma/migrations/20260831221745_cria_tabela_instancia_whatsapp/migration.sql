-- CreateEnum
CREATE TYPE "StatusInstanciaWhatsapp" AS ENUM ('disconnected', 'connecting', 'connected', 'hibernated');

-- AlterEnum
ALTER TYPE "EntidadeLog" ADD VALUE 'instancia_whatsapp';

-- CreateTable
CREATE TABLE "instancia_whatsapp" (
    "id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "uazapi_instance_id" VARCHAR(100) NOT NULL,
    "uazapi_token" VARCHAR(255) NOT NULL,
    "status" "StatusInstanciaWhatsapp" NOT NULL DEFAULT 'disconnected',
    "numero_conectado" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instancia_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instancia_whatsapp_escritorio_id_idx" ON "instancia_whatsapp"("escritorio_id");

-- CreateIndex
CREATE UNIQUE INDEX "instancia_whatsapp_escritorio_id_nome_key" ON "instancia_whatsapp"("escritorio_id", "nome");

-- AddForeignKey
ALTER TABLE "instancia_whatsapp" ADD CONSTRAINT "instancia_whatsapp_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
