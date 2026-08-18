# Documentação em Wiki do GitHub

O [Portfólio Directions](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-GERAL.md) lista "Documentação em Wiki junto com repositório (Wiki do GitHub, GitLab, ...)" como **🔑 Obrigatório** no núcleo comum de engenharia, válido para todas as linhas de projeto — incluindo Web Apps. Isso é um requisito de entrega institucional, separado (e adicional) da documentação técnica que vive em `docs/`.

## Por que dois lugares para documentação

- **`docs/` no repositório** é a fonte de verdade usada durante o desenvolvimento: é o que uma LLM ou qualquer colaborador lê para entender regras de negócio, arquitetura, schema, convenções de código, testes e git antes de tocar em qualquer parte do sistema (ver [../README.md](../README.md)). Evolui a cada commit, versionado junto do código, com histórico via `git log`.
- **Wiki do GitHub** é a vitrine de documentação exigida pela avaliação — o lugar em que um avaliador ou visitante entra a partir do repositório (aba "Wiki") sem precisar navegar pastas de código. Não substitui `docs/`; é um espelho curado, atualizado nos marcos que importam para a disciplina (orientações, entrega final), não a cada commit.

Não existe indicação no playbook de que a Wiki precise ser a fonte primária ou de que sincronização automática seja exigida — a exigência é apenas que a documentação exista lá. Manter `docs/` como fonte única evita duplicação de manutenção durante o desenvolvimento; a Wiki é atualizada por cópia manual nos marcos abaixo.

## Mapeamento `docs/` → páginas da Wiki

| Página da Wiki | Conteúdo (fonte em `docs/`) |
|---|---|
| `Home` | Resumo do `CLAUDE.md` (o quê é o sistema, stack, arquitetura em alto nível) + links para as páginas abaixo |
| `Regras-de-Negocio` | [../produto/regras-negocio.md](../produto/regras-negocio.md) |
| `Casos-de-Uso` | [../produto/casos-de-uso.md](../produto/casos-de-uso.md) |
| `Arquitetura` | [../arquitetura/visao-geral.md](../arquitetura/visao-geral.md) (inclui o diagrama C4) |
| `Banco-de-Dados` | [../database/schema.md](../database/schema.md) + [../database/docker-setup.md](../database/docker-setup.md) + [../database/migrations-prisma.md](../database/migrations-prisma.md) |
| `Deploy` | [../deploy/deploy.md](../deploy/deploy.md) |
| `Testes-e-Qualidade` | [../testes/estrategia-tdd.md](../testes/estrategia-tdd.md) + [../qualidade/analise-estatica.md](../qualidade/analise-estatica.md) + [../qualidade/observabilidade.md](../qualidade/observabilidade.md) |
| `Convencoes-de-Codigo` | [../app/estrutura-codigo.md](../app/estrutura-codigo.md) + [../app/design-system.md](../app/design-system.md) + [../app/modularizacao.md](../app/modularizacao.md) |
| `Git-e-Commits` | [../git/commits-e-branches.md](../git/commits-e-branches.md) |

Cada página da Wiki pode ser um resumo com link "documentação completa no repositório, pasta `docs/`" em vez de cópia integral — o que a avaliação verifica é a existência e a navegabilidade da documentação na Wiki, não a duplicação exata de conteúdo.

## Quando sincronizar

A Wiki é atualizada manualmente (copiar/colar o conteúdo relevante, ajustando links relativos para links absolutos do repositório) nos seguintes marcos, não a cada commit de `docs/`:

1. Antes de cada uma das cinco orientações da disciplina de Portfólio — garante que o avaliador sempre encontre a Wiki coerente com o estado atual do projeto.
2. Antes da entrega final (30/11, ver [Calendário 2026/2](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/calendario.md)) e antes de qualquer nova tentativa de prova de autoria.
3. Sempre que uma mudança em `docs/` alterar decisão de arquitetura, regra de negócio ou stack de forma visível externamente (não é preciso propagar ajustes puramente editoriais/typo).

## Como criar/editar a Wiki

A Wiki do GitHub é um repositório Git próprio (`<repo>.wiki.git`), acessível pela aba "Wiki" do repositório no GitHub — pode ser editada pela interface web ou clonada localmente como qualquer repositório. Não requer ferramenta externa (Notion/Obsidian são explicitamente ⚠️ Evitar / não aceitos para entrega oficial pelo playbook).
