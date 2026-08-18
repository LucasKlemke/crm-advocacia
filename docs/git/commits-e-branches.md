# Commits e Branches

Regras de auditoria e rastreamento do histórico do projeto. Ver [../testes/estrategia-tdd.md](../testes/estrategia-tdd.md) para a exigência de testes que se aplica a todo commit de regra de negócio, e [../database/migrations-prisma.md](../database/migrations-prisma.md) para a regra de commitar migration junto do código que a motivou.

## Conventional Commits

Toda mensagem de commit segue:

```
<tipo>(<escopo opcional>): <descrição no imperativo>
```

Tipos usados no projeto:

| Tipo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade ou regra de negócio |
| `fix` | Correção de bug |
| `refactor` | Mudança de estrutura interna sem alterar comportamento |
| `test` | Adição/ajuste de testes sem mudar comportamento de produção |
| `docs` | Mudança em documentação (`docs/`, `CLAUDE.md`) |
| `chore` | Manutenção que não é código de produto (deps, config, CI) |
| `style` | Formatação, sem mudança de lógica (lint/prettier) |
| `perf` | Melhoria de performance sem mudar comportamento observável |

Exemplos concretos, usando entidades do domínio (ver [../produto/regras-negocio.md](../produto/regras-negocio.md)):

```
feat(clientes): adiciona validação de CPF único por escritório
fix(prazos): corrige cálculo de prazo retroativo em fuso horário negativo
test(casos): cobre RN09 — exclusão de estágio só com kanban vazio
docs(database): documenta fluxo de rollback de migration
chore(deps): atualiza prisma para 5.20
refactor(mensagens): extrai substituição de variáveis de template para função pura
```

## Branches

Padrão `<tipo>/<slug>`, slug curto em kebab-case descrevendo a mudança:

- `feature/cadastro-escritorio`
- `feature/convite-colaborador`
- `fix/prazo-retroativo-fuso`
- `chore/setup-playwright`
- `docs/estrategia-testes`

Sem prefixo de número de ticket — projeto solo/portfólio, sem tracker externo. Se isso mudar no futuro (ex. adoção de issues no GitHub), o padrão passa a ser `feature/123-cadastro-escritorio`.

## Granularidade de commit

Um commit cobre uma mudança logicamente coesa. Não misturar, no mesmo commit:

- Uma feature nova (`feat`) com uma refatoração não relacionada (`refactor`) em outro módulo.
- Mudança de schema/migration com uma feature completamente não relacionada.
- Mensagens em português, consistente com o restante da documentação e do domínio (nomes de entidade em português: `cliente`, `caso`, `prazo`).

## Testes e migrations no mesmo commit

- Commit que adiciona ou altera uma regra de negócio **inclui o teste correspondente no mesmo commit** — não existe "depois eu escrevo o teste" (reforça o TDD de [../testes/estrategia-tdd.md](../testes/estrategia-tdd.md)).
- Commit que altera `prisma/schema.prisma` inclui a pasta de migration gerada (`prisma/migrations/<timestamp>_<nome>/`) no mesmo commit ou mesmo PR que o código que depende dela (ver [../database/migrations-prisma.md](../database/migrations-prisma.md)).

## Pull Requests e merge

- Nenhum commit direto em `main` — toda mudança entra via PR de uma branch `feature/*`, `fix/*`, etc.
- Merge para `main` é feito via **squash**: o histórico de `main` fica com um commit por PR, seguindo o Conventional Commits, mesmo que a branch tenha tido commits intermediários menos organizados durante o desenvolvimento.
- PR só é elegível para merge com: testes passando (Jest + Playwright, ver [../testes/estrategia-tdd.md](../testes/estrategia-tdd.md)), cobertura dentro do threshold configurado, e migration commitada quando há mudança de schema.
