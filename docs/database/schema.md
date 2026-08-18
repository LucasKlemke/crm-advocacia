# Modelo de Dados

Base: RFC original em https://github.com/LucasKlemke/PAC-Extensionista-VII---RFC---CRM-Advocacia (seção 5.2), evoluído para **multi-tenant**. Ver também [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md), [../produto/regras-negocio.md](../produto/regras-negocio.md) e [migrations-prisma.md](migrations-prisma.md) (como aplicar mudanças neste schema).

12 tabelas (as 10 originais + `escritorio` e a evolução de `advogado` para `usuario`), cobrindo tenants, autenticação, clientes, casos, pipeline, prazos, mensagens e documentos. PK `uuid` em todas.

## `escritorio` (novo — tenant)

Representa cada escritório de advocacia cadastrado na plataforma. Toda entidade "de topo" do domínio (`cliente`, `estagio_pipeline`, `template_mensagem`, `usuario`) pertence a exatamente um escritório.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| nome | varchar(140) | Nome do escritório |
| oab_responsavel | varchar(20) | OAB do titular, opcional na criação |
| telefone_whatsapp | varchar(20) | Número conectado à Uazapi para disparo (RN13) |
| ativo | boolean | Permite suspender um tenant sem apagar dados |
| created_at / updated_at | timestamp | |

## `usuario` (substitui `advogado`)

Usuários que acessam o sistema, sempre vinculados a um escritório.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| escritorio_id | uuid | FK → `escritorio` (obrigatório) |
| nome | varchar(140) | Nome completo |
| email | varchar | Login; único globalmente (um e-mail não pode estar em dois escritórios) |
| senha_hash | varchar(255) | Hash bcrypt |
| oab | varchar(20) | Número da OAB (opcional para colaboradores não-advogados, ex. estagiário) |
| telefone | varchar(20) | Telefone de contato |
| role | varchar(20) | `titular` ou `colaborador` (RN02a) |
| ativo | boolean | Desativação de membro pelo titular, sem apagar histórico de autoria |
| created_at / updated_at | timestamp | |

> O primeiro `usuario` de um `escritorio` é sempre criado com `role = titular` no fluxo de cadastro self-service. Apenas um `titular` por escritório é necessário para autorizar convites, mas nada impede promover mais de um colaborador a `titular` futuramente (decisão de produto, não uma restrição do banco).

## `cliente`

Cadastro dos clientes do escritório.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| escritorio_id | uuid | FK → `escritorio` (obrigatório — escopo de tenant) |
| nome | varchar(140) | |
| cpf | varchar(14) | Único **por escritório** (RN05), não globalmente |
| email | varchar(140) | |
| telefone | varchar(20) | Usado para disparo de WhatsApp (RN13) |
| endereco | varchar | |
| observacoes | text | Anotações livres iniciais |
| ativo | boolean | Inativação em vez de exclusão (RN04) |
| created_at / updated_at | timestamp | |

## `estagio_pipeline`

Colunas do kanban, configuráveis por escritório (compartilhadas entre os usuários do mesmo tenant).

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| escritorio_id | uuid | FK → `escritorio` (obrigatório) |
| nome | varchar(50) | Ex.: "Em Andamento" |
| ordem | int | Posição no kanban |

Padrão sugerido ao criar um novo escritório (seed automático no cadastro): Prospecção, Consulta, Contrato, Em Andamento, Concluído.

## `caso`

Processos/casos vinculados a um cliente e posicionados no pipeline. Não tem `escritorio_id` direto — o tenant é resolvido via `cliente.escritorio_id`, mas todo Repository deve fazer `join` com `cliente` (ou `estagio_pipeline`) para aplicar o filtro de isolamento (ver [../arquitetura/visao-geral.md#isolamento-de-tenant-defesa-em-profundidade](../arquitetura/visao-geral.md#isolamento-de-tenant-defesa-em-profundidade)).

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| cliente_id | uuid | FK → `cliente` (obrigatório, RN06) |
| estagio_id | uuid | FK → `estagio_pipeline` (obrigatório, RN07) |
| criado_por_usuario_id | uuid | FK → `usuario` — autoria, útil com múltiplos colaboradores |
| tipo_acao | varchar(140) | Área/tipo do processo (ex.: "Civil") |
| numero_processo | varchar(40) | |
| comarca | varchar(140) | |
| descricao | text | |
| arquivado | boolean | Sai do kanban ativo, mantém histórico (RN08) |
| prioridade | varchar | |
| created_at / updated_at | timestamp | |

## `prazo`

Prazos processuais/compromissos vinculados a um caso.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| caso_id | uuid | FK → `caso` (obrigatório, RN10) |
| tipo | varchar | Ex.: "Audiência" |
| data_prazo | date | |
| concluido | boolean | |
| retroativo | boolean | Data passada no cadastro (RN11) |
| created_at / updated_at | timestamp | |

## `notificacoes_prazo`

Controle de notificações já disparadas por prazo.

| Coluna | Tipo | Descrição |
|---|---|---|
| prazo_id | uuid | FK → `prazo` |
| tipo | int | Intervalo: 3, 1 ou 0 dias antes (RN12) |
| enviado | boolean | |
| enviada_em | timestamp | |

## `template_mensagem`

Modelos reutilizáveis de mensagem WhatsApp, compartilhados entre os usuários de um mesmo escritório.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| escritorio_id | uuid | FK → `escritorio` (obrigatório) |
| nome | varchar(100) | |
| conteudo | text | Suporta variáveis `{{nome}}` e `{{processo}}` |
| created_at / updated_at | timestamp | |

## `historico_mensagem`

Registro de mensagens disparadas.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| template_id | uuid | FK → `template_mensagem` |
| cliente_id | uuid | FK → `cliente` (precisa de telefone, RN13) — tenant resolvido via `cliente.escritorio_id` |
| enviado_por_usuario_id | uuid | FK → `usuario` — qual colaborador disparou (nulo se automático via scheduler) |
| conteudo | text | Conteúdo final após substituição de variáveis |
| tentativas | int | Até 3 automáticas (RN16) |
| enviada | boolean | |
| enviada_em | timestamp | |
| env_detalhe | text | Detalhe do erro, se houver |

## `anotacao`

Observações vinculadas a um caso.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| caso_id | uuid | FK → `caso` |
| usuario_id | uuid | FK → `usuario` — autor da anotação |
| texto | text | |
| created_at / updated_at | timestamp | |

## `documento`

Arquivos anexados a um caso.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| caso_id | uuid | FK → `caso` |
| usuario_id | uuid | FK → `usuario` — quem fez o upload |
| tipo_arquivo | varchar(50) | PDF, DOCX, JPG, PNG, JPEG (RN18) |
| url_storage | varchar | URL no S3, path prefixado por `escritorio_id/` |
| tamanho_kb | int | Máx. 10.240 KB = 10 MB (RN17) |
| created_at | timestamp | |

## Relacionamentos

| Origem | Cardinalidade | Destino |
|---|---|---|
| `usuario` | N:1 | `escritorio` |
| `cliente` | N:1 | `escritorio` |
| `estagio_pipeline` | N:1 | `escritorio` |
| `template_mensagem` | N:1 | `escritorio` |
| `caso` | N:1 | `cliente` |
| `caso` | N:1 | `estagio_pipeline` |
| `caso` | N:1 | `usuario` (autoria) |
| `prazo` | N:1 | `caso` |
| `notificacoes_prazo` | N:1 | `prazo` |
| `anotacao` | N:1 | `caso` |
| `anotacao` | N:1 | `usuario` (autoria) |
| `documento` | N:1 | `caso` |
| `documento` | N:1 | `usuario` (autoria) |
| `historico_mensagem` | N:1 | `cliente` |
| `historico_mensagem` | N:1 | `template_mensagem` |
| `historico_mensagem` | N:1 | `usuario` (autoria, opcional) |

## Notas de implementação (Prisma)

- Usar `@id @default(uuid())` em todas as PKs.
- `usuario.email` com `@unique` (global — um e-mail é a identidade de login, não pode repetir entre escritórios).
- `cliente.cpf` com `@@unique([escritorio_id, cpf])` — único **composto** por escritório, não globalmente.
- Índice composto `@@index([escritorio_id])` em `cliente`, `estagio_pipeline`, `template_mensagem`, `usuario` para performance de queries escopadas por tenant.
- `onDelete: Restrict` (ou equivalente) em `caso.cliente_id` para impedir exclusão física de cliente com casos — a regra é sempre inativar, nunca deletar (RN04).
- `estagio_pipeline` sem FK obrigatória de exclusão automática: a validação "coluna vazia antes de excluir" (RN09) é regra de aplicação no `EstagioService`, não constraint de banco.
- **Todo Repository que consulta `caso`, `prazo`, `anotacao`, `documento` ou `historico_mensagem` deve fazer join até `cliente`/`estagio_pipeline` para aplicar o filtro de `escritorio_id`** — essas tabelas não guardam o tenant diretamente para evitar duplicação de dado derivável, mas isso exige disciplina na camada de Repository (ver [../arquitetura/visao-geral.md#isolamento-de-tenant-defesa-em-profundidade](../arquitetura/visao-geral.md#isolamento-de-tenant-defesa-em-profundidade)). Alternativa mais defensiva, se preferível na implementação: desnormalizar `escritorio_id` também nessas tabelas para permitir filtro direto sem join — trade-off entre simplicidade de schema e robustez contra bugs de isolamento.
- Toda alteração neste schema segue o fluxo de migrations descrito em [migrations-prisma.md](migrations-prisma.md) — nunca editar o banco diretamente.
