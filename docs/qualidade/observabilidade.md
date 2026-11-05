# Observabilidade — New Relic

O [Portfólio Directions](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-GERAL.md) lista New Relic entre as ferramentas ✅ Preferir de monitoramento, e o pilar "DevOps e Infraestrutura" da disciplina de Portfólio exige "definição clara sobre como o produto será monitorado". Este documento descreve o que é monitorado e como, complementando [../deploy/deploy.md](../deploy/deploy.md) (onde a app roda) e os requisitos não funcionais em `CLAUDE.md` (metas de tempo de resposta).

## Onde o agente roda

- **API NestJS (service `api` nos dois Projects da Vercel)** — agente APM do New Relic (pacote `newrelic`), carregado por `apps/api/src/instrumentacao.ts` **antes** do Nest, do Express e do `@prisma/client`, para que os três sejam instrumentados. Ele não é importado pelo `main.ts`: no bundle ESM os imports externos são avaliados antes do corpo do módulo, então o carregamento é por `--import`. O script `start` da API já faz isso (`node --enable-source-maps --import ./dist/instrumentacao.js dist/main.js`; em dev, `tsx watch --import ./src/instrumentacao.ts`), e na Vercel a flag vai em `NODE_OPTIONS=--import=./dist/instrumentacao.js` ([../deploy/deploy.md](../deploy/deploy.md)). **Nunca** iniciar com `node dist/main.js` sozinho: o agente não instrumenta. O módulo só importa `newrelic` quando `NEW_RELIC_LICENSE_KEY` existe, e a configuração é 100% por variável de ambiente (`NEW_RELIC_NO_CONFIG_FILE=true`, `NEW_RELIC_APP_NAME`, `NEW_RELIC_LOG=stdout`, distributed tracing e encaminhamento de logs ligados). As transações aparecem por rota do Express (ex.: `GET /api/clientes/:id`), granularidade das metas de NFR. Como o bundle do tsup deixa as dependências externas, `express` e `@prisma/client` são carregados de `node_modules` e instrumentáveis normalmente.
- **SPA (`apps/web`)** — sem agente. A latência percebida é medida pela API e, se necessário, pelo Browser agent do New Relic num passo futuro.
- **`NotificacaoScheduler` (AWS Lambda, ainda não implementado)** — quando existir, New Relic Lambda Layer, monitorado separadamente da API por rodar fora do processo do Nest.
- **Vercel Observability** — complementar e sem configuração: invocações, erros e duração da Function `api`, e Runtime Logs por deployment.

Em Fluid Compute a instância pode ser congelada entre requisições; o ciclo de envio do agente (harvest) pode atrasar dados de instâncias ociosas, mas não perde transações de instâncias ativas. Se os dashboards mostrarem lacunas, avaliar o encaminhamento de logs/traces via Vercel Drains (OpenTelemetry) para o New Relic.

`NEW_RELIC_LICENSE_KEY` é configurada como variável de ambiente só no ambiente Production dos Projects (ver [../deploy/deploy.md](../deploy/deploy.md)). O `.env.example` da API a deixa vazia: sem a chave o agente nem é carregado, para não gerar ruído de desenvolvimento e de preview nos dashboards.

## O que é monitorado

| Componente | Métrica | Por quê |
|---|---|---|
| Rotas da API Nest (`/api/**`) | Tempo de resposta e taxa de erro por rota, throughput, Apdex | Requisito não funcional: telas/buscas/salvamentos < 2s, dashboard < 3s (ver `CLAUDE.md`) |
| Queries Prisma | Tempo de execução por query, N+1 evidente | Volume esperado de até 1.000 clientes / 5.000 casos por escritório crescendo em número de tenants (RNF09) |
| Chamadas externas | Latência e taxa de erro de `UazapiClient`, `S3Client` | Dependências externas fora do controle do sistema; falha nelas não pode ficar invisível |
| `NotificacaoScheduler` (Lambda) | Duração de execução, taxa de erro/timeout, contagem de escritórios processados por execução (evento customizado) | RN12/RN14 — roda sem UI aberta; se falhar silenciosamente, nenhum usuário percebe até o prazo vencer |
| Disparo de mensagens WhatsApp | Evento customizado por tentativa (sucesso/falha/retentativa), correlacionado com `historico_mensagem` | RN15/RN16 — visibilidade agregada sobre confiabilidade do canal Uazapi, além do histórico por cliente já registrado no banco |

## Logs

Logs de erro estruturados em JSON (já exigido como requisito não funcional em `CLAUDE.md`: "Logs de erro estruturados; mensagens de erro ao usuário sem detalhes técnicos internos"). Na API Nest, o agente New Relic captura logs correlacionados ao trace da requisição. Na Lambda, logs vão para CloudWatch e são encaminhados ao New Relic via a integração nativa AWS ↔ New Relic (CloudWatch Logs subscription), preservando a correlação com o restante do sistema.

## Alertas

Políticas de alerta configuradas no New Relic para:

- Taxa de erro de API acima de um limite (ex.: > 5% em janela de 5 min).
- Tempo de resposta acima do orçamento do NFR (p95 > 2s em rotas gerais, > 3s no dashboard).
- Falha ou timeout de execução do `NotificacaoScheduler` — crítico, pois afeta RN12 silenciosamente.
- Taxa de falha de disparo de WhatsApp acima do esperado, mesmo após as 3 retentativas de RN16.

## Dashboards

Um dashboard principal por ambiente de produção, com painéis para: latência por rota de API, taxa de erro geral, execuções e falhas do `NotificacaoScheduler`, taxa de sucesso/falha de disparo de WhatsApp (a partir do evento customizado), e tempo de query do banco. É o primeiro lugar a checar após um deploy (ver [../deploy/deploy.md](../deploy/deploy.md) — "um pico de erro logo após deploy é o primeiro sinal para rollback").
