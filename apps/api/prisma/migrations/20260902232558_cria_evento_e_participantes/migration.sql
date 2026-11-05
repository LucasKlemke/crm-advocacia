-- CreateEnum
CREATE TYPE "ModalidadeEvento" AS ENUM ('presencial', 'online');

-- AlterEnum
ALTER TYPE "EntidadeLog" ADD VALUE 'evento';

-- CreateTable
CREATE TABLE "evento" (
    "id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "titulo" VARCHAR(140) NOT NULL,
    "descricao" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "dia_inteiro" BOOLEAN NOT NULL DEFAULT false,
    "modalidade" "ModalidadeEvento" NOT NULL,
    "local" VARCHAR(255),
    "link_reuniao" VARCHAR(500),
    "cliente_id" TEXT,
    "caso_id" TEXT,
    "criado_por_membro_id" TEXT NOT NULL,
    "soft_deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_participante" (
    "id" TEXT NOT NULL,
    "evento_id" TEXT NOT NULL,
    "membro_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_participante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evento_escritorio_id_inicio_idx" ON "evento"("escritorio_id", "inicio");

-- CreateIndex
CREATE INDEX "evento_escritorio_id_soft_deleted_at_inicio_idx" ON "evento"("escritorio_id", "soft_deleted_at", "inicio");

-- CreateIndex
CREATE INDEX "evento_escritorio_id_caso_id_idx" ON "evento"("escritorio_id", "caso_id");

-- CreateIndex
CREATE INDEX "evento_escritorio_id_cliente_id_idx" ON "evento"("escritorio_id", "cliente_id");

-- CreateIndex
CREATE INDEX "evento_escritorio_id_criado_por_membro_id_idx" ON "evento"("escritorio_id", "criado_por_membro_id");

-- CreateIndex
CREATE INDEX "evento_participante_membro_id_idx" ON "evento_participante"("membro_id");

-- CreateIndex
CREATE UNIQUE INDEX "evento_participante_evento_id_membro_id_key" ON "evento_participante"("evento_id", "membro_id");

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_criado_por_membro_id_fkey" FOREIGN KEY ("criado_por_membro_id") REFERENCES "membro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_participante" ADD CONSTRAINT "evento_participante_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_participante" ADD CONSTRAINT "evento_participante_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
