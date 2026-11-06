# Deploy acadêmico na AWS (Terraform + GitHub Actions) e progresso de campanhas em tempo real

Data: 2026-11-05 · Branch: `feature/migracao-nestjs` (continua a migração React + NestJS)

## Intenção

O deploy **acadêmico** (`crm-advocacia-pac`, avaliado pela disciplina PAC Extensionista VII) passa a rodar
na AWS com a infraestrutura versionada em Terraform e publicada pelo GitHub Actions. Só a SPA React fica na
Vercel. O objetivo é mostrar à banca uma infraestrutura AWS real, reproduzível e barata, que pode ser
destruída (`terraform destroy`) depois da avaliação.

Na mesma entrega, o disparo em massa de WhatsApp (campanhas) ganha progresso **em tempo real**: a UAZAPI
avisa a API por webhook, e a API empurra o progresso para o navegador por WebSocket. Hoje o webhook só loga
metadados (`apps/api/src/webhooks/uazapi-webhook.controller.ts`) e o progresso só muda quando alguém clica em
"Sincronizar".

Decisões do usuário: deploy é para a disciplina (custo baixo, mostrar infra); conta AWS própria (não
Learner Lab); tudo na AWS exceto o React na Vercel; progresso de disparos via WebSocket. O resto deste
documento são decisões do Claude ("pode seguir"), marcadas como tal quando relevantes.

## Objetivos

1. `infra/` com Terraform que sobe, numa conta AWS própria, tudo que a API precisa: rede, ECR, ECS Fargate,
   ALB, CloudFront, RDS PostgreSQL, S3 de documentos, Secrets Manager, CloudWatch Logs, alerta de orçamento.
2. Bootstrap separado (estado remoto + OIDC do GitHub) para que o GitHub Actions faça deploy **sem chave AWS
   de longa duração**.
3. Workflows do GitHub Actions: `terraform fmt/validate/plan` em PR, e deploy em `main` (build da imagem →
   ECR → `terraform apply` com a tag nova → espera o serviço estabilizar).
4. Webhook UAZAPI autenticado e correlacionado à instância, que dispara a sincronização das campanhas ativas.
5. WebSocket autenticado por escritório que publica `campanha.atualizada`; a tela de detalhe e a lista de
   campanhas atualizam sozinhas, com indicador "ao vivo".
6. Documentação: `docs/deploy/deploy.md` reescrito para o novo desenho, `docs/deploy/aws-terraform.md` com o
   passo a passo, ADR/nota de arquitetura do tempo real, CLAUDE.md atualizado (stack, hosting, comandos).

## Não-objetivos

- Lambda + EventBridge do `NotificacaoScheduler` (continua "ainda não implementado").
- Alta disponibilidade: 1 task, RDS single-AZ, sem NAT Gateway, sem múltiplos ambientes AWS (só `pac`).
- Domínio próprio/Route 53/ACM: usa o domínio `*.cloudfront.net`.
- Mexer no deploy de produção real (Supabase, Project `crm-advocacia-supabase`) além do necessário para ele
  continuar funcionando como hoje.
- Persistir status por destinatário (`campanha_item` continua snapshot imutável).

## Anti-objetivos (falha mesmo que "funcione")

- Chave de acesso AWS de longa duração em secret do GitHub.
- Segredo (AUTH_SECRET, senha do banco, tokens UAZAPI, licença New Relic) em texto no repositório, em
  `terraform.tfvars` versionado ou em variável de ambiente "plain" da task definition.
- RDS ou o ALB acessíveis diretamente da internet (o ALB só aceita tráfego do CloudFront).
- WebSocket que entrega evento de um escritório para outro (RN19).
- Webhook público que aceita chamada de qualquer um e dispara trabalho.
- `terraform apply` rodado pelo Claude na conta do usuário (o usuário roda o bootstrap e o primeiro apply).

## Restrições

- Tudo do CLAUDE.md: TDD, Conventional Commits, Services sem Prisma direto em controller, toda escrita com
  log (RN20), isolamento por `escritorio_id`, piso de cobertura (backend 75% / frontend 25%), lint/typecheck
  verdes, E2E verdes.
- Node 24; a API sobe sempre com `--import ./dist/instrumentacao.js` (New Relic).
- Região padrão `us-east-1` (variável). Terraform ≥ 1.10 (lock nativo no S3 com `use_lockfile`), provider
  `hashicorp/aws` ~> 6.x (versão exata fixada no lock file).
- Custo alvo ≤ US$ 50/mês ligado; alerta de orçamento em US$ 30 (variável, e-mail do usuário via variável).

## Arquitetura de deploy

```
navegador ──HTTPS──► Vercel (SPA estática)          /api/*  ──rewrite (proxy)──┐
    │                                                                         ▼
    └──WSS (ticket)────────────────────────────────────────────► CloudFront (*.cloudfront.net)
                                                                   │  header secreto X-Origem-CloudFront
                                                                   ▼
                                                     ALB (HTTP :80, SG = prefix list do CloudFront)
                                                                   ▼
                                       ECS Fargate (1 task, subnet pública, IP público, SG só do ALB)
                                         │                 │                    │
                                   RDS Postgres 16    S3 documentos     Secrets Manager / CloudWatch
                                   (subnets privadas)  (task role)
UAZAPI ──HTTPS webhook──► CloudFront ──► ALB ──► /api/webhooks/uazapi/:instanciaId/:assinatura
```

### Por que cada peça (decisões do Claude)

- **ECS Fargate + ALB**: WebSocket precisa de conexão longa e de um processo com estado (assinantes em
  memória); Lambda/App Runner atrapalham isso. 1 task, `cpu=512`, `memory=1024`, ARM64 (Graviton, mais
  barato) — a imagem é construída para `linux/arm64`.
- **Subnets públicas sem NAT**: NAT Gateway custaria ~US$ 32/mês sozinho. A task tem IP público para sair
  para UAZAPI/New Relic/ECR/Secrets Manager; o SG dela só aceita entrada do SG do ALB.
- **CloudFront na frente do ALB**: HTTPS sem domínio próprio; suporta WebSocket. Cache desligado
  (`Managed-CachingDisabled`), `Managed-AllViewerExceptHostHeader` como origin request policy, todos os
  métodos. O ALB só aceita a prefix list gerenciada `com.amazonaws.global.cloudfront.origin-facing` e uma
  regra de listener exige o header `X-Origem-CloudFront` com um valor aleatório (gerado pelo Terraform);
  sem ele, 403.
- **RDS**: `postgres` 16, `db.t4g.micro`, 20 GB gp3, single-AZ, subnets privadas, SG só da task, backup 1
  dia, `deletion_protection=false`, `skip_final_snapshot=true` (é ambiente de disciplina; documentar).
  Senha gerada pelo próprio RDS (`manage_master_user_password`) **não** é usada porque a API precisa de uma
  `DATABASE_URL` pronta: o Terraform gera a senha (`random_password`) e grava a URL completa num secret.
- **S3 de documentos**: privado, block public access, SSE-S3, CORS liberando `PUT`/`GET` só das origens da
  SPA (variável `web_origins`). A task acessa por **task role** (sem chave): o `s3-client.ts` passa a usar a
  cadeia padrão de credenciais do SDK quando `AWS_ACCESS_KEY_ID` não está definido (o deploy Supabase continua
  passando chave explícita).
- **Secrets Manager**: um secret JSON `crm-pac/api` com `AUTH_SECRET` (gerado), `DATABASE_URL`/`DIRECT_URL`
  (gerados a partir do RDS), `UAZAPI_WEBHOOK_SECRET` (gerado), e os externos `UAZAPI_ADMIN_TOKEN` e
  `NEW_RELIC_LICENSE_KEY` (vindos de variáveis sensíveis do Terraform, alimentadas no CI por secrets do
  GitHub `TF_VAR_*`). A task definition injeta cada chave via `secrets[].valueFrom = "<arn>:<CHAVE>::"`.
  Variáveis não secretas (`NODE_ENV`, `PORT`, `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_S3_PREFIX`,
  `UAZAPI_SERVER_URL`, `NEW_RELIC_APP_NAME`, `API_PUBLIC_URL`, `WEB_ORIGINS`) vão em `environment`.
- **Migrations**: o container de produção roda `prisma migrate deploy` e só então `npm run start` (script
  `apps/api/scripts/iniciar-producao.sh`). Com 1 task não há corrida. Se a migration falhar, o container
  morre, e o **deployment circuit breaker** do ECS (com rollback) volta para a revisão anterior. Limitação
  (documentar): com N tasks, migrar num `run-task` dedicado antes do deploy.
- **CloudWatch**: log group `/ecs/crm-pac-api`, retenção 14 dias; healthcheck do target group em
  `GET /api/saude` (rota já existe — o builder confirma o path).
- **Orçamento**: `aws_budgets_budget` mensal com alerta por e-mail em 80% e 100% de `budget_limit_usd`.

### Estrutura de `infra/`

```
infra/
  bootstrap/          # aplicado 1x pelo usuário, com credencial local de admin; estado LOCAL
    main.tf           # bucket S3 do estado (versionado, criptografado, block public access)
                      # OIDC provider token.actions.githubusercontent.com
                      # role crm-pac-github-deploy (trust: repo + refs/heads/main e pull_request)
    outputs.tf        # nome do bucket de estado, ARN da role
  terraform/          # o ambiente pac; backend s3 (bucket do bootstrap, use_lockfile = true)
    versions.tf providers.tf variables.tf outputs.tf
    rede.tf ecr.tf ecs.tf alb.tf cloudfront.tf rds.tf s3.tf segredos.tf logs.tf orcamento.tf iam.tf
    terraform.tfvars.example
  README.md           # ponteiro para docs/deploy/aws-terraform.md
```

Sem módulos próprios (um ambiente só — YAGNI); recursos agrupados por arquivo. Tags padrão via
`default_tags` (`Projeto=crm-advocacia`, `Ambiente=pac`, `GerenciadoPor=terraform`).

Permissões da role do GitHub: suficientes para `plan/apply` do diretório `terraform/` e push no ECR. Para
uma conta pessoal de disciplina, aceitar `AdministratorAccess` restrita por trust policy ao repositório é
**decisão do Claude** (documentada como simplificação; alternativa de menor privilégio fica citada no doc).
A trust policy separa: `pull_request` só pode assumir para `plan` (mesma role é aceitável, mas o workflow de
PR nunca roda `apply`).

### Imagem Docker

`apps/api/Dockerfile` (contexto = raiz do monorepo, `.dockerignore` na raiz): multi-stage em
`node:24-bookworm-slim` com `openssl` instalado; estágio de build roda `npm ci`, `prisma generate`, build
do `@crm/api` (tsup); estágio final copia `dist`, `prisma/`, `node_modules` de produção da API e do
workspace, roda como usuário não-root, `EXPOSE 3001`, `CMD ["sh", "apps/api/scripts/iniciar-producao.sh"]`.
`binaryTargets` do Prisma passa a incluir o alvo do container ARM (`linux-arm64-openssl-3.0.x`) mantendo os
atuais. A imagem precisa subir localmente com `docker run` + Postgres do Compose (verificação do builder).

### Vercel

O Project `crm-advocacia-pac` passa a publicar só a SPA. `vercel.json` vira `vercel.ts` (`@vercel/config`)
que lê `API_ORIGIN` no build: **com** `API_ORIGIN` → só o service `web` + rewrite `/api/(.*)` →
`${API_ORIGIN}/api/$1` (proxy externo; o cookie `crm_sessao` continua first-party no domínio da Vercel);
**sem** `API_ORIGIN` → configuração atual (services `web` + `api`), mantendo o Project Supabase como está.
Decisão do Claude. O builder confirma na doc atual do `@vercel/config` que services + rewrites são
expressáveis em `vercel.ts`; se não forem, mantém `vercel.json` para o Supabase e documenta o Project `pac`
com Root Directory `apps/web` e um `apps/web/vercel.json` só com os rewrites (o domínio CloudFront entra
nele após o primeiro apply).

A SPA recebe `VITE_WS_URL` no build (ex.: `wss://dxxxx.cloudfront.net`); sem ela, o WebSocket usa a mesma
origem (`/api/ws`), que é o caso do dev local (proxy do Vite com `ws: true`) e do `vite preview`/E2E.

### GitHub Actions

- `ci.yml` (existente) ganha um job `infra` (só se `infra/**` mudou, via `dorny/paths-filter` ou
  `paths`): `terraform fmt -check -recursive`, `terraform init -backend=false` + `validate` nos dois
  diretórios. Sem credencial AWS.
- `infra-plan.yml`: em PR para `main`/`dev` que toca `infra/**` ou `apps/api/**`, assume a role por OIDC
  e roda `terraform plan` (com a tag de imagem atual), publicando o resumo no job summary. Pula verde se a
  variável de repositório `AWS_DEPLOY_ROLE_ARN` não existir (mesmo padrão do Sonar).
- `deploy-aws.yml`: em push para `main` e `workflow_dispatch`. Passos: OIDC → `docker buildx` ARM64 →
  push no ECR com tag = SHA → `terraform apply -auto-approve -var image_tag=<sha>` → `aws ecs wait
  services-stable` → smoke `curl` em `https://<cloudfront>/api/saude`. `concurrency` sem cancelamento.
  Variáveis de repositório: `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `TF_STATE_BUCKET`; secrets:
  `TF_VAR_UAZAPI_ADMIN_TOKEN`, `TF_VAR_NEW_RELIC_LICENSE_KEY`, `TF_VAR_BUDGET_EMAIL`.
- Primeira subida: o ECR precisa existir antes do push. O workflow faz `terraform apply
  -target=aws_ecr_repository.api` antes do build quando o repositório não existe (ou o doc instrui o
  primeiro apply manual) — decisão do builder, documentada.

## Progresso de campanhas em tempo real

### Fluxo

1. **Registro do webhook na UAZAPI**: ao criar/conectar uma instância (e numa ação idempotente
   "reconfigurar webhook" chamada também pela sincronização de instâncias), a API chama o endpoint de
   webhook da instância na UAZAPI com a URL
   `${API_PUBLIC_URL}/api/webhooks/uazapi/<instanciaId>/<assinatura>`, onde
   `assinatura = base64url(HMAC-SHA256(UAZAPI_WEBHOOK_SECRET, instanciaId))`. Eventos: os que cobrem
   progresso de envio em massa e status de mensagem (o builder **confere na documentação da UAZAPI**,
   `docs.uazapi.com`, o endpoint exato — esperado `POST /webhook` com token da instância — e os nomes de
   evento, esperados `sender` e `messages_update`; deve excluir eventos de mensagens recebidas para não
   receber conteúdo de conversas). Sem `API_PUBLIC_URL`, não registra (dev sem túnel) e loga um aviso.
2. **Recebimento**: `POST /api/webhooks/uazapi/:instanciaId/:assinatura` valida a assinatura com
   `timingSafeEqual`; inválida → 404 sem trabalho. Válida → responde 200 imediatamente e agenda, com
   **debounce por instância de 2 s**, a sincronização das campanhas dessa instância com status
   `agendada | enviando | pausada`. O webhook é **gatilho**, não fonte de verdade: a sincronização relê
   `/sender/listfolders` (fluxo já testado), então o formato exato do payload não importa. Continua
   logando só metadados (LGPD). A rota antiga sem parâmetros deixa de existir.
3. **Fallback por polling no servidor**: enquanto existir campanha `enviando` ou `agendada` com instância
   ativa, um laço no processo (intervalo 15 s, `setInterval` com `unref`, desligado em teste) sincroniza
   essas campanhas. Garante tempo real mesmo sem webhook (dev local, UAZAPI fora do ar, URL errada).
4. **Sincronização sem usuário**: novo `campanhaService.sincronizarPeloSistema(campanhaId)` que reaproveita
   `compararSincronizacao` e grava com a mesma transação + log (RN20). O log de sistema usa autor nulo
   se o schema de `log` permitir; se não permitir, o builder adiciona a forma mínima de registrar autor
   "sistema" via migration (decisão do builder, registrada no plano). Escopo de tenant: o `escritorioId`
   vem da própria campanha; nunca cruza tenants.
5. **Publicação**: quando a sincronização (de qualquer origem: botão, webhook, polling) muda algo, publica
   no barramento interno `EventosCampanha` o evento `{ tipo: "campanha.atualizada", escritorioId,
   campanha: CampanhaResumoDTO }` (DTO já usado pela lista/detalhe, sem `uazapiToken`). Barramento em
   memória (1 task). Interface pequena para trocar por Postgres `LISTEN/NOTIFY` se houver N tasks
   (documentado, não implementado).
6. **WebSocket**: biblioteca `ws` montada no servidor HTTP do Nest em `path: /api/ws` (sem
   `@nestjs/websockets`, para não acoplar ao adapter — decisão do Claude; o builder pode usar o gateway do
   Nest se ficar mais simples e testável, mantendo o contrato). Autenticação:
   - **Mesma origem** (dev, E2E, `vite preview`): cookie `crm_sessao` no upgrade.
   - **Cross-origin** (Vercel → CloudFront): `GET /api/tempo-real/ticket` (TenantGuard, via rewrite da
     Vercel, portanto com cookie) devolve `{ ticket }`: JWT HS256 de 60 s com `aud: "crm-ws"`,
     `sub`, `escritorioId`; o cliente conecta em `${VITE_WS_URL}/api/ws?ticket=...`. Ticket de uso único
     (guarda `jti` usados em memória até expirar).
   - Em ambos os casos o tenant é resolvido com `resolverTenantContext` (membro ativo, role do banco).
     Falha → fecha com código 4401. `Origin` fora de `WEB_ORIGINS` (e da própria origem) → 4403.
   - Servidor manda ping a cada 25 s e derruba conexão sem pong; limite de 5 conexões por usuário.
   - Mensagens do servidor: `{ tipo: "campanha.atualizada", campanha }` e `{ tipo: "pronto" }`. O cliente
     não envia nada além de pong (assinatura é implícita: o escritório da sessão).
7. **Web**: hook `useTempoRealCampanhas()` montado no layout autenticado (uma conexão por aba), com
   reconexão exponencial (1 s → 30 s), que pede ticket quando `VITE_WS_URL` está definido. Em
   `campanha.atualizada`: `setQueryData` nos detalhes em cache daquela campanha e na lista, e
   `invalidateQueries(["campanhas","mensagens",id])` com throttle de 3 s (status por destinatário vem da
   UAZAPI ao vivo). A tela de detalhe mostra "Ao vivo" (conectado) ou "Atualização manual" (desconectado);
   o botão Sincronizar continua existindo. Barra de progresso usa `logSucesso + logFalha` sobre
   `totalDestinatarios` (o builder confere o que a tela já mostra e mantém o vocabulário atual).

### Schema

- Índice em `instancia_whatsapp` não é necessário (busca por id da URL). Índice novo
  `campanha(instancia_whatsapp_id, status)` para a busca do webhook/polling, via migration.
- Possível ajuste em `log` para autor de sistema (ver item 4).

### Variáveis de ambiente novas (API)

`API_PUBLIC_URL`, `UAZAPI_WEBHOOK_SECRET`, `WEB_ORIGINS` (lista separada por vírgula),
`TEMPO_REAL_POLLING_MS` (padrão 15000; `0` desliga). Web: `VITE_WS_URL`. Entram em `.env.example`, CI
(valores dummy), docs e CLAUDE.md.

## Testes (TDD)

- Unitários: assinatura do webhook (válida/inválida/instância de outro escritório não importa porque o id
  vem assinado), debounce, polling (fake timers), `sincronizarPeloSistema` (não cruza tenant, só loga se
  mudou), publicação de evento, ticket (expira, `aud` errado, reuso), filtro por escritório no broadcast.
- Integração na API: subir o app numa porta efêmera e conectar com `ws` de dois escritórios; evento do A
  chega só no A; sem cookie/ticket → 4401.
- Web (Testing Library): hook com WebSocket falso — atualiza cache, reconecta, indicador "Ao vivo".
- E2E: um teste que abre o detalhe da campanha, dispara um evento (via webhook assinado contra a UAZAPI
  fake que o E2E já usa, ou via rota só-de-teste se não houver fake — decisão do builder) e vê o
  contador mudar sem clicar em Sincronizar.
- Infra: `terraform fmt -check`, `terraform validate` nos dois diretórios; `docker build` da imagem e
  `docker run` contra o Postgres local respondendo `/api/saude`.

## O que fica para o usuário (não automatizável pelo Claude)

`aws configure`/SSO local; `terraform apply` do bootstrap; variáveis/secrets no GitHub; primeiro deploy;
configurar `API_ORIGIN`/`VITE_WS_URL` no Project Vercel `pac`; reconfigurar webhook das instâncias
existentes (ação na UI de instâncias ou script); conferir o alerta de orçamento; `terraform destroy` após a
avaliação. Tudo isso vai num checklist em `docs/deploy/aws-terraform.md`.

## Deixado ao builder

Nomes internos de arquivos/classes dentro das convenções do repo; layout exato dos `.tf`; se usa gateway
do Nest ou `ws` direto; forma do autor "sistema" no log; como o E2E provoca o evento; o detalhe do primeiro
push no ECR.

## Decisões após a revisão de construtor (decisões do Claude; o usuário delegou: "pode decidir")

1. **Deploy Supabase (Vercel Functions) sem tempo real.** Flag `TEMPO_REAL_HABILITADO` na API (padrão
   `true`; o `.env`/doc do Project Supabase define `false`). Desligado: polling não roda, servidor WS não é
   montado e `GET /api/tempo-real/ticket` responde 404. O cliente **sempre** pede o ticket antes de
   conectar (também na mesma origem — some o caminho "cookie no upgrade"); 404 → não tenta reconectar e
   mostra "Atualização manual". Um só caminho de autenticação do WS.
2. **Instâncias UAZAPI compartilhadas entre deploys**: a URL do webhook é por instância, então a última
   que registrar vence. Documentado: o deploy acadêmico deve usar instâncias próprias. A rota antiga
   `POST /api/webhooks/uazapi` **continua** respondendo 200 e só logando metadados (compatibilidade com
   webhooks já configurados); a nova rota assinada é a que dispara trabalho.
3. **RDS/S3 acadêmicos antigos**: o Terraform cria recursos novos; nada é importado. Migração de dados
   (`pg_dump`/`pg_restore`, `aws s3 sync`) vira passo opcional do checklist do usuário.
4. **Autor "sistema" no log**: migration torna `log.usuario_id` anulável e adiciona `origem`
   (`usuario` | `sistema`, padrão `usuario`); a UI de histórico/auditoria mostra "Sistema" quando o autor
   é nulo. RN20 passa a dizer "quem (usuário ou sistema)".
5. **E2E**: servidor UAZAPI falso mínimo em `e2e/` (Node `http`, sem dependência nova) subido pelo
   `webServer` do Playwright e apontado por `UAZAPI_SERVER_URL` no E2E; serve `/sender/listfolders` (com
   contadores controláveis por uma rota do próprio fake), `/sender/listmessages` e `/webhook`. Campanha e
   instância do teste são semeadas direto no banco. O teste chama o webhook assinado (segredo conhecido
   do env de E2E) e verifica o contador mudar na tela sem clicar em Sincronizar.
6. **Migrations antes do deploy (corrige o texto anterior)**: o container **não** migra no start. O
   `deploy-aws.yml` faz: push da imagem → `terraform apply -target` só da task definition → `aws ecs
   run-task` com a revisão nova e `command` = `prisma migrate deploy` → espera parar e exige exit code 0
   → `terraform apply` completo → `aws ecs wait services-stable` → confere que o serviço roda **a revisão
   nova** e que o `rolloutState` do deployment primário é `COMPLETED` (rollback do circuit breaker falha
   o job) → smoke em `/api/saude`. Migrations devem ser expand/contract (compatíveis com a versão
   anterior em execução) — regra registrada em `docs/database/migrations-prisma.md`.
7. **DTO do evento**: `CampanhaDTO` existente (`packages/compartilhado/src/tipos/campanha.ts`).
8. **Terraform ≥ 1.11** (lock nativo GA). Uma role só para plan e apply (permissões de admin por trust
   restrita ao repo); o workflow de PR nunca roda `apply`.
