/*
  Warnings:

  - Added the required column `expira_em` to the `convite` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Convites existentes (pre-expiracao) recebem 7 dias a partir de agora como
-- prazo de validade; novas linhas sempre setam expira_em explicitamente.
ALTER TABLE "convite" ADD COLUMN     "expira_em" TIMESTAMP(3);
UPDATE "convite" SET "expira_em" = NOW() + INTERVAL '7 days' WHERE "expira_em" IS NULL;
ALTER TABLE "convite" ALTER COLUMN "expira_em" SET NOT NULL;
