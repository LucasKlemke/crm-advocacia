-- Redesenha os tipos de status padronizados: o funil comercial de 6 etapas
-- (nova_conversa, analise, qualificado, proposta, sucesso, perda) dá lugar a um
-- ciclo de 9 etapas cobrindo também a fase processual (lead -> ... -> cancelado).
--
-- Como status.tipo_status_id e caso.status_id têm onDelete: Restrict, os `status`
-- (colunas de kanban) que hoje apontam para os tipos antigos são primeiro
-- reapontados para o tipo novo equivalente (mapeamento best-effort abaixo) antes
-- de remover os tipos antigos.

-- 1) Novos tipos de status (referência global, seed fixo — RN do plano.md).
INSERT INTO "tipo_status" ("id", "chave", "nome", "icone", "cor", "descricao", "ordem") VALUES
    (gen_random_uuid(), 'lead', 'Lead', 'UserPlus', '#64748b', 'Contato inicial que ainda não é cliente, potencial caso em avaliação.', 1),
    (gen_random_uuid(), 'negociacao', 'Negociação', 'FileText', '#f59e0b', 'Proposta ou contrato enviado ao cliente, aguardando aceite.', 2),
    (gen_random_uuid(), 'fechado', 'Fechado', 'Handshake', '#0ea5e9', 'Cliente aceitou contratar, processo será iniciado.', 3),
    (gen_random_uuid(), 'preparacao', 'Preparação', 'FolderOpen', '#8b5cf6', 'Trabalho antes do protocolo, como coleta de documentos e elaboração da petição.', 4),
    (gen_random_uuid(), 'tramitacao', 'Tramitação', 'Scale', '#6366f1', 'Processo protocolado e correndo no sistema judicial, aguardando decisão, audiência ou recurso.', 5),
    (gen_random_uuid(), 'ganho', 'Ganho', 'Trophy', '#10b981', 'Decisão favorável ao cliente.', 6),
    (gen_random_uuid(), 'perdido', 'Perdido', 'CircleX', '#f43f5e', 'Decisão desfavorável ao cliente.', 7),
    (gen_random_uuid(), 'concluido', 'Concluído', 'CircleCheck', '#22c55e', 'Processo encerrado e valores ou resultado efetivamente recebidos pelo cliente.', 8),
    (gen_random_uuid(), 'cancelado', 'Cancelado', 'Ban', '#94a3b8', 'Processo interrompido antes da conclusão, podendo ocorrer a partir de qualquer fase.', 9)
ON CONFLICT ("chave") DO NOTHING;

-- 2) Reaponta os `status` existentes (colunas de kanban dos escritórios já
-- cadastrados) do tipo antigo para o tipo novo equivalente.
UPDATE "status" AS s
SET "tipo_status_id" = novo."id"
FROM "tipo_status" AS antigo, "tipo_status" AS novo
WHERE s."tipo_status_id" = antigo."id"
  AND novo."chave" = CASE antigo."chave"
        WHEN 'nova_conversa' THEN 'lead'
        WHEN 'analise' THEN 'lead'
        WHEN 'qualificado' THEN 'negociacao'
        WHEN 'proposta' THEN 'negociacao'
        WHEN 'sucesso' THEN 'fechado'
        WHEN 'perda' THEN 'cancelado'
      END
  AND antigo."chave" IN ('nova_conversa', 'analise', 'qualificado', 'proposta', 'sucesso', 'perda');

-- 3) Remove os tipos antigos, já sem nenhum `status` apontando para eles.
DELETE FROM "tipo_status"
WHERE "chave" IN ('nova_conversa', 'analise', 'qualificado', 'proposta', 'sucesso', 'perda');
