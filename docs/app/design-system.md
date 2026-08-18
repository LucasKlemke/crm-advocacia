# Design System — Tailwind + shadcn/ui

Base de UI obrigatória do projeto. Ver [estrutura-codigo.md](estrutura-codigo.md) para onde os componentes vivem no projeto e [modularizacao.md](modularizacao.md) para como compô-los em componentes maiores.

## Regra central — sempre tokens, nunca cor literal

**Toda cor, espaçamento de tema e raio de borda usados em componentes vêm de tokens do Tailwind/shadcn (`bg-primary`, `text-muted-foreground`, `border-input`, `bg-destructive`, `rounded-lg` do tema), nunca classes com valor literal (`bg-blue-500`, `text-gray-700`, `border-[#e5e5e5]`).**

Por quê: os tokens são o único lugar onde tema claro/escuro e a identidade visual do produto são definidos. Uma classe literal ignora o tema, quebra o dark mode e obriga a caçar cada ocorrência manualmente se a paleta mudar.

```tsx
// ❌ Errado — cor literal, ignora tema
<div className="bg-blue-500 text-white border-gray-200">

// ✅ Certo — token semântico do tema
<div className="bg-primary text-primary-foreground border-border">
```

## Onde os tokens são definidos

- `src/app/globals.css` — variáveis CSS do tema (`--background`, `--foreground`, `--primary`, `--muted`, `--destructive`, `--border`, `--input`, `--ring`, etc.), com um bloco para light e outro para dark (seletor `.dark`), no padrão gerado pelo shadcn/ui.
- `tailwind.config.ts` — mapeia essas variáveis CSS para as classes utilitárias (`colors.primary = 'hsl(var(--primary))'`, etc.), é isso que habilita `bg-primary`, `text-primary-foreground` e equivalentes.
- Qualquer cor nova do domínio (ex. cores de status do kanban: "Prospecção", "Em Andamento") deve virar token novo em `globals.css` + `tailwind.config.ts` (ex. `--status-prospeccao`), nunca uma classe Tailwind literal aplicada direto no componente do card.

## Instalação de componentes shadcn/ui

- Componentes de UI base são adicionados via CLI: `npx shadcn@latest add <componente>` (ex. `button`, `dialog`, `form`, `table`, `badge`) — nunca copiados manualmente de exemplos externos.
- Componentes instalados vivem em `src/components/ui/` (ver [estrutura-codigo.md](estrutura-codigo.md)) e são tratados como "gerados": evitar editar o arquivo em si além de ajustes mínimos necessários para os tokens do projeto. Customização de comportamento/aparência é feita **por composição** (props, `className` com tokens, wrapper em `components/shared/`), não reescrevendo o componente gerado — isso mantém a possibilidade de reinstalar/atualizar via CLI no futuro sem perder customização.

## Checklist de revisão (PR)

Antes de aprovar qualquer mudança de UI:

- [ ] Nenhuma classe de cor literal (`bg-*-500`, `text-*-700`, hex direto) fora de `globals.css`/`tailwind.config.ts`.
- [ ] Componente novo de UI base veio do shadcn (`components/ui/`) via CLI, não escrito à mão do zero, quando existe equivalente na biblioteca.
- [ ] Testado visualmente (ou revisado) em light e dark, já que os tokens mudam de valor entre os dois.
- [ ] Espaçamento e tipografia usam a escala padrão do Tailwind (`p-4`, `text-sm`, `gap-2`), sem valores arbitrários (`p-[13px]`) exceto necessidade comprovada.
