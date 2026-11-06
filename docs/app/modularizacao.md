# Modularização e Reutilização de Componentes

Complementa [design-system.md](design-system.md) (regras de estilo) e [estrutura-codigo.md](estrutura-codigo.md) (onde os arquivos vivem) com as regras de quando e como extrair componentes, hooks e funções reutilizáveis.

## Hierarquia de componentes

1. **`components/ui/`** — primitivos do shadcn/ui, instalados via CLI (ver [design-system.md](design-system.md)). Não conhecem regra de negócio nem domínio (`Button`, `Dialog`, `Input`, `Badge`).
2. **`components/shared/`** — composições reutilizáveis entre módulos do domínio, construídas sobre os primitivos: `ClienteAvatar`, `StatusBadge` (usa `Badge` + token de cor por estágio), `ConfirmDialog`, `FormField` padrão do projeto. Usadas por 2 ou mais telas/módulos diferentes.
3. **Componentes de feature** — específicos de uma tela, colocalizados junto da rota: `apps/web/src/paginas/campanhas/_components/…` (ou, quando usados por mais de uma tela do mesmo domínio, `apps/web/src/components/clientes/cliente-form.tsx`, `components/casos/casos-kanban.tsx`). Não são importados fora do seu módulo.

## Regra de extração

Extrair para `components/shared/` (ou um hook em `hooks/`) **na segunda ocorrência** de um trecho de JSX ou lógica repetido, não na primeira. Abstração antecipada sem um segundo caso de uso real tende a errar a interface certa — prefira duplicar uma vez e extrair quando o padrão se confirmar.

## Hooks customizados

Lógica de estado/comportamento compartilhada entre componentes vira hook em `apps/web/src/hooks/`, nunca duplicada:

- Hooks de dados (TanStack Query) — `use-clientes.ts`, `use-casos.ts` (ver [estrutura-codigo.md](estrutura-codigo.md)).
- Hooks de comportamento de UI reutilizado em mais de uma tela — ex. `useClienteForm` (validação + submit do form de cliente, usado no modal de criação e no de edição), `useKanbanDnD` (lógica de drag-and-drop do pipeline).

## Funções puras compartilhadas

Formatação e regras de apresentação sem estado (formatação de CPF/telefone, label human-readable de um status, cálculo de "prazo retroativo") vivem em `apps/web/src/lib/utils/` (só do front) ou, quando a API também usa, em `packages/compartilhado/src/utils/` (CPF, telefone, e-mail, cores/ícones de status), como funções puras testáveis isoladamente — nunca reimplementadas dentro de um componente. `apps/web/src/lib/utils.ts` já traz o helper `cn()` padrão do shadcn (merge de classes Tailwind); novas funções seguem o mesmo diretório, um arquivo por domínio (`data.ts`, `valor.ts`, `agenda-grade.ts`).

## Tipagem compartilhada

Tipos usados tanto no web quanto na API (shape de `Cliente`, `Caso`, payloads de request/response) vivem em `packages/compartilhado/src/tipos/` e são importados como `@crm/compartilhado/tipos/<entidade>`. O compartilhado não depende de `@prisma/client`: os enums do Prisma usados na fronteira HTTP são espelhados em `packages/compartilhado/src/enums.ts`, com um teste na API que compara os dois. Evitar:

- Duplicar manualmente o shape de uma entidade em vários arquivos.
- `any` em props de componente ou retorno de hook — se o DTO existente não cobre o caso (ex. resposta de API com relações), criar um tipo explícito em `packages/compartilhado/src/tipos/` reaproveitável.

## Quando não modularizar

Três linhas parecidas não é motivo para criar um componente genérico. Um formulário com um único uso não precisa de hook próprio. Uma função usada uma vez não precisa sair do arquivo onde é usada. A rigidez aqui é a mesma dos outros documentos: modularizar resolve duplicação real e comprovada, não duplicação hipotética.
