-- Log de usuário sempre tem autor; só o sistema (sincronização, polling, webhook) grava sem
-- usuario_id. Defesa em profundidade da RN20: o Prisma não expressa CHECK no schema.
ALTER TABLE "log" ADD CONSTRAINT "log_autor_coerente" CHECK ("origem" = 'sistema' OR "usuario_id" IS NOT NULL);
