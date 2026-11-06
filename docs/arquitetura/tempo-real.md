# Tempo real das campanhas (webhook → sincronização → barramento → WebSocket)

Como o progresso de um disparo em massa (campanha de WhatsApp) chega sozinho à tela, sem clicar em
"Sincronizar". Complementa [visao-geral.md](visao-geral.md) (camadas) e o deploy em
[../deploy/aws-terraform.md](../deploy/aws-terraform.md). Desenho e decisões completas:
[../superpowers/specs/2026-11-05-deploy-aws-e-tempo-real-design.md](../superpowers/specs/2026-11-05-deploy-aws-e-tempo-real-design.md)
(a seção "Decisões após a revisão de construtor" prevalece).

## Visão geral

```
UAZAPI ──POST /api/webhooks/uazapi/:instanciaId/:assinatura──┐
                                                             ▼
                                   AgendadorSincronizacao (janela de 2 s por instância)
polling a cada 15 s (campanhas agendada/enviando) ──────────►│
                                                             ▼
               campanhaService.sincronizarPeloSistema(campanhaId)  ── relê /sender/listfolders
                         │ mudou? grava + log (origem "sistema", RN20) na mesma transação
                         ▼
               eventosCampanha.publicar({ escritorioId, ... })   (barramento em memória, por escritório)
                         ▼
               servidor WS /api/ws → só os sockets daquele escritório
                         ▼
               useTempoRealCampanhas (web) → setQueryData / invalidateQueries
```

O botão "Sincronizar" e as ações `stop`/`continue`/`delete` da tela publicam no mesmo barramento, então
qualquer origem de mudança chega a todas as abas abertas do escritório.

## Peças

| Peça | Onde | O que faz |
|---|---|---|
| Registro do webhook | `instancia-whatsapp.service.ts` (`registrarWebhook`), `uazapi-client.ts` (`configurarWebhook`) | Ao criar, reconectar e em "sincronizar instâncias", chama `POST /webhook` da UAZAPI com o token da instância, eventos `sender` e `messages_update` (nunca `messages`: conteúdo de conversas não interessa, LGPD). URL = `${API_PUBLIC_URL}/api/webhooks/uazapi/<id>/<assinatura>`. Sem `API_PUBLIC_URL` ou `UAZAPI_WEBHOOK_SECRET`, não registra. Falha vira só aviso (o polling cobre). |
| Assinatura | `dominio/lib/auth/assinatura-webhook.ts` | `base64url(HMAC-SHA256(UAZAPI_WEBHOOK_SECRET, instanciaId))`, comparada com `timingSafeEqual`. A UAZAPI não manda cabeçalho de autenticação nosso, então o segredo vai na URL. |
| Webhook | `webhooks/uazapi-webhook.controller.ts` | Rota assinada: inválida → 404 sem log nem trabalho; válida → responde 200 e só **agenda** a instância. O payload não é lido (o webhook é gatilho, não fonte de verdade); o log tem só metadados. A rota antiga `POST /api/webhooks/uazapi` continua respondendo 200 e só loga (compatibilidade com webhooks já configurados). |
| Agendador | `tempo-real/agendador-sincronizacao.ts` | Agrupa avisos por instância numa janela de 2000 ms contada do primeiro aviso; rodadas da mesma instância nunca se sobrepõem; fila por campanha compartilhada com o polling. Polling de `TEMPO_REAL_POLLING_MS` (padrão 15000; `0` desliga) sobre campanhas `agendada`/`enviando` de instâncias não excluídas. Nenhum erro escapa: vira `console.error` e o laço segue. |
| Sincronização sem usuário | `campanhaService.sincronizarPeloSistema` | O `escritorioId` vem da própria campanha; instância excluída (`soft_deleted_at`) ou de outro escritório é ignorada. Só grava (e loga com `origem = 'sistema'`, `usuario_id` nulo) se algo mudou. |
| Barramento | `dominio/lib/tempo-real/eventos-campanha.ts` | Ouvintes indexados por `escritorioId` (RN19). Eventos: `campanha.atualizada` (com `CampanhaDTO`, nunca o token) e `campanha.removida` (só o id). Publicado depois do commit. |
| Ticket | `tempo-real/tempo-real.controller.ts`, `sessao-jwt.ts` | `GET /api/tempo-real/ticket` (TenantGuard, `Cache-Control: no-store`) devolve `{ ticket }`: JWT HS256 com `aud: "crm-ws"`, `sub`, `escritorioId`, `jti`, validade 60 s. Não serve como sessão. |
| Servidor WS | `tempo-real/servidor-ws.ts`, anexado no `main.ts` | `ws` no `upgrade` do `http.Server` do Nest, caminho `/api/ws?ticket=...`. Confere `Origin` (`WEB_ORIGINS` ou a própria origem), consome o `jti` (uso único), resolve o tenant no banco como o TenantGuard e assina o escritório **do ticket**: um usuário membro de dois escritórios só recebe eventos daquele do ticket. |
| Cliente | `apps/web`: hook `useTempoRealCampanhas` | Montado uma vez no layout autenticado (uma conexão por aba). Pede ticket, conecta em `${VITE_WS_URL}/api/ws?ticket=` (ou na mesma origem sem `VITE_WS_URL`), atualiza o cache do TanStack Query e mostra "Ao vivo" / "Atualização manual" no detalhe da campanha. |

## Contrato do WebSocket

Servidor → cliente (JSON); o cliente não envia nada além de `pong`:

```json
{ "tipo": "pronto" }
{ "tipo": "campanha.atualizada", "campanha": { "...": "CampanhaDTO (packages/compartilhado/src/tipos/campanha.ts)" } }
{ "tipo": "campanha.removida", "campanhaId": "<uuid>" }
```

| Fechamento | Quando | Cliente |
|---|---|---|
| `4401` | ticket ausente, inválido, expirado, reusado, ou sem acesso ao escritório | pede ticket novo e reconecta |
| `4403` | `Origin` fora de `WEB_ORIGINS` e diferente da própria API | (configuração errada) |
| `4429` | o usuário abriu a 6ª conexão: a mais antiga é fechada | **não** reconecta |
| `1011` | erro interno ao resolver o tenant | reconecta |
| `1001` | servidor desligando (deploy) | reconecta |

Ping do servidor a cada 25000 ms; quem não respondeu ao ping anterior é derrubado. Reconexão do cliente
com backoff exponencial de 1 s até 30 s, **sempre com ticket novo** (uso único). Ticket que responde
404 (tempo real desligado) → o cliente não tenta de novo e fica em "Atualização manual". Mensagens por
destinatário da campanha são reconsultadas com throttle de 3000 ms.

## Configuração por ambiente

| Variável | Dev local | Deploy acadêmico (AWS) | Deploy real (Supabase/Vercel) |
|---|---|---|---|
| `TEMPO_REAL_HABILITADO` | `true` (padrão) | `true` | **`false`** (Vercel Functions não mantêm processo vivo: sem polling, sem `/api/ws`, ticket → 404) |
| `API_PUBLIC_URL` | URL do ngrok (`npm run dev:tunnel`) ou vazio (só polling) | URL do CloudFront (Terraform) | vazio |
| `UAZAPI_WEBHOOK_SECRET` | qualquer valor | gerado pelo Terraform (Secrets Manager) | vazio (rota assinada responde 404) |
| `WEB_ORIGINS` | `http://localhost:5173,http://localhost:4173` | `web_origins` do Terraform | irrelevante (WS desligado) |
| `TEMPO_REAL_POLLING_MS` | `15000` | `15000` | irrelevante |
| `VITE_WS_URL` (web) | vazio (proxy do Vite) | `wss://<distribuição>.cloudfront.net` | vazio |

No dev local, o proxy `/api` do Vite precisa repassar o upgrade do WebSocket para a API em :3001.

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
- **O webhook não traz progresso confiável.** Por isso a sincronização sempre relê `/sender/listfolders`;
  o custo é uma chamada à UAZAPI por campanha ativa a cada janela.
