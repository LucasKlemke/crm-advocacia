# Estratégia de Testes — TDD

O projeto é **test-driven**: para qualquer regra de negócio nova ou alterada (ver [../produto/regras-negocio.md](../produto/regras-negocio.md)) ou componente com lógica não-trivial, o teste é escrito e roda **falhando** antes da implementação. Um PR sem o(s) teste(s) correspondente(s) não é aceito — ver a exigência espelhada em [../git/commits-e-branches.md](../git/commits-e-branches.md).

## Ferramentas

| Camada | Ferramenta | Cobre |
|---|---|---|
| Services (regras de negócio) | Jest + `@swc/jest` | Toda lógica de `apps/api/src/dominio/services/*` isolada, com Repository mockado |
| Controllers (Nest) | Jest + supertest (`criarAppDeTeste`, `overrideProvider`) | Request → resposta HTTP, com Service substituído; validação de status code e shape de erro |
| Repositories | Jest + banco de teste (Postgres via Docker, ver [../database/docker-setup.md](../database/docker-setup.md)) | Queries Prisma reais contra um schema de teste, sem mock do banco |
| Componentes e hooks React (`apps/web`) | Jest (jsdom) + Testing Library | Comportamento observável pelo usuário (render, interação, estado), não detalhe de implementação |
| Fluxos ponta a ponta | **Playwright** | Caminho feliz + alternativos dos fluxos críticos, navegador real, contra o build de produção |

## Fluxos críticos cobertos por Playwright

- Cadastro de escritório (cria tenant + usuário titular) e login.
- Convite/gestão de colaborador pelo titular (e bloqueio quando um colaborador tenta).
- Cadastro de cliente, incluindo o erro de CPF duplicado no mesmo escritório.
- Mover um caso entre colunas do kanban.
- Disparo de mensagem via WhatsApp a partir de um template.

Cada fluxo cobre o caminho feliz e 1–2 caminhos alternativos relevantes (ver os `FA-*` em [../produto/regras-negocio.md](../produto/regras-negocio.md)). Playwright não substitui os testes unitários de regra de negócio — testa a integração ponta a ponta, não a combinatória de casos, que fica nos testes de Service.

## Metas de cobertura

O projeto está na linha de **Web Apps** do Portfólio (Católica SC), a única com **meta de cobertura obrigatória e institucional**: **75% no backend e 25% no frontend**, conferida individualmente na **prova de autoria** (30/11 ou, em segunda tentativa, até 03/12). Não atingir esse piso é reprovação no critério — com direito a uma correção e nova tentativa, mas sem terceira chance. Ver [Portfolio.md — Prova de Autoria](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/Portfolio.md) e [directions-webapp.md](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-webapp.md).

Esse piso institucional é medido em dois grupos amplos — **backend** e **frontend** — não por camada individual. O projeto usa metas internas mais altas por camada, que **somadas sempre ficam acima do piso**, então bater a meta interna garante automaticamente o piso institucional; a meta interna nunca deve ser relaxada para baixo do que o piso exige.

| Grupo (piso institucional) | Pacotes/camadas incluídos | Meta interna do projeto | Meta institucional (piso) |
|---|---|---|---|
| **Backend** | `apps/api/src/dominio/services/**`, `apps/api/src/dominio/repositories/**`, controllers (`apps/api/src/**/*.controller.ts`), `apps/api/src/comum/**`, `apps/api/src/dominio/lib/**` e `packages/compartilhado/src/**` | Services e `dominio/lib/auth` 90%, Repositories e Controllers 70%, `comum` 80%, global da API 75% (branches 70%), compartilhado 90% (branches 85%) | **75%** |
| **Frontend** | `apps/web/src/**` (exceto `components/ui/**` — gerado pelo shadcn — e `main.tsx`) | global ≥ 25% (linhas, funções, branches, statements) | **25%** |

Cada pacote tem o próprio `jest.config.cjs` com `coverageThreshold` (metas internas por camada). Como o Jest mede por arquivo/glob e não por grupo, `scripts/verificar-piso-cobertura.mjs` soma as linhas de `apps/api` + `packages/compartilhado` (backend) e de `apps/web` (frontend) a partir dos `coverage-summary.json` e falha abaixo de 75%/25%. `npm run test:coverage` (raiz) roda os três pacotes e depois o script. É o gate do CI e o número apresentado na prova de autoria. Os três `coverage/lcov.info` alimentam o SonarCloud ([../qualidade/analise-estatica.md](../qualidade/analise-estatica.md)).

Consequência de ficar abaixo da meta interna: build falha no CI (gate de PR). Consequência de ficar abaixo do piso institucional especificamente na prova de autoria: reprovação no critério de cobertura, com uma correção e segunda tentativa antes de reprovar na disciplina.

## Onde os testes vivem

- Unit/integração: colocation em cada pacote — `apps/api/src/dominio/services/cliente.service.test.ts` ao lado do service, `apps/api/src/clientes/clientes.controller.test.ts` (supertest) ao lado do controller, `apps/web/src/components/clientes/cliente-form.test.tsx` ao lado do componente, `packages/compartilhado/src/schemas/cliente.test.ts` ao lado do schema.
- E2E: pasta `e2e/` na raiz do projeto, um arquivo por fluxo crítico (`e2e/cadastro-escritorio.spec.ts`, `e2e/casos.spec.ts`, `e2e/clientes.spec.ts`, ...).
- Ambiente: os testes de Repository usam Postgres real (`docker compose up -d` + migrations aplicadas; `DATABASE_URL` vem de `apps/api/.env` ou do ambiente, como no CI). O setup do Jest da API (`apps/api/jest.setup.ts`) fixa `AWS_S3_PREFIX="development"` e não carrega `.env`, para a suíte não depender de segredos nem da máquina.

## Processo TDD no dia a dia

1. Antes de implementar uma regra de negócio nova, escrever o teste do `Service` que descreve o comportamento esperado (inclusive os casos de erro/validação da RN correspondente).
2. Rodar o teste e confirmar que falha pelo motivo certo (função ainda não existe / retorna algo diferente do esperado).
3. Implementar o mínimo necessário para o teste passar.
4. Refatorar com o teste como rede de segurança.
5. Repetir para componentes de UI com lógica: teste de comportamento (Testing Library) antes da implementação do componente.
6. Fluxo crítico novo ou alterado → atualizar/criar o spec Playwright correspondente antes de considerar a feature concluída.

## CI

Workflow `.github/workflows/ci.yml` (PRs e pushes em `dev`/`main`), com quatro jobs que viram checks obrigatórios de branch ([../qualidade/analise-estatica.md](../qualidade/analise-estatica.md)):

- `lint e typecheck`: `npm run lint` e `npm run typecheck`.
- `testes com cobertura`: Postgres como service container, `prisma migrate deploy`, `npm run test:coverage` (thresholds por camada + piso institucional); publica os três `lcov.info`.
- `e2e (build de produção)`: Postgres de serviço, `npm run build` e `npx playwright test` contra `apps/api/dist` (API :3001, iniciada por `npm run start -w @crm/api`) e `vite preview` do web (:4173), com `reuseExistingServer: false` e falha cedo se o build não existir. Também é gate obrigatório antes de merge.
- `SonarCloud`: baixa os `lcov.info` e roda o scan.
- Nenhuma suíte pode ser pulada com flag de skip/only esquecida — o ESLint (`jest/no-focused-tests`, `jest/no-disabled-tests`) cobre isso.
