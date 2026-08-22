-- Substitui o título livre de `caso` por um `tipo_processo` cadastrado pelo escritório.
--
-- O título nunca foi padronizado: cada usuário digitava o seu, então "Juros abusivos" e
-- "juros abusivo" eram processos sem nenhuma relação para o banco. O tipo de processo tem
-- a mesma anatomia de `status` (nome + cor + ícone + ordem, único por escritório) e passa
-- a ser obrigatório em todo caso.
--
-- Nada do que já existe é descartado: os títulos atuais viram tipos (um por título
-- distinto, por escritório) e cada caso é reanexado ao tipo correspondente antes de a
-- coluna `titulo` ser removida. A ordem dos passos abaixo importa — a coluna nova entra
-- nullable, é preenchida, e só então vira NOT NULL: se algum caso ficasse sem tipo, a
-- migration falha aqui em vez de gravar dado inconsistente.

-- 1) Tabela nova.
CREATE TABLE "tipo_processo" (
    "id" TEXT NOT NULL,
    "escritorio_id" TEXT NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "icone" VARCHAR(60) NOT NULL,
    "cor" VARCHAR(9) NOT NULL,
    "descricao" VARCHAR(255),
    "ordem" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipo_processo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tipo_processo_escritorio_id_nome_key" ON "tipo_processo"("escritorio_id", "nome");
CREATE INDEX "tipo_processo_escritorio_id_ordem_idx" ON "tipo_processo"("escritorio_id", "ordem");

ALTER TABLE "tipo_processo" ADD CONSTRAINT "tipo_processo_escritorio_id_fkey"
    FOREIGN KEY ("escritorio_id") REFERENCES "escritorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Deriva um tipo por título distinto de cada escritório. O agrupamento é
-- case-insensitive sobre o título já trimado e truncado em 60 caracteres (limite de
-- `nome`), e `min()` elege uma grafia representante entre as variações encontradas.
-- A cor gira pela paleta permitida (src/lib/utils/cores-status.ts) para os tipos não
-- nascerem todos iguais; o ícone padrão é o mesmo de tipo de processo novo.
INSERT INTO "tipo_processo" ("id", "escritorio_id", "nome", "icone", "cor", "descricao", "ordem", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    d."escritorio_id",
    d."nome",
    'Briefcase',
    (ARRAY['#64748b','#f59e0b','#0ea5e9','#8b5cf6','#10b981','#f43f5e','#ef4444','#f97316','#14b8a6','#6366f1'])[((d."ordem" - 1) % 10) + 1],
    NULL,
    d."ordem",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT
        "escritorio_id",
        min(btrim(left("titulo", 60))) AS "nome",
        row_number() OVER (PARTITION BY "escritorio_id" ORDER BY lower(btrim(left("titulo", 60)))) AS "ordem"
    FROM "caso"
    GROUP BY "escritorio_id", lower(btrim(left("titulo", 60)))
) AS d;

-- 3) Escritórios que ainda não têm nenhum caso ficariam sem tipo algum e não conseguiriam
-- cadastrar o primeiro processo (o tipo é obrigatório). Recebem o mesmo conjunto inicial
-- que todo escritório novo passa a ganhar em TipoProcessoService.criarPadroes.
INSERT INTO "tipo_processo" ("id", "escritorio_id", "nome", "icone", "cor", "descricao", "ordem", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    e."id",
    p."nome",
    p."icone",
    p."cor",
    p."descricao",
    p."ordem",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "escritorio" AS e
CROSS JOIN (VALUES
    ('Ação trabalhista', 'Scale', '#6366f1', 'Reclamatória trabalhista e demais demandas da Justiça do Trabalho.', 1),
    ('Ação de cobrança', 'Gavel', '#f59e0b', 'Cobrança judicial de dívida ou título não pago.', 2),
    ('Divórcio', 'Users', '#f43f5e', 'Dissolução de casamento ou união estável, consensual ou litigiosa.', 3),
    ('Inventário', 'FileText', '#8b5cf6', 'Partilha de bens após o falecimento do titular.', 4),
    ('Aposentadoria', 'BadgeCheck', '#10b981', 'Pedido ou revisão de benefício previdenciário junto ao INSS.', 5),
    ('Revisional', 'TrendingDown', '#0ea5e9', 'Revisão de contrato ou de juros considerados abusivos.', 6),
    ('Indenizatória', 'AlertCircle', '#ef4444', 'Reparação por dano material ou moral.', 7),
    ('Consultivo', 'Briefcase', '#64748b', 'Orientação jurídica e elaboração de contratos, sem litígio.', 8)
) AS p("nome", "icone", "cor", "descricao", "ordem")
WHERE NOT EXISTS (SELECT 1 FROM "tipo_processo" AS t WHERE t."escritorio_id" = e."id");

-- 4) Coluna nova, ainda nullable para poder ser preenchida.
ALTER TABLE "caso" ADD COLUMN "tipo_processo_id" TEXT;

-- 5) Reanexa cada caso ao tipo derivado do seu próprio título.
UPDATE "caso" AS c
SET "tipo_processo_id" = t."id"
FROM "tipo_processo" AS t
WHERE t."escritorio_id" = c."escritorio_id"
  AND lower(t."nome") = lower(btrim(left(c."titulo", 60)));

-- 6) Agora que todo caso tem tipo, a coluna vira obrigatória. Restrict espelha a proteção
-- que `caso.status_id` já tem: um tipo com processos vinculados não pode ser excluído.
ALTER TABLE "caso" ALTER COLUMN "tipo_processo_id" SET NOT NULL;

ALTER TABLE "caso" ADD CONSTRAINT "caso_tipo_processo_id_fkey"
    FOREIGN KEY ("tipo_processo_id") REFERENCES "tipo_processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "caso_escritorio_id_tipo_processo_id_idx" ON "caso"("escritorio_id", "tipo_processo_id");

-- 7) O título deixa de existir.
ALTER TABLE "caso" DROP COLUMN "titulo";

-- 8) Auditoria (RN20) passa a registrar escritas de tipo de processo.
ALTER TYPE "EntidadeLog" ADD VALUE 'tipo_processo';
