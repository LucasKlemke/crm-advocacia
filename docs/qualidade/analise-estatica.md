# Análise Estática — SonarCloud

O [Portfólio Directions](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-GERAL.md) lista "SonarQube, SonarCloud, CodeClimate" como ✅ Preferir, e o núcleo comum de engenharia da linha Web Apps ([directions-webapp.md](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-webapp.md)) exige "análise estática de código e segurança" como parte da documentação/entrega obrigatória. Este documento descreve como o SonarCloud está configurado no projeto — complementa [../testes/estrategia-tdd.md](../testes/estrategia-tdd.md) (fonte da cobertura importada) e [../git/commits-e-branches.md](../git/commits-e-branches.md) (regra de PR/merge).

## O que o SonarCloud verifica

- **Code smells** — violações de manutenibilidade (complexidade excessiva, duplicação de lógica, nomes/estrutura problemáticos).
- **Bugs** — padrões que tendem a causar erro em runtime, detectados estaticamente.
- **Security hotspots e vulnerabilidades** — padrões alinhados a OWASP Top 10 (injeção, uso inseguro de credenciais/segredos hardcoded, configuração insegura), especialmente relevante dado o volume de dados sensíveis (CPF, telefone, dados processuais — RNF06/LGPD) manipulado pelo sistema.
- **Duplicação de código** — percentual de linhas duplicadas no projeto.
- **Cobertura de testes** — importada dos relatórios do Jest (`coverage/lcov.info` de cada pacote, gerados por `npm run test:coverage`), não recalculada pelo Sonar; é o mesmo número usado para a meta de [../testes/estrategia-tdd.md](../testes/estrategia-tdd.md).

## Configuração

- **`sonar-project.properties`** na raiz: `sonar.sources=apps/api/src,apps/web/src,packages/compartilhado/src`, `sonar.tests` com os mesmos diretórios + `e2e`, `sonar.test.inclusions=**/*.test.ts,**/*.test.tsx,e2e/**/*.spec.ts`, `sonar.javascript.lcov.reportPaths` com os três relatórios (`apps/api/coverage/lcov.info`, `apps/web/coverage/lcov.info`, `packages/compartilhado/coverage/lcov.info`), exclusões (`dist`, `coverage`, `apps/api/prisma/migrations`, `apps/web/src/components/ui/**` — gerados pelo shadcn CLI, ver [../app/design-system.md](../app/design-system.md)) e `sonar.coverage.exclusions` espelhando as dos `jest.config.cjs` (bootstrap, módulos/tokens do Nest, tipos).
- **ESLint** (`eslint.config.mjs`, flat config do monorepo) complementa o Sonar no PR: regras de fronteira entre pacotes (web não importa Prisma/API; compartilhado não importa apps; controller não importa repository), acessibilidade (`jsx-a11y`) e proibição de `.only`/`.skip` em testes.
- **`SONAR_TOKEN`**: secret do repositório GitHub, usado apenas no job de CI, nunca em runtime da aplicação (ver [../deploy/deploy.md](../deploy/deploy.md)).

### Setup do SonarCloud (passo a passo manual)

1. Entrar em [sonarcloud.io](https://sonarcloud.io) com a conta do GitHub, **Analyze new project** e importar o repositório. Anotar a **Organization Key** e a **Project Key**; se forem diferentes dos valores de `sonar.organization` / `sonar.projectKey` em `sonar-project.properties` (hoje marcados "CONFIRMAR" no arquivo), corrigi-los lá.
2. No projeto: Administration → Analysis Method → desligar **Automatic Analysis** (conflita com o scan da CI).
3. Gerar o token: My Account → Security → Generate Token.
4. No GitHub: Settings → Secrets and variables → Actions → New repository secret `SONAR_TOKEN` com o valor do token.
5. Abrir um PR (ou dar push em `dev`/`main`) para o workflow rodar pela primeira vez e conferir que o job `sonarcloud` encontra os três `lcov.info`.
6. No SonarCloud, definir o Quality Gate do projeto (padrão "Sonar way") e, opcionalmente, o código novo como "previous version" ou 30 dias.
7. **Limitação**: PRs vindos de forks não recebem `SONAR_TOKEN`, então o job `sonarcloud` falharia neles (não afeta PRs de branches do próprio repositório).

### Proteção de branch (GitHub)

Settings → Branches → regra para `dev` e `main`, exigindo os checks abaixo. Eles só aparecem na lista depois de terem rodado uma vez (passo 5 acima):

- `lint e typecheck`
- `testes com cobertura`
- `e2e (build de produção)`
- `SonarCloud Code Analysis` (check do Quality Gate publicado pelo SonarCloud no PR; se a lista mostrar apenas o job `SonarCloud` do workflow, exija esse)

Sem commit direto em `main`; merge só por PR (ver [../git/commits-e-branches.md](../git/commits-e-branches.md)).

## Quando roda

Job `sonarcloud` em `.github/workflows/ci.yml`, disparado em todo PR contra `dev`/`main` e em todo push nessas branches (via `SonarSource/sonarqube-scan-action`). Depende do job `testes com cobertura`, de onde baixa os três `lcov.info` como artefato (`fetch-depth: 0` para o cálculo de código novo).

## Quality Gate — gate obrigatório de PR

O SonarCloud Quality Gate padrão ("Sonar way", focado em **new code** — código introduzido no próprio PR, não a base legada inteira) bloqueia o merge quando:

- Cobertura do código novo abaixo do limite configurado.
- Linhas duplicadas do código novo acima do limite.
- Existe qualquer issue nova classificada como Bug ou Vulnerability com severidade Blocker/Critical.
- Existe Security Hotspot novo não revisado.

O check do Quality Gate é exigido na branch protection de `dev` e `main`, junto com os checks de lint, Jest e Playwright (ver [../git/commits-e-branches.md](../git/commits-e-branches.md) — "PR só é elegível para merge com testes passando, cobertura dentro do threshold... e migration commitada quando há mudança de schema").

## Security hotspots — revisão obrigatória, não dispensa automática

Um Security Hotspot marcado como "Safe" precisa de uma justificativa registrada no próprio SonarCloud (comentário explicando por que aquele padrão não é uma vulnerabilidade real no contexto do projeto) antes de resolver o PR — nunca ignorado silenciosamente. Isso é especialmente relevante nos pontos do sistema que lidam com: geração/validação do JWT de sessão (`jose`, cookie `crm_sessao`), queries Prisma com isolamento de tenant (RN19), upload de arquivos para S3, e chamadas ao `UazapiClient` (e ao futuro `EmailClient`) com credenciais por escritório.
