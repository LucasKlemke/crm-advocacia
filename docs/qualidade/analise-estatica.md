# Análise Estática — SonarCloud

O [Portfólio Directions](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-GERAL.md) lista "SonarQube, SonarCloud, CodeClimate" como ✅ Preferir, e o núcleo comum de engenharia da linha Web Apps ([directions-webapp.md](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-webapp.md)) exige "análise estática de código e segurança" como parte da documentação/entrega obrigatória. Este documento descreve como o SonarCloud está configurado no projeto — complementa [../testes/estrategia-tdd.md](../testes/estrategia-tdd.md) (fonte da cobertura importada) e [../git/commits-e-branches.md](../git/commits-e-branches.md) (regra de PR/merge).

## O que o SonarCloud verifica

- **Code smells** — violações de manutenibilidade (complexidade excessiva, duplicação de lógica, nomes/estrutura problemáticos).
- **Bugs** — padrões que tendem a causar erro em runtime, detectados estaticamente.
- **Security hotspots e vulnerabilidades** — padrões alinhados a OWASP Top 10 (injeção, uso inseguro de credenciais/segredos hardcoded, configuração insegura), especialmente relevante dado o volume de dados sensíveis (CPF, telefone, dados processuais — RNF06/LGPD) manipulado pelo sistema.
- **Duplicação de código** — percentual de linhas duplicadas no projeto.
- **Cobertura de testes** — importada do relatório do Jest (`coverage/lcov.info`, gerado por `npm test -- --coverage`), não recalculada pelo Sonar; é o mesmo número usado para a meta de [../testes/estrategia-tdd.md](../testes/estrategia-tdd.md).

## Configuração

- **`sonar-project.properties`** na raiz do repositório: `sonar.projectKey`, `sonar.organization`, `sonar.sources=src,app`, `sonar.tests` apontando para os arquivos `*.test.ts(x)` e `e2e/`, `sonar.javascript.lcov.reportPaths=coverage/lcov.info`, exclusões (`node_modules`, `prisma/migrations`, `.next`, `src/components/ui/**` — componentes gerados pelo shadcn CLI, ver [../app/design-system.md](../app/design-system.md)).
- **`SONAR_TOKEN`**: secret do repositório GitHub, usado apenas no job de CI, nunca em runtime da aplicação (ver [../deploy/deploy.md](../deploy/deploy.md)).

## Quando roda

Job dedicado no GitHub Actions (`sonarcloud-scan`), disparado em todo PR aberto contra `main` e em todo push em `main` (via `SonarSource/sonarqube-scan-action`). Depende do job de testes ter rodado antes, para consumir o `coverage/lcov.info` mais recente.

## Quality Gate — gate obrigatório de PR

O SonarCloud Quality Gate padrão ("Sonar way", focado em **new code** — código introduzido no próprio PR, não a base legada inteira) bloqueia o merge quando:

- Cobertura do código novo abaixo do limite configurado.
- Linhas duplicadas do código novo acima do limite.
- Existe qualquer issue nova classificada como Bug ou Vulnerability com severidade Blocker/Critical.
- Existe Security Hotspot novo não revisado.

O check do Quality Gate é exigido na branch protection de `main`, junto com os checks de Jest e Playwright (ver [../git/commits-e-branches.md](../git/commits-e-branches.md) — "PR só é elegível para merge com testes passando, cobertura dentro do threshold... e migration commitada quando há mudança de schema").

## Security hotspots — revisão obrigatória, não dispensa automática

Um Security Hotspot marcado como "Safe" precisa de uma justificativa registrada no próprio SonarCloud (comentário explicando por que aquele padrão não é uma vulnerabilidade real no contexto do projeto) antes de resolver o PR — nunca ignorado silenciosamente. Isso é especialmente relevante nos pontos do sistema que lidam com: geração/validação de JWT (NextAuth.js), queries Prisma com isolamento de tenant (RN19), upload de arquivos para S3, e chamadas ao `UazapiClient`/`EmailClient` com credenciais por escritório.
