-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntidadeLog" ADD VALUE 'caso';
ALTER TYPE "EntidadeLog" ADD VALUE 'status';

-- AlterEnum
ALTER TYPE "EscopoComentario" ADD VALUE 'caso';

-- CreateTable
CREATE TABLE "tipo_status" (
    "id" TEXT NOT NULL,
    "chave" VARCHAR(30) NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "icone" VARCHAR(60) NOT NULL,
    "cor" VARCHAR(9) NOT NULL,
    "descricao" VARCHAR(255),
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "tipo_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status" (
    "id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "tipo_status_id" TEXT NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "icone" VARCHAR(60) NOT NULL,
    "cor" VARCHAR(9) NOT NULL,
    "descricao" VARCHAR(255),
    "ordem" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caso" (
    "id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "status_id" TEXT NOT NULL,
    "responsavel_membro_id" TEXT,
    "titulo" VARCHAR(140) NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(12,2),
    "arquivado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipo_status_chave_key" ON "tipo_status"("chave");

-- CreateIndex
CREATE INDEX "status_escritorio_id_ordem_idx" ON "status"("escritorio_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "status_escritorio_id_nome_key" ON "status"("escritorio_id", "nome");

-- CreateIndex
CREATE INDEX "caso_escritorio_id_arquivado_status_id_created_at_idx" ON "caso"("escritorio_id", "arquivado", "status_id", "created_at");

-- CreateIndex
CREATE INDEX "caso_escritorio_id_cliente_id_idx" ON "caso"("escritorio_id", "cliente_id");

-- CreateIndex
CREATE INDEX "caso_escritorio_id_responsavel_membro_id_idx" ON "caso"("escritorio_id", "responsavel_membro_id");

-- AddForeignKey
ALTER TABLE "status" ADD CONSTRAINT "status_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status" ADD CONSTRAINT "status_tipo_status_id_fkey" FOREIGN KEY ("tipo_status_id") REFERENCES "tipo_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caso" ADD CONSTRAINT "caso_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caso" ADD CONSTRAINT "caso_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caso" ADD CONSTRAINT "caso_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caso" ADD CONSTRAINT "caso_responsavel_membro_id_fkey" FOREIGN KEY ("responsavel_membro_id") REFERENCES "membro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: tipos de status padronizados do funil, presentes em todo banco (RN — plano.md).
-- Referência global, não pertence a nenhum escritório; apenas o desenvolvedor administrador
-- do sistema altera esta tabela (via migration), nunca por endpoint de escrita.
INSERT INTO "tipo_status" ("id", "chave", "nome", "icone", "cor", "descricao", "ordem") VALUES
    (gen_random_uuid(), 'nova_conversa', 'Nova conversa', 'MessageCircle', '#64748b', 'Primeiro contato com o cliente, ainda sem qualificação.', 1),
    (gen_random_uuid(), 'analise', 'Análise', 'Search', '#f59e0b', 'Caso em avaliação inicial pelo escritório.', 2),
    (gen_random_uuid(), 'qualificado', 'Qualificado', 'CircleCheck', '#0ea5e9', 'Cliente e caso qualificados para prosseguir no funil.', 3),
    (gen_random_uuid(), 'proposta', 'Proposta', 'FileText', '#8b5cf6', 'Proposta ou contrato enviado ao cliente.', 4),
    (gen_random_uuid(), 'sucesso', 'Sucesso', 'Trophy', '#10b981', 'Caso fechado com sucesso.', 5),
    (gen_random_uuid(), 'perda', 'Perda', 'CircleX', '#f43f5e', 'Caso perdido ou cliente não seguiu adiante.', 6)
ON CONFLICT ("chave") DO NOTHING;
