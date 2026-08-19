---
name: create-pr
description: Abre um Pull Request no GitHub da branch atual para a branch dev deste repositório, usando gh CLI, com descrição em português breve e direta sobre o que foi alterado. Use sempre que o usuário pedir para "abrir um PR", "criar PR", "subir PR", "mandar pra dev", "abre um pull request", "faz o PR dessa branch" ou variações — mesmo que não mencione explicitamente "dev" como destino, já que dev é sempre a branch de base neste projeto. Não use para merge direto, push simples sem PR, ou PRs para main (isso é feito separadamente e exige confirmação extra).
---

# Abrir PR para dev

Este projeto usa `main` como branch de produção e `dev` como branch de integração. Todo trabalho de feature/fix é aberto como PR de `feature/<slug>` (ou `fix/<slug>`) **para `dev`**, nunca direto para `main`. Este skill automatiza esse fluxo específico.

## Por quê a branch base é sempre `dev`

O usuário já confirmou esse padrão: PRs deste repositório sempre miram `dev`, independentemente do que a branch atual se chame. Não pergunte qual é a base — é sempre `dev`, a menos que o usuário diga explicitamente o contrário nesta conversa.

## Passo a passo

1. **Confira o estado do repo.** Rode `git status`. Se houver mudanças não commitadas, avise o usuário e pergunte se deve commitar antes de continuar (não assuma — um PR com working tree sujo geralmente não é intencional). Não descarte nada.

2. **Confirme a branch atual.** Rode `git branch --show-current`. Se a branch atual for `main` ou `dev`, pare e avise o usuário — PR precisa de uma branch de feature/fix, não pode abrir PR de dev para dev.

3. **Garanta que `dev` existe no remoto.** Rode `git ls-remote --heads origin dev`. Se não existir remotamente (já aconteceu neste repo — `dev` pode existir só localmente), avise o usuário antes de criar/empurrar a branch remota, já que isso afeta o repositório compartilhado.

4. **Garanta que a branch atual está publicada e atualizada no remoto.** Rode `git push -u origin <branch-atual>` (ou apenas `git push` se o upstream já existir). Isso é necessário para o `gh pr create` funcionar — sem a branch no remoto não há o que comparar.

5. **Monte a descrição do PR a partir do que realmente mudou**, não do nome da branch:
   - Rode `git log dev..HEAD --oneline` para ver os commits que entram no PR.
   - Rode `git diff dev...HEAD --stat` para ter noção do escopo (quais arquivos/áreas).
   - A partir disso, escreva um título curto no estilo Conventional Commits (`feat:`, `fix:`, etc. — olhe o tipo predominante dos commits) e um corpo em português: 2 a 5 bullets diretos do que foi alterado, sem enrolação. Não é para ser um changelog completo — é o suficiente para quem vai revisar entender o que esperar sem abrir o diff primeiro.

6. **Abra o PR.** Rode:
   ```
   gh pr create --base dev --head <branch-atual> --title "<título>" --body "<corpo em português>"
   ```
   Use heredoc para o `--body` se tiver múltiplas linhas, para preservar a formatação.

7. **Depois de criar, devolva a URL do PR ao usuário.** `gh pr create` já imprime a URL — repita ela na resposta final para facilitar.

## Confirmação antes de agir

Abrir PR é uma ação visível no GitHub (notifica colaboradores, aparece no histórico do repo). Antes do passo 6, mostre ao usuário o título e o corpo que você escreveu e confirme rapidamente — a menos que o usuário já tenha pedido explicitamente para pular essa confirmação nesta conversa ou em instrução permanente. Push da branch atual (passo 4) pode seguir sem confirmação separada, já que é pré-requisito direto do PR pedido.

## Erros comuns a checar

- `gh` não autenticado → rode `gh auth status`; se falhar, peça para o usuário rodar `gh auth login`.
- Já existe um PR aberto dessa branch para `dev` → `gh pr create` avisa disso; nesse caso, pergunte se o usuário quer apenas ver/atualizar o PR existente (`gh pr view --web` ou `gh pr edit`) em vez de criar um duplicado.
- Branch atual sem nenhum commit à frente de `dev` → não há o que abrir PR; avise o usuário em vez de criar um PR vazio.
