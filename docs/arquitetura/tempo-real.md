# Tempo real das campanhas e instâncias (webhook → sincronização → barramento → WebSocket)

Como o progresso de um disparo em massa (campanha de WhatsApp) — contadores, status da campanha e o
status de cada mensagem (enviada → entregue → lida) — e a conexão das instâncias (QR code lido,
número, foto) chegam sozinhos à tela, sem clicar em "Sincronizar" nem em "Verificar conexão". Complementa [visao-geral.md](visao-geral.md) (camadas) e o deploy em
[../deploy/aws-terraform.md](../deploy/aws-terraform.md). Desenho e decisões completas:
[../superpowers/specs/2026-11-05-deploy-aws-e-tempo-real-design.md](../superpowers/specs/2026-11-05-deploy-aws-e-tempo-real-design.md)
(a seção "Decisões após a revisão de construtor" prevalece).

## Visão geral

```
UAZAPI ──POST /api/webhooks/uazapi/:instanciaId/:assinatura──┐
                                                             ▼
                         AgendadorSincronizacao: EventType/event do payload
             ┌──────────────── `connection` ─────────┴──── `sender`, `messages_update`, outro ─┐
             ▼                                                                                 ▼
   janela de 500 ms por instância                          janela de 2 s por instância
   instanciaWhatsappService                                campanhas ativas + concluídas atualizadas
     .verificarStatusPeloSistema(id)                       nas últimas 24 h da instância
     relê /instance/status                                         │   polling a cada 15 s
     mudou? grava + log (sistema)                                  │◄─ (campanhas agendada/enviando)
             │                                                     ▼
             │                       campanhaService.sincronizarPeloSistema(id, origem)
             │                         relê /sender/listfolders; mudou? grava + log (sistema, RN20)
             ▼                                                     ▼
   instancia.atualizada               campanha.atualizada (se mudou) + campanha.mensagens (se webhook)
             └───────────────► eventosCampanha.publicar({ escritorioId, ... })  (memória, por escritório)
                                                     ▼
                               servidor WS /api/ws → só os sockets daquele escritório
                                                     ▼
                   useTempoRealCampanhas (web) → setQueryData / invalidateQueries
```

O botão "Sincronizar", as ações `stop`/`continue`/`delete` da campanha e as escritas do usuário em
instâncias (criar, reconectar, desconectar, verificar status, sincronizar instâncias, excluir) publicam no
mesmo barramento, então qualquer origem de mudança chega a todas as abas abertas do escritório.

## Peças

| Peça | Onde | O que faz |
|---|---|---|
| Registro do webhook | `instancia-whatsapp.service.ts` (`registrarWebhook`), `uazapi-client.ts` (`configurarWebhook`) | Ao criar, reconectar e em "sincronizar instâncias", chama `POST /webhook` da UAZAPI com o token da instância, eventos `sender`, `messages_update` e `connection` (nunca `messages`: conteúdo de conversas não interessa, LGPD). **Instâncias que já existiam antes do `connection` entrar na lista precisam ter o webhook registrado de novo** — basta clicar em "Sincronizar instâncias" na tela de instâncias (ou reconectar); até lá elas só recebem os eventos de campanha. URL = `${API_PUBLIC_URL}/api/webhooks/uazapi/<id>/<assinatura>`. Sem `API_PUBLIC_URL` ou `UAZAPI_WEBHOOK_SECRET`, não registra. Falha vira só aviso (o polling cobre). |
| Assinatura | `dominio/lib/auth/assinatura-webhook.ts` | `base64url(HMAC-SHA256(UAZAPI_WEBHOOK_SECRET, instanciaId))`, comparada com `timingSafeEqual`. A UAZAPI não manda cabeçalho de autenticação nosso, então o segredo vai na URL. |
| Webhook | `webhooks/uazapi-webhook.controller.ts` | Rota assinada: inválida → 404 sem log nem trabalho; válida → responde 200 e só **agenda**: `connection` agenda a verificação de status da instância; qualquer outro tipo (`sender`, `messages_update`, desconhecido) agenda as campanhas da instância. Do payload só se lê o tipo (`EventType` ou `event`): o webhook é gatilho, não fonte de verdade; o log tem só metadados. A rota antiga `POST /api/webhooks/uazapi` continua respondendo 200 e só loga (compatibilidade com webhooks já configurados). |
| Agendador | `tempo-real/agendador-sincronizacao.ts` | Agrupa avisos por instância numa janela contada do primeiro aviso — 2000 ms para campanhas (`DEBOUNCE_WEBHOOK_MS`), 500 ms para conexão (`DEBOUNCE_CONEXAO_MS`), janelas independentes; rodadas da mesma instância nunca se sobrepõem; fila por campanha compartilhada com o polling. No webhook de campanha, sincroniza as campanhas `agendada`/`enviando`/`pausada` **e as `concluida` atualizadas nas últimas 24 h** (`JANELA_ENCERRADAS_WEBHOOK_MS`): confirmações de entrega/leitura continuam chegando depois que o envio termina. Polling de `TEMPO_REAL_POLLING_MS` (padrão 15000; `0` desliga) sobre campanhas `agendada`/`enviando` de instâncias não excluídas. Nenhum erro escapa: vira `console.error` e o laço segue. |
| Sincronização sem usuário | `campanhaService.sincronizarPeloSistema(id, origem)`, `instanciaWhatsappService.verificarStatusPeloSistema(id)` | O `escritorioId` vem da própria linha; instância excluída (`soft_deleted_at`) ou de outro escritório é ignorada. Só grava (e loga com `origem = 'sistema'`, `usuario_id` nulo, na mesma transação — RN20) se algo mudou. Campanha vinda do **webhook** publica `campanha.mensagens` mesmo sem mudança nos contadores: o `messages_update` (entregue/lida) muda só o status por destinatário, que não é espelhado no banco (a tela lê ao vivo de `/sender/listmessages`). |
| Barramento | `dominio/lib/tempo-real/eventos-campanha.ts` | Ouvintes indexados por `escritorioId` (RN19). Eventos: `campanha.atualizada` (com `CampanhaDTO`, nunca o token), `campanha.removida` (só o id), `campanha.mensagens` (só o id: reconsultar o status por destinatário) e `instancia.atualizada` (com `InstanciaWhatsappDTO` de `serializarInstancia`, nunca o token; `softDeletedAt` preenchido quando foi excluída). Publicado depois do commit. |
| Ticket | `tempo-real/tempo-real.controller.ts`, `sessao-jwt.ts` | `GET /api/tempo-real/ticket` (TenantGuard, `Cache-Control: no-store`) devolve `{ ticket }`: JWT HS256 com `aud: "crm-ws"`, `sub`, `escritorioId`, `jti`, validade 60 s. Não serve como sessão. |
| Servidor WS | `tempo-real/servidor-ws.ts`, anexado no `main.ts` | `ws` no `upgrade` do `http.Server` do Nest, caminho `/api/ws?ticket=...`. Confere `Origin` (`WEB_ORIGINS` ou a própria origem), consome o `jti` (uso único), resolve o tenant no banco como o TenantGuard e assina o escritório **do ticket**: um usuário membro de dois escritórios só recebe eventos daquele do ticket. Máximo de 5 conexões por usuário (a 6ª derruba a mais antiga com 4429). **Revalidação periódica**: a cada 4 ciclos de ping (`CICLOS_REVALIDACAO`, ~100 s) o tenant da conexão é resolvido de novo no banco; membro removido/desativado ou escritório inacessível → fecha com 4401; erro transitório (banco fora) mantém o socket, loga e tenta no ciclo seguinte. |
| Cliente | `apps/web`: hook `useTempoRealCampanhas` | Montado uma vez no layout autenticado (uma conexão por aba). Pede ticket, conecta em `${VITE_WS_URL}/api/ws?ticket=` (ou na mesma origem sem `VITE_WS_URL`), atualiza o cache do TanStack Query e mostra "Ao vivo" / "Atualização manual" no detalhe da campanha. `instancia.atualizada` substitui a instância na lista em cache (a excluída sai; a desconhecida invalida a lista) e invalida lista/detalhe das campanhas; o diálogo do QR code (`qrcode-dialog.tsx`) lê a instância desse cache e fecha sozinho na transição para `connected` ("Verificar conexão" fica como atalho manual). |

## Contrato do WebSocket

Servidor → cliente (JSON); o cliente não envia nada além de `pong`:

```json
{ "tipo": "pronto" }
{ "tipo": "campanha.atualizada", "campanha": { "...": "CampanhaDTO (packages/compartilhado/src/tipos/campanha.ts)" } }
{ "tipo": "campanha.removida", "campanhaId": "<uuid>" }
{ "tipo": "campanha.mensagens", "campanhaId": "<uuid>" }
{ "tipo": "instancia.atualizada", "instancia": { "...": "InstanciaWhatsappDTO (packages/compartilhado/src/tipos/instancia-whatsapp.ts)" } }
```

O tipo da união vive em `packages/compartilhado/src/tipos/tempo-real.ts` (`MensagemTempoReal`), usado pelo
servidor para serializar e pelo cliente para interpretar; nenhuma mensagem leva `escritorioId` no
envelope. Tipo desconhecido ou payload incompleto é descartado pelo cliente (`interpretarMensagem`).

| Fechamento | Quando | Cliente |
|---|---|---|
| `4401` | ticket ausente, inválido, expirado, reusado, ou sem acesso ao escritório; também membro removido detectado na revalidação (~100 s) | pede ticket novo e reconecta. Se o acesso foi revogado, o pedido de ticket falha e o cliente segue no backoff (até 30 s) sem nunca voltar a "Ao vivo" |
| `4403` | `Origin` fora de `WEB_ORIGINS` e diferente da própria API | **para** (`FECHAMENTOS_DEFINITIVOS`): "Atualização manual" |
| `4429` | o usuário abriu a 6ª conexão: a mais antiga é fechada | **para** (`FECHAMENTOS_DEFINITIVOS`; reconectar derrubaria outra aba): "Atualização manual" |
| `1011` | erro interno ao resolver o tenant | reconecta |
| `1001` | servidor desligando (deploy) | reconecta |

Ping do servidor a cada 25000 ms; quem não respondeu ao ping anterior é derrubado. Reconexão do cliente
com backoff exponencial de 1 s até 30 s, **sempre com ticket novo** (uso único). Ticket que responde
404 (tempo real desligado), 403 (sem permissão) ou sessão expirada no pedido do ticket → o cliente não tenta de novo e fica em
"Atualização manual" (`apps/web/src/lib/tempo-real.ts`). Mensagens por
destinatário da campanha são reconsultadas com throttle de 3000 ms, tanto em `campanha.atualizada`
quanto em `campanha.mensagens`.

## Logs de diagnóstico

Só metadados (nunca telefone, texto de mensagem, ticket ou URL — LGPD):

| Linha | Quando |
|---|---|
| `[webhook uazapi] { tipo, bytes, instanciaId }` | cada webhook assinado válido |
| `[tempo-real] campanha sincronizada { campanhaId, origem: "webhook" \| "polling", mudou }` | cada sincronização de campanha pelo sistema |
| `[tempo-real] instância sincronizada { instanciaId, mudou }` | cada verificação de status pelo sistema (webhook `connection`) |
| `[tempo-real] socket { evento: "aberto" }` / `{ evento: "fechado", codigo }` | cada WebSocket autenticado que abre / fecha |
| `[tempo-real] falha ao ... { ids }` (`console.error`) | erro de UAZAPI/banco numa sincronização; o laço segue |

## Configuração por ambiente

| Variável | Dev local | Deploy acadêmico (AWS) | Deploy real (Supabase/Vercel) |
|---|---|---|---|
| `TEMPO_REAL_HABILITADO` | `true` (padrão fora da Vercel; sem valor e com `VERCEL` definido, desligado) | `true` | **`false`** (Vercel Functions não mantêm processo vivo: sem polling, sem `/api/ws`, ticket → 404) |
| `API_PUBLIC_URL` | URL do ngrok (`npm run dev:tunnel`) ou vazio (só polling) | URL do CloudFront (Terraform) | vazio |
| `UAZAPI_WEBHOOK_SECRET` | qualquer valor | gerado pelo Terraform (Secrets Manager) | vazio (rota assinada responde 404) |
| `WEB_ORIGINS` | `http://localhost:5173,http://localhost:4173` | `web_origins` do Terraform | irrelevante (WS desligado) |
| `TEMPO_REAL_POLLING_MS` | `15000` | `15000` | irrelevante |
| `VITE_WS_URL` (web) | vazio (proxy do Vite) | `wss://<distribuição>.cloudfront.net` | vazio |

No dev local e no `vite preview`, o proxy `/api` do Vite tem `ws: true` (`apps/web/vite.config.ts`) e
repassa o upgrade do WebSocket para a API em :3001, na mesma origem.

## Limites conhecidos

- **Uma task, memória do processo.** Barramento, assinantes, `jti` usados e janelas de debounce vivem na
  memória de um único processo. Com N tasks no ECS, um evento publicado na task A não chegaria a sockets
  da task B, e um ticket poderia ser reusado em outra task. O Terraform fixa `desired_count = 1`.
- **Como escalar:** trocar a implementação de `eventosCampanha` por Postgres `LISTEN/NOTIFY` (a
  interface `publicar`/`assinar` não muda): `publicar` faz `pg_notify('campanha', json)` depois do
  commit e cada task mantém uma conexão `LISTEN` dedicada (fora do pool do Prisma, sem pooler em modo
  transação) que reentrega aos ouvintes locais. O payload do `NOTIFY` tem limite de 8000 bytes — mandar
  só `escritorioId` + `campanhaId` e reler a campanha. Os `jti` usados iriam para uma tabela com
  expiração (ou Redis), e o polling passaria a rodar em uma task só (lock consultivo
  `pg_try_advisory_lock`).
- **Webhook por instância, último vence.** A UAZAPI guarda uma URL de webhook por instância. Se dois
  deploys usarem a mesma instância, o último que registrar recebe os avisos; o outro cai no polling. O
  deploy acadêmico deve usar instâncias próprias.
- **Sem tempo real no deploy Supabase.** A tela continua funcionando com o botão "Sincronizar".
- **O webhook não traz progresso confiável.** Por isso a sincronização sempre relê `/sender/listfolders`
  (e `/instance/status` no `connection`); o custo é uma chamada à UAZAPI por campanha ativa ou concluída
  nas últimas 24 h a cada janela, mais uma releitura de `/sender/listmessages` por aba com o detalhe
  aberto (throttle de 3 s).
- **Campanha concluída há mais de 24 h** sem nenhuma mudança deixa de ser vigiada pelo webhook: uma
  leitura que chegue depois disso só aparece abrindo o detalhe de novo (a tabela sempre lê ao vivo).
- **Payload do `connection` não é interpretado:** qualquer `connection` dispara uma releitura de
  `/instance/status`; o formato exato do corpo enviado pela UAZAPI não importa.
