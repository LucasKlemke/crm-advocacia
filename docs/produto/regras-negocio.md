# Regras de Negócio

Base: RFC original em https://github.com/LucasKlemke/PAC-Extensionista-VII---RFC---CRM-Advocacia (seção 2.5), evoluído para **multi-tenant com cadastro de usuários**. Cada regra aponta o Service responsável — ver [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md) e [../database/schema.md](../database/schema.md). Regras marcadas **(revisada)** mudam o comportamento do RFC original; **(nova)** não existiam no RFC original.

## Autenticação, Tenants e Usuários

- **RN01** — Apenas usuários autenticados acessam qualquer recurso; sem sessão válida → redirect para login. *(`AuthMiddleware`)*
- **RN02 (revisada 2)** — Sistema é multi-tenant com usuário podendo pertencer a N escritórios: cadastro é self-service e coleta só nome/e-mail/senha, criando um `usuario` (perfil global). Se havia `convite` pendente para o e-mail, o cadastro já cria a(s) membership(s) correspondente(s) (role do convite) na mesma transação; senão o usuário segue para o onboarding, que cria seu primeiro `escritorio` e o torna `owner` dele via `membro`. *(`UsuarioService`, `EscritorioService`, tabelas `escritorio` + `usuario` + `membro` + `convite`)*
  - No RFC original (RN02), o sistema era monousuário com usuário único provisionado via configuração de ambiente — não havia cadastro pela UI, nem múltiplos escritórios por usuário.
  - Evolução sobre a primeira revisão: `usuario` deixou de ter `escritorio_id`/`role` fixos — a associação usuário↔escritório com papel vive em `membro` (N:N), permitindo um mesmo profissional participar de vários escritórios com papéis diferentes. O escritório ativo da sessão é trocável (switcher no header) e sempre revalidado contra `membro` no banco, nunca confiado a partir do payload do client.
- **RN02a (revisada)** — Papéis por escritório seguem a hierarquia `owner > admin > padrao` (substitui `titular`/`colaborador`). `owner`/`admin` convidam/gerenciam membros; `padrao` não gerencia ninguém. Um ator só altera/remove um membro de nível estritamente menor — exceto `owner`, que também gerencia outro `owner` (a proteção real é RN02c). Só `owner` promove alguém a `owner`. Auto-alteração/auto-remoção do próprio papel é bloqueada. *(`MembroService`, `permissoes.ts`)*
- **RN02b** — O e-mail de um usuário é único globalmente na plataforma (identidade de login); um mesmo e-mail nunca cria dois perfis `usuario` — pode, porém, ter memberships (via `membro`) em vários escritórios diferentes. *(`UsuarioService`, constraint `@unique` em `usuario.email`)*
- **RN02c (nova)** — Um escritório nunca fica sem nenhum `owner`: rebaixar ou remover o último `owner` de um escritório é bloqueado. *(`MembroService`)*
- **RN03** — Sessão expira após inatividade, exigindo novo login. *(`AuthMiddleware` / NextAuth.js)*
- **RN19 (nova)** — Isolamento de tenant: nenhuma operação de leitura ou escrita pode acessar/alterar dados de um `escritorio_id` diferente do usuário autenticado na sessão. Toda query de Repository é obrigatoriamente escopada por `escritorio_id` (direto ou via join até `cliente`/`estagio_pipeline`). Violação é tratada como bug de segurança crítico, não como validação de negócio comum. *(todos os Repositories — ver [../arquitetura/visao-geral.md#isolamento-de-tenant-defesa-em-profundidade](../arquitetura/visao-geral.md#isolamento-de-tenant-defesa-em-profundidade))*

## Gestão de Clientes

- **RN04** — Cliente com casos vinculados não pode ser excluído permanentemente, apenas inativado; histórico preservado. *(`ClienteService`)*
- **RN05 (revisada)** — CPF único **dentro do mesmo escritório**; o mesmo CPF pode existir em escritórios diferentes (são tenants distintos). Bloquear apenas duplicidade dentro do próprio tenant. *(`ClienteService`, constraint composta `@@unique([escritorio_id, cpf])`)*
  - No RFC original, o CPF era único globalmente — fazia sentido em um sistema de usuário único.
- **RN06** — Todo caso deve pertencer a um cliente existente, ativo, e do mesmo escritório do usuário logado. *(`CasoService`)*

## Gestão de Casos

- **RN07** — Caso sempre pertence a uma etapa do pipeline; nunca existe fora do kanban. *(`CasoService`)*
- **RN08** — Casos arquivados saem do pipeline ativo, mas continuam acessíveis no histórico do cliente. *(`CasoService`)*
- **RN09** — Exclusão de etapa do pipeline só é permitida se não houver casos ativos nela; qualquer usuário do escritório pode mover/arquivar antes de remover a coluna (não é restrito ao titular). *(`EstagioService`)*

## Prazos e Lembretes

- **RN10** — Prazo sempre vinculado a um caso existente; não é permitido prazo solto. *(`PrazoService`)*
- **RN11** — Prazo com data anterior à atual não pode ser cadastrado como futuro; deve ser registrado como retroativo com indicação visual de atraso. *(`PrazoService`, campo `prazo.retroativo`)*
- **RN12** — Notificações de prazo (3 dias antes, 1 dia antes, no dia) são automáticas, sem ação manual, para todos os escritórios ativos. *(`NotificacaoScheduler`, tabela `notificacoes_prazo`)*

## Disparo de Mensagens via WhatsApp

- **RN13** — Disparo só é permitido para cliente com telefone cadastrado; sistema deve alertar se o campo estiver vazio. *(`MensagemService`)*
- **RN14** — Mensagens agendadas são processadas em segundo plano por serviço assíncrono (AWS Lambda), iterando por todos os escritórios; nenhum usuário precisa estar com a interface aberta. *(`NotificacaoScheduler`)*
- **RN15** — Todo disparo (sucesso ou falha) é registrado no histórico do cliente com data, hora, conteúdo e usuário que disparou (quando manual). *(`MensagemService`, tabela `historico_mensagem`)*
- **RN16** — Em caso de falha, até 3 tentativas automáticas antes de registrar erro definitivo. *(`MensagemService` / `UazapiClient`, campo `historico_mensagem.tentativas`)*
- **RN16a (nova)** — Templates de mensagem (`template_mensagem`) são compartilhados entre todos os usuários de um mesmo escritório; um colaborador pode usar/editar templates criados pelo titular e vice-versa. *(`MensagemService`)*

## Documentos

- **RN17** — Tamanho máximo por arquivo: 10 MB. *(`DocumentoService`, campo `documento.tamanho_kb`)*
- **RN18** — Tipos aceitos: PDF, DOCX, JPG, PNG, JPEG; outros formatos rejeitados com mensagem de erro clara. *(`DocumentoService`)*

## Requisitos não funcionais que afetam regras de negócio

- **RNF03/RNF04/RNF05** — Autenticação JWT (com `escritorioId` + `role` embutidos), senha com bcrypt, tudo via HTTPS.
- **RNF06** — Dados sensíveis do cliente (CPF, telefone, dados processuais) tratados em conformidade com a LGPD, isolados por escritório.
- **RNF09** — Sistema deve suportar até 1.000 clientes e 5.000 casos **por escritório**, com o número de escritórios podendo crescer sem degradação (índices compostos por `escritorio_id`).
- **RNF11/RNF13** — Uso autônomo após treinamento breve; localizar informação de cliente em menos de 30s.

## Fluxos alternativos relevantes

Derivados dos fluxos principais (cadastro de escritório, login, convite de colaborador, cadastro de cliente, cadastro de caso):

- **FA-01** — Login com credenciais inválidas → mensagem de erro, permanece na tela.
- **FA-02** — Cancelamento do cadastro de cliente → modal fecha sem salvar.
- **FA-03** — CPF já cadastrado **no mesmo escritório** → erro de duplicidade, modal permanece aberto (aplica RN05 revisada).
- **FA-04** — Cancelamento do cadastro de caso → modal fecha sem criar.
- **FA-05** — Tentativa de criar caso sem cliente selecionado → validação de campo obrigatório, não prossegue (aplica RN06).
- **FA-06 (nova)** — Cadastro com e-mail já usado por outro usuário → erro de duplicidade, cadastro não prossegue (aplica RN02b).
- **FA-07 (nova)** — Membro `padrao` tenta convidar/gerenciar outro membro → ação bloqueada (403), a UI esconde as ações de gestão (aplica RN02a).
- **FA-08 (nova)** — Usuário autenticado tenta acessar (via URL direta ou manipulação de request) um recurso de outro escritório → sistema retorna 404, sem confirmar existência do recurso (aplica RN19).
