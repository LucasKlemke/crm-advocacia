# Estratégia de Testes — TDD

O projeto é **test-driven**: para qualquer regra de negócio nova ou alterada (ver [../produto/regras-negocio.md](../produto/regras-negocio.md)) ou componente com lógica não-trivial, o teste é escrito e roda **falhando** antes da implementação. Um PR sem o(s) teste(s) correspondente(s) não é aceito — ver a exigência espelhada em [../git/commits-e-branches.md](../git/commits-e-branches.md).

## Ferramentas

| Camada | Ferramenta | Cobre |
|---|---|---|
| Services (regras de negócio) | Jest | Toda lógica de `src/services/*` isolada, com Repository mockado |
| Controllers / route handlers | Jest | Request → resposta HTTP, com Service mockado; validação de status code e shape de erro |
| Repositories | Jest + banco de teste (Postgres via Docker, ver [../database/docker-setup.md](../database/docker-setup.md)) | Queries Prisma reais contra um schema de teste, sem mock do banco |
| Componentes React | Jest + Testing Library | Comportamento observável pelo usuário (render, interação, estado), não detalhe de implementação |
| Fluxos ponta a ponta | **Playwright** | Caminho feliz + alternativos dos fluxos críticos, navegador real |

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

| Grupo (piso institucional) | Camadas incluídas | Meta interna do projeto | Meta institucional (piso) |
|---|---|---|---|
| **Backend** | `src/services/**`, `src/repositories/**`, `app/api/**` (Controllers), `src/lib/external/**` | Services ~90%, Repositories/Controllers ~70–80% — média ponderada do grupo sempre ≥ 75% | **75%** |
| **Frontend** | `src/components/**`, `src/hooks/**`, componentes de feature em `app/**/_components/**` | Cobertura de comportamento via Testing Library em todo componente com lógica; componentes puramente apresentacionais isentos, mas isso não pode derrubar a média do grupo abaixo de **25%** | **25%** |

Consequência de ficar abaixo da meta interna: build falha no CI (gate de PR). Consequência de ficar abaixo do piso institucional especificamente na prova de autoria: reprovação no critério de cobertura, com uma correção e segunda tentativa antes de reprovar na disciplina.

Configurado em `jest.config` via `coverageThreshold` com dois grupos de glob (`backend` e `frontend`, agrupando os diretórios da tabela acima) além dos limites mais granulares por camada dentro de `backend`. `npm test -- --coverage` roda no CI e falha o pipeline abaixo de qualquer um dos limites configurados. O relatório `coverage/lcov.info` gerado por esse comando também alimenta o SonarCloud — ver [../qualidade/analise-estatica.md](../qualidade/analise-estatica.md) — e deve ser o mesmo número apresentado na prova de autoria.

## Onde os testes vivem

- Unit/integração: colocation — `cliente.service.test.ts` ao lado de `cliente.service.ts`, `ClienteFormModal.test.tsx` ao lado do componente.
- E2E: pasta `e2e/` na raiz do projeto, um arquivo por fluxo crítico (`e2e/cadastro-escritorio.spec.ts`, `e2e/kanban.spec.ts`).

## Processo TDD no dia a dia

1. Antes de implementar uma regra de negócio nova, escrever o teste do `Service` que descreve o comportamento esperado (inclusive os casos de erro/validação da RN correspondente).
2. Rodar o teste e confirmar que falha pelo motivo certo (função ainda não existe / retorna algo diferente do esperado).
3. Implementar o mínimo necessário para o teste passar.
4. Refatorar com o teste como rede de segurança.
5. Repetir para componentes de UI com lógica: teste de comportamento (Testing Library) antes da implementação do componente.
6. Fluxo crítico novo ou alterado → atualizar/criar o spec Playwright correspondente antes de considerar a feature concluída.

## CI

- `npm test -- --coverage` (Jest, unit/integração) é gate obrigatório em todo PR, com os thresholds acima.
- Playwright roda como job separado (mais lento, precisa do banco de teste + app buildada) e também é gate obrigatório antes de merge em `main`.
- Nenhuma das duas suítes pode ser pulada com flag de skip/only esquecida — checagem de lint/CI cobre isso.
