-- CreateEnum
CREATE TYPE "origem_log" AS ENUM ('usuario', 'sistema');

-- AlterTable
ALTER TABLE "log" ADD COLUMN     "origem" "origem_log" NOT NULL DEFAULT 'usuario',
ALTER COLUMN "usuario_id" DROP NOT NULL;
