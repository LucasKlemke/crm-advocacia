# Observabilidade — New Relic

O [Portfólio Directions](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-GERAL.md) lista New Relic entre as ferramentas ✅ Preferir de monitoramento, e o pilar "DevOps e Infraestrutura" da disciplina de Portfólio exige "definição clara sobre como o produto será monitorado". Este documento descreve o que é monitorado e como, complementando [../deploy/deploy.md](../deploy/deploy.md) (onde a app roda) e os requisitos não funcionais em `CLAUDE.md` (metas de tempo de resposta).

## Onde o agente roda

- **Aplicação Next.js (Vercel, nos dois Projects de produção)** — agente de APM do New Relic (pacote `newrelic`), instrumentado via `instrumentation.ts` do Next.js (App Router), carregado antes de qualquer outra inicialização.
- **`NotificacaoScheduler` (AWS Lambda, ainda não implementado)** — quando existir, New Relic Lambda Layer, monitorado separadamente da aplicação web por rodar fora do processo do Next.js.

`NEW_RELIC_LICENSE_KEY` é configurada como variável de ambiente em produção (ver [../deploy/deploy.md](../deploy/deploy.md)); não roda localmente por padrão, para não gerar ruído de dados de desenvolvimento nos dashboards.

## O que é monitorado

| Componente | Métrica | Por quê |
|---|---|---|
| API Routes (`app/api/**`) | Tempo de resposta e taxa de erro por rota, throughput, Apdex | Requisito não funcional: telas/buscas/salvamentos < 2s, dashboard < 3s (ver `CLAUDE.md`) |
| Queries Prisma | Tempo de execução por query, N+1 evidente | Volume esperado de até 1.000 clientes / 5.000 casos por escritório crescendo em número de tenants (RNF09) |
| Chamadas externas | Latência e taxa de erro de `UazapiClient`, `S3Client`, `EmailClient` | Dependências externas fora do controle do sistema; falha nelas não pode ficar invisível |
| `NotificacaoScheduler` (Lambda) | Duração de execução, taxa de erro/timeout, contagem de escritórios processados por execução (evento customizado) | RN12/RN14 — roda sem UI aberta; se falhar silenciosamente, nenhum usuário percebe até o prazo vencer |
| Disparo de mensagens WhatsApp | Evento customizado por tentativa (sucesso/falha/retentativa), correlacionado com `historico_mensagem` | RN15/RN16 — visibilidade agregada sobre confiabilidade do canal Uazapi, além do histórico por cliente já registrado no banco |

## Logs

Logs de erro estruturados em JSON (já exigido como requisito não funcional em `CLAUDE.md`: "Logs de erro estruturados; mensagens de erro ao usuário sem detalhes técnicos internos"). Na aplicação Next.js, o agente New Relic captura logs correlacionados ao trace da requisição. Na Lambda, logs vão para CloudWatch e são encaminhados ao New Relic via a integração nativa AWS ↔ New Relic (CloudWatch Logs subscription), preservando a correlação com o restante do sistema.

## Alertas

Políticas de alerta configuradas no New Relic para:

- Taxa de erro de API acima de um limite (ex.: > 5% em janela de 5 min).
- Tempo de resposta acima do orçamento do NFR (p95 > 2s em rotas gerais, > 3s no dashboard).
- Falha ou timeout de execução do `NotificacaoScheduler` — crítico, pois afeta RN12 silenciosamente.
- Taxa de falha de disparo de WhatsApp acima do esperado, mesmo após as 3 retentativas de RN16.

## Dashboards

Um dashboard principal por ambiente de produção, com painéis para: latência por rota de API, taxa de erro geral, execuções e falhas do `NotificacaoScheduler`, taxa de sucesso/falha de disparo de WhatsApp (a partir do evento customizado), e tempo de query do banco. É o primeiro lugar a checar após um deploy (ver [../deploy/deploy.md](../deploy/deploy.md) — "um pico de erro logo após deploy é o primeiro sinal para rollback").
