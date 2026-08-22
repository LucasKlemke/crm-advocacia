import { test, expect, type Page } from "@playwright/test";

test.describe("CRUD de tipos de processo", () => {
  // Os testes rodam em paralelo: o e-mail precisa de um sufixo aleatório, já que
  // Date.now() sozinho colide entre execuções simultâneas.
  async function cadastrarECriarEscritorio(page: Page, nomeEscritorio: string) {
    const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Advogada Titular");
    await page.getByLabel("E-mail").fill(`e2e-tipo-processo-${sufixo}@teste.com`);
    await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
    await page.getByLabel("Confirmar senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();
    await expect(page).toHaveURL("/onboarding");

    await page.getByLabel("Nome do escritório").fill(nomeEscritorio);
    await page.getByRole("button", { name: /criar escritório/i }).click();
    await expect(page).toHaveURL("/");
  }

  test("já vem com os tipos padrão e permite criar e editar um tipo", async ({ page }) => {
    await cadastrarECriarEscritorio(page, "Escritório Tipos Processo E2E");
    await page.goto("/configuracoes/tipos-processo");

    // Todo escritório novo nasce com o conjunto inicial: sem nenhum tipo não daria
    // para cadastrar o primeiro processo, já que o tipo é obrigatório.
    await expect(page.getByText("Ação trabalhista").first()).toBeVisible();
    await expect(page.getByText("Divórcio").first()).toBeVisible();
    await expect(page.getByText("Consultivo").first()).toBeVisible();

    // Criar um tipo novo.
    await page.getByRole("button", { name: "Novo tipo" }).click();
    await page.getByLabel("Nome").fill("Juros abusivos");
    await page.getByRole("button", { name: "Selecionar ícone" }).click();
    await page.getByRole("option", { name: "Briefcase" }).click();
    await page.getByRole("radio", { name: "Cor #6366f1" }).click();
    await page.getByRole("button", { name: "Criar tipo" }).click();

    await expect(page.getByRole("dialog", { name: "Novo tipo de processo" })).toBeHidden();
    await expect(page.getByText("Juros abusivos").first()).toBeVisible();

    // Renomear o tipo recém-criado.
    await page.getByRole("button", { name: "Editar Juros abusivos" }).click();
    await page.getByLabel("Nome").fill("Revisional de juros");
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByRole("dialog", { name: "Editar tipo de processo" })).toBeHidden();
    await expect(page.getByText("Revisional de juros").first()).toBeVisible();
  });

  test("cria o tipo pelo atalho dentro do formulário de processo e já o deixa selecionado", async ({
    page,
  }) => {
    await cadastrarECriarEscritorio(page, "Escritório Atalho Tipo E2E");

    // Um cliente ativo é pré-requisito do processo (RN06).
    await page.goto("/clientes");
    await page.getByRole("button", { name: "Criar novo cliente" }).click();
    await page.getByLabel(/Nome completo/).fill("Cliente do Tipo");
    await page.getByLabel("CPF").fill("529.982.247-25");
    await page.getByRole("button", { name: "Criar cliente" }).click();
    await expect(page.getByRole("dialog", { name: "Novo cliente" })).toBeHidden();

    await page.goto("/casos");
    await page.getByRole("button", { name: "Novo processo" }).click();

    // O atalho "Criar tipo" abre o formulário de tipo sem sair do processo.
    await page.getByRole("combobox", { name: "Tipo de processo" }).click();
    await page.getByRole("option", { name: "Criar tipo" }).click();

    await page.getByLabel("Nome").fill("Licença prêmio");
    await page.getByRole("button", { name: "Selecionar ícone" }).click();
    await page.getByRole("option", { name: "Briefcase" }).click();
    await page.getByRole("radio", { name: "Cor #10b981" }).click();
    await page.getByRole("button", { name: "Criar tipo" }).click();

    await expect(page.getByRole("dialog", { name: "Novo tipo de processo" })).toBeHidden();
    // Volta ao formulário de processo com o tipo recém-criado já escolhido.
    await expect(page.getByRole("combobox", { name: "Tipo de processo" })).toContainText(
      "Licença prêmio"
    );

    await page.getByRole("combobox", { name: "Cliente" }).click();
    await page.getByRole("option", { name: "Cliente do Tipo" }).click();
    await page.getByRole("button", { name: "Criar processo" }).click();
    await expect(page.getByRole("dialog", { name: "Novo processo" })).toBeHidden();

    // O tipo virou o rótulo do card no kanban, no lugar do antigo título livre.
    await expect(page.getByText("Licença prêmio").first()).toBeVisible();

    // E filtra: só o processo desse tipo aparece.
    await page.getByRole("button", { name: /tipo de processo/i }).click();
    await page.getByRole("option", { name: "Licença prêmio" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Licença prêmio").first()).toBeVisible();
  });

  test("bloqueia excluir um tipo com processos vinculados", async ({ page }) => {
    await cadastrarECriarEscritorio(page, "Escritório Excluir Tipo E2E");

    await page.goto("/clientes");
    await page.getByRole("button", { name: "Criar novo cliente" }).click();
    await page.getByLabel(/Nome completo/).fill("Cliente Vinculado");
    await page.getByLabel("CPF").fill("529.982.247-25");
    await page.getByRole("button", { name: "Criar cliente" }).click();
    await expect(page.getByRole("dialog", { name: "Novo cliente" })).toBeHidden();

    await page.goto("/casos");
    await page.getByRole("button", { name: "Novo processo" }).click();
    await page.getByRole("combobox", { name: "Tipo de processo" }).click();
    await page.getByRole("option", { name: "Ação trabalhista" }).click();
    await page.getByRole("combobox", { name: "Cliente" }).click();
    await page.getByRole("option", { name: "Cliente Vinculado" }).click();
    await page.getByRole("button", { name: "Criar processo" }).click();
    await expect(page.getByRole("dialog", { name: "Novo processo" })).toBeHidden();

    await page.goto("/configuracoes/tipos-processo");
    await page.getByRole("button", { name: "Editar Ação trabalhista" }).waitFor();
    await page.getByRole("button", { name: "Excluir Ação trabalhista" }).click();
    await page.getByRole("button", { name: "Excluir" }).click();

    await expect(
      page.getByText("Este tipo tem processos vinculados e não pode ser excluído.")
    ).toBeVisible();
    // Continua na lista: a exclusão foi recusada pelo servidor (FK Restrict).
    await expect(page.getByText("Ação trabalhista").first()).toBeVisible();
  });
});
