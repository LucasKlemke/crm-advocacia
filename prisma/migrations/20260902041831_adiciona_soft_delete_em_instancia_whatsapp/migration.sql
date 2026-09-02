-- AlterTable
ALTER TABLE "instancia_whatsapp" ADD COLUMN     "soft_deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "instancia_whatsapp_escritorio_id_soft_deleted_at_idx" ON "instancia_whatsapp"("escritorio_id", "soft_deleted_at");
