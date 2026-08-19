# Casos de Uso / User Stories

Documentação mínima exigida pela linha Web Apps ([directions-webapp.md](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-webapp.md)): "requisitos funcionais; casos de uso ou user stories". Este documento cobre o "casos de uso ou user stories" — o "requisitos funcionais" já está coberto por [regras-negocio.md](regras-negocio.md) (RN01–RN19). Cada história aponta a(s) regra(s) de negócio que implementa e o(s) fluxo(s) alternativo(s) (`FA-*`) já descritos lá, para não duplicar a especificação de comportamento — aqui o formato é orientado ao usuário, lá é orientado à regra.

## Papéis (personas)

> Terminologia evoluiu de "titular"/"colaborador" (RFC original, 1 usuário : 1 escritório) para papéis por escritório via `membro`, já que um mesmo usuário pode pertencer a vários escritórios com papéis diferentes em cada um (ver RN02/RN02a em [regras-negocio.md](regras-negocio.md)).

- **Owner** — criou o escritório (ou foi promovido); gerencia membros e dados do escritório; todo escritório sempre tem ao menos um.
- **Admin** — gerencia membros de nível igual/inferior (exceto promover a owner), edita dados do escritório.
- **Padrao** — compartilha clientes/casos/templates do escritório, sem gerenciar membros nem editar dados do escritório.
- **Sistema** — ações automáticas sem usuário logado (agendador de notificações).

## 1. Cadastro e login

> Como um advogado autônomo, quero me cadastrar com nome/e-mail/senha e criar meu próprio escritório, para começar a usar o CRM sem depender de nenhum administrador da plataforma.

- Critérios de aceite: cadastro cria só o `usuario` (perfil global) numa operação (RN02); sem convite pendente, segue para o onboarding, que cria `escritorio` + `membro` owner numa única transação; e-mail único globalmente (RN02b, FA-06); login exige sessão válida para qualquer recurso (RN01); credenciais inválidas mantêm o usuário na tela de login com erro (FA-01).

## 2. Gestão de membros e convites

> Como owner/admin, quero convidar colegas do meu escritório para o sistema, para que todos compartilhem a mesma base de clientes e casos sem duplicar cadastro.

- Critérios de aceite: apenas owner/admin convidam/gerenciam membros (RN02a); membro `padrao` que tenta gerenciar membros é bloqueado com mensagem explicativa (FA-07); convidar um e-mail já cadastrado cria a membership na hora, senão grava um convite pendente consumido no cadastro (RN02).

> Como membro `padrao`, quero acessar os mesmos clientes, casos e templates de mensagem do meu escritório, para trabalhar em conjunto com o resto do time sem re-cadastrar nada.

- Critérios de aceite: templates de mensagem compartilhados entre todos os membros do tenant (RN16a); isolamento continua valendo entre escritórios diferentes, nunca entre membros do mesmo escritório (RN19).

> Como usuário com mais de um escritório, quero trocar o escritório ativo pelo seletor do header, para alternar de contexto sem precisar fazer logout/login.

- Critérios de aceite: a troca só é aceita para um escritório onde o usuário é membro, revalidado contra o banco (RN19); "criar escritório" pelo seletor leva ao mesmo fluxo de onboarding.

## 3. Cadastro e gestão de clientes

> Como membro do escritório (qualquer papel), quero cadastrar um cliente com CPF, telefone e dados de contato, para centralizar o histórico dele em vez de espalhar informação em planilhas/WhatsApp.

- Critérios de aceite: CPF único dentro do escritório, permitido repetir entre escritórios diferentes (RN05); tentativa de duplicar CPF no mesmo escritório mostra erro sem fechar o formulário (FA-03); cancelar o formulário não salva nada (FA-02).

> Como usuário do escritório, quero inativar um cliente com casos vinculados em vez de excluí-lo, para preservar o histórico jurídico sem perder rastreabilidade.

- Critérios de aceite: exclusão permanente bloqueada se houver caso vinculado; inativação como alternativa (RN04).

## 4. Gestão de casos e pipeline kanban

> Como usuário do escritório, quero criar um caso vinculado a um cliente e movê-lo entre colunas do kanban conforme ele avança, para visualizar rapidamente o andamento de todos os processos.

- Critérios de aceite: todo caso pertence a um cliente ativo e existente do mesmo escritório (RN06); todo caso pertence a uma etapa do pipeline, nunca fica "solto" (RN07); tentar criar caso sem cliente selecionado bloqueia com validação (FA-05); cancelar o formulário de caso não cria nada (FA-04).

> Como usuário do escritório, quero arquivar um caso encerrado, para tirá-lo do kanban ativo sem perder o histórico dele no cadastro do cliente.

- Critérios de aceite: caso arquivado sai do pipeline ativo mas permanece acessível no histórico (RN08).

> Como usuário do escritório, quero customizar as colunas do meu kanban, para refletir o fluxo de trabalho específico do meu escritório.

- Critérios de aceite: etapa do pipeline só pode ser removida se não houver casos ativos nela; qualquer usuário do escritório pode mover/arquivar antes de remover a coluna (RN09).

## 5. Prazos e notificações automáticas

> Como usuário do escritório, quero cadastrar prazos vinculados a um caso e ser avisado automaticamente antes do vencimento, para nunca perder um prazo processual por esquecimento.

- Critérios de aceite: prazo sempre vinculado a um caso existente (RN10); data passada vira prazo retroativo com indicação visual, não é rejeitado (RN11); notificações automáticas em 3 dias, 1 dia e no dia do vencimento, sem ação manual do usuário, para todos os escritórios (RN12).

> Como sistema, quero verificar periodicamente os prazos de todos os escritórios em segundo plano, para disparar os alertas mesmo que nenhum usuário esteja com a interface aberta.

- Critérios de aceite: `NotificacaoScheduler` roda via Lambda/EventBridge, isolando o processamento por tenant (RN12, RN14).

## 6. Disparo de mensagens via WhatsApp

> Como usuário do escritório, quero enviar uma mensagem de WhatsApp para um cliente a partir de um template com variáveis, para agilizar comunicações repetitivas (lembretes, atualizações) sem sair do sistema.

- Critérios de aceite: disparo exige telefone cadastrado, com alerta se estiver vazio (RN13); mensagem processada de forma assíncrona (RN14); toda tentativa (sucesso ou falha) registrada no histórico do cliente (RN15); até 3 retentativas automáticas em caso de falha antes de erro definitivo (RN16).

## 7. Upload de documentos

> Como usuário do escritório, quero anexar documentos (PDF, DOCX, imagens) a um caso, para manter toda a documentação do processo em um só lugar.

- Critérios de aceite: tamanho máximo de 10 MB por arquivo (RN17); apenas os tipos PDF/DOCX/JPG/PNG/JPEG são aceitos, outros formatos rejeitados com mensagem clara (RN18).

## 8. Isolamento entre escritórios (transversal a todos os fluxos acima)

> Como usuário de um escritório, quero ter certeza de que nenhum dado do meu escritório é visível ou alterável por outro escritório, mesmo que alguém tente acessar diretamente pela URL, para confiar que informações sensíveis de clientes ficam restritas à minha equipe.

- Critérios de aceite: toda operação de leitura/escrita é escopada por `escritorio_id` da sessão autenticada (RN19); tentativa de acessar recurso de outro escritório via URL direta retorna 404, sem confirmar existência do recurso (FA-08).

## Cobertura do requisito "três fluxos de negócio completos"

A linha Web Apps exige "ao menos três fluxos de negócio completos". Este sistema cobre, no mínimo, três fluxos ponta a ponta independentes e completos: **(1)** cadastro de escritório → cadastro de cliente → criação de caso no kanban; **(2)** criação de prazo → notificação automática (Lambda) sem intervenção manual; **(3)** criação de template → disparo de mensagem WhatsApp → registro em histórico. Os fluxos 2, 3 e 7 (documentos) reforçam esse número.
