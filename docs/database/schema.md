# Modelo de Dados

Base: RFC original em https://github.com/LucasKlemke/PAC-Extensionista-VII---RFC---CRM-Advocacia (seção 5.2), evoluído para **multi-tenant**. Ver também [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md), [../produto/regras-negocio.md](../produto/regras-negocio.md) e [migrations-prisma.md](migrations-prisma.md) (como aplicar mudanças neste schema).

14 tabelas (as 10 originais + `escritorio`, a evolução de `advogado` para `usuario`, e `membro`/`convite` para o modelo N:N usuário↔escritório), cobrindo tenants, autenticação, clientes, casos, pipeline, prazos, mensagens e documentos. PK `uuid` em todas.

> **Multi-tenant real (evolução sobre o RFC original):** `usuario` deixou de pertencer a um único `escritorio` — vira um perfil global (um e-mail, uma senha), e a associação a um ou mais escritórios, com um papel por escritório, vive em `membro`. Isso permite a um mesmo profissional participar de múltiplos escritórios com papéis diferentes em cada um. `convite` guarda convites pendentes por e-mail, consumidos automaticamente no cadastro (ver [../produto/regras-negocio.md](../produto/regras-negocio.md)).

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

## `usuario` (substitui `advogado`; perfil global, não pertence a um escritório)

Perfil de quem acessa o sistema. Não tem `escritorio_id` — a associação a escritório(s) e o papel em cada um vivem em `membro`.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| nome | varchar(140) | Nome completo |
| email | varchar(255) | Login; único globalmente |
| senha_hash | varchar(255) | Hash bcrypt |
| avatar_url | varchar(500) | Reservado para upload de avatar via S3 (ainda não implementado) |
| oab | varchar(20) | Número da OAB (opcional) |
| telefone | varchar(20) | Telefone de contato |
| ativo | boolean | Desativação global da conta, sem apagar histórico de autoria |
| created_at / updated_at | timestamp | |

Cadastro self-service coleta só nome/e-mail/senha. Se já havia `convite` pendente para o e-mail, o cadastro consome todos os convites na mesma transação e cria as respectivas linhas de `membro` — senão o usuário segue para o onboarding, que cria seu primeiro escritório (e vira `owner` dele).

## `membro` (novo — associação N:N usuário↔escritório com papel)

Tabela híbrida: cada linha é a participação de um `usuario` em um `escritorio`, com um papel.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| usuario_id | uuid | FK → `usuario`, `onDelete: Cascade` |
| escritorio_id | uuid | FK → `escritorio`, `onDelete: Cascade` |
| role | varchar(20) | `owner` \| `admin` \| `padrao` (hierarquia: owner > admin > padrao) |
| created_at / updated_at | timestamp | |

`@@unique([usuario_id, escritorio_id])` — um usuário tem no máximo uma membership por escritório. `@@index([escritorio_id])` e `@@index([usuario_id])` para as duas direções de consulta (membros de um escritório; escritórios de um usuário). O escritório ativo da sessão é resolvido contra esta tabela a cada login/troca (nunca confiando em payload cru do client) — ver [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md). Regras de negócio (nunca remover/rebaixar o último `owner`, só `owner` promove a `owner`, sem auto-remoção) ficam no Service, não em constraint de banco.

## `convite` (novo — convite pendente de e-mail para um escritório)

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| escritorio_id | uuid | FK → `escritorio`, `onDelete: Cascade` |
| email | varchar(255) | E-mail convidado (normalizado, minúsculo/trim) |
| role | varchar(20) | Papel que o convidado terá ao aceitar |
| criado_por_usuario_id | uuid | FK → `usuario` — quem convidou |
| created_at / updated_at | timestamp | |

`@@unique([escritorio_id, email])`, `@@index([email])`. Convite pendente = linha existente (evita índice parcial); aceitar (cadastro com e-mail convidado) ou cancelar removem a linha dentro de uma transação.

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
| `membro` | N:1 | `usuario` |
| `membro` | N:1 | `escritorio` |
| `convite` | N:1 | `escritorio` |
| `convite` | N:1 | `usuario` (criado por) |
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
- `usuario.email` com `@unique` (global — identidade de login única, independente de quantos escritórios o usuário integra via `membro`).
- `cliente.cpf` com `@@unique([escritorio_id, cpf])` — único **composto** por escritório, não globalmente.
- Índice composto `@@index([escritorio_id])` em `cliente`, `estagio_pipeline`, `template_mensagem`, `membro` para performance de queries escopadas por tenant.
- `onDelete: Restrict` (ou equivalente) em `caso.cliente_id` para impedir exclusão física de cliente com casos — a regra é sempre inativar, nunca deletar (RN04).
- `estagio_pipeline` sem FK obrigatória de exclusão automática: a validação "coluna vazia antes de excluir" (RN09) é regra de aplicação no `EstagioService`, não constraint de banco.
- **Todo Repository que consulta `caso`, `prazo`, `anotacao`, `documento` ou `historico_mensagem` deve fazer join até `cliente`/`estagio_pipeline` para aplicar o filtro de `escritorio_id`** — essas tabelas não guardam o tenant diretamente para evitar duplicação de dado derivável, mas isso exige disciplina na camada de Repository (ver [../arquitetura/visao-geral.md#isolamento-de-tenant-defesa-em-profundidade](../arquitetura/visao-geral.md#isolamento-de-tenant-defesa-em-profundidade)). Alternativa mais defensiva, se preferível na implementação: desnormalizar `escritorio_id` também nessas tabelas para permitir filtro direto sem join — trade-off entre simplicidade de schema e robustez contra bugs de isolamento.
- Toda alteração neste schema segue o fluxo de migrations descrito em [migrations-prisma.md](migrations-prisma.md) — nunca editar o banco diretamente.
