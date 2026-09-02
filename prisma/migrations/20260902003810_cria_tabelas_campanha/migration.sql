-- CreateEnum
CREATE TYPE "StatusCampanha" AS ENUM ('agendada', 'enviando', 'pausada', 'concluida', 'excluindo');

-- AlterEnum
ALTER TYPE "EntidadeLog" ADD VALUE 'campanha';

-- CreateTable
CREATE TABLE "campanha" (
    "id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "instancia_whatsapp_id" TEXT,
    "criado_por_id" TEXT NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "mensagem_template" TEXT NOT NULL,
    "mapeamento_variaveis" JSONB,
    "coluna_numero" VARCHAR(120) NOT NULL,
    "arquivo_csv_nome" VARCHAR(255),
    "delay_min" INTEGER NOT NULL,
    "delay_max" INTEGER NOT NULL,
    "agendada_para" TIMESTAMP(3),
    "status" "StatusCampanha" NOT NULL DEFAULT 'agendada',
    "uazapi_folder_id" VARCHAR(100) NOT NULL,
    "total_destinatarios" INTEGER NOT NULL,
    "log_total" INTEGER NOT NULL DEFAULT 0,
    "log_sucesso" INTEGER NOT NULL DEFAULT 0,
    "log_falha" INTEGER NOT NULL DEFAULT 0,
    "log_entregue" INTEGER NOT NULL DEFAULT 0,
    "log_lido" INTEGER NOT NULL DEFAULT 0,
    "log_reproduzido" INTEGER NOT NULL DEFAULT 0,
    "sincronizado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanha_item" (
    "id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "campanha_id" TEXT NOT NULL,
    "linha" INTEGER NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "mensagem" TEXT NOT NULL,
    "variaveis" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campanha_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campanha_escritorio_id_created_at_idx" ON "campanha"("escritorio_id", "created_at");

-- CreateIndex
CREATE INDEX "campanha_instancia_whatsapp_id_idx" ON "campanha"("instancia_whatsapp_id");

-- CreateIndex
CREATE INDEX "campanha_item_campanha_id_idx" ON "campanha_item"("campanha_id");

-- CreateIndex
CREATE INDEX "campanha_item_escritorio_id_idx" ON "campanha_item"("escritorio_id");

-- CreateIndex
CREATE UNIQUE INDEX "campanha_item_campanha_id_linha_key" ON "campanha_item"("campanha_id", "linha");

-- AddForeignKey
ALTER TABLE "campanha" ADD CONSTRAINT "campanha_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanha" ADD CONSTRAINT "campanha_instancia_whatsapp_id_fkey" FOREIGN KEY ("instancia_whatsapp_id") REFERENCES "instancia_whatsapp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanha" ADD CONSTRAINT "campanha_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanha_item" ADD CONSTRAINT "campanha_item_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanha_item" ADD CONSTRAINT "campanha_item_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "campanha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
