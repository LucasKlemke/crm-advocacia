-- CreateEnum
CREATE TYPE "EscopoComentario" AS ENUM ('cliente');

-- CreateEnum
CREATE TYPE "EntidadeLog" AS ENUM ('cliente', 'comentario');

-- CreateEnum
CREATE TYPE "AcaoLog" AS ENUM ('criar', 'atualizar', 'excluir', 'restaurar');

-- CreateTable
CREATE TABLE "cliente" (
    "id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "nome" VARCHAR(140) NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "email" VARCHAR(140),
    "telefone" VARCHAR(20),
    "endereco" VARCHAR(255),
    "soft_deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentario" (
    "id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "escopo" "EscopoComentario" NOT NULL,
    "escopo_id" TEXT NOT NULL,
    "autor_usuario_id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "editado_em" TIMESTAMP(3),
    "soft_deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log" (
    "id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "acao" "AcaoLog" NOT NULL,
    "entidade" "EntidadeLog" NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "resumo" VARCHAR(255) NOT NULL,
    "dados" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cliente_escritorio_id_soft_deleted_at_idx" ON "cliente"("escritorio_id", "soft_deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_escritorio_id_cpf_key" ON "cliente"("escritorio_id", "cpf");

-- CreateIndex
CREATE INDEX "comentario_escritorio_id_escopo_escopo_id_created_at_idx" ON "comentario"("escritorio_id", "escopo", "escopo_id", "created_at");

-- CreateIndex
CREATE INDEX "log_escritorio_id_created_at_idx" ON "log"("escritorio_id", "created_at");

-- CreateIndex
CREATE INDEX "log_escritorio_id_entidade_entidade_id_idx" ON "log"("escritorio_id", "entidade", "entidade_id");

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentario" ADD CONSTRAINT "comentario_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentario" ADD CONSTRAINT "comentario_autor_usuario_id_fkey" FOREIGN KEY ("autor_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log" ADD CONSTRAINT "log_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log" ADD CONSTRAINT "log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
