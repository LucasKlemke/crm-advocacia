-- CreateEnum
CREATE TYPE "EscopoDocumento" AS ENUM ('cliente', 'caso');

-- CreateEnum
CREATE TYPE "TipoArquivo" AS ENUM ('pdf', 'docx', 'jpg', 'png', 'jpeg');

-- AlterEnum
ALTER TYPE "EntidadeLog" ADD VALUE 'documento';

-- CreateTable
CREATE TABLE "documento" (
    "id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "escopo" "EscopoDocumento" NOT NULL,
    "escopo_id" TEXT NOT NULL,
    "autor_membro_id" TEXT NOT NULL,
    "nome_original" VARCHAR(255) NOT NULL,
    "tipo_arquivo" "TipoArquivo" NOT NULL,
    "tamanho_kb" INTEGER NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "soft_deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documento_escritorio_id_escopo_escopo_id_soft_deleted_at_idx" ON "documento"("escritorio_id", "escopo", "escopo_id", "soft_deleted_at");

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_autor_membro_id_fkey" FOREIGN KEY ("autor_membro_id") REFERENCES "membro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
