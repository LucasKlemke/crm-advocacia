-- CreateEnum
CREATE TYPE "SexoCliente" AS ENUM ('masculino', 'feminino', 'outro');

-- CreateEnum
CREATE TYPE "EstadoCivilCliente" AS ENUM ('solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel');

-- AlterTable
ALTER TABLE "caso" ADD COLUMN     "numero_processo" VARCHAR(25);

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "estado_civil" "EstadoCivilCliente",
ADD COLUMN     "nacionalidade" VARCHAR(60),
ADD COLUMN     "nascimento" DATE,
ADD COLUMN     "nome_mae" VARCHAR(140),
ADD COLUMN     "nome_pai" VARCHAR(140),
ADD COLUMN     "profissao" VARCHAR(100),
ADD COLUMN     "sexo" "SexoCliente";
