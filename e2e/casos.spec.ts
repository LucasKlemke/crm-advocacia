import { test, expect, type Page } from "@playwright/test";

test.describe("Kanban e tabela de casos", () => {
  // Os testes rodam em paralelo: o e-mail precisa de um sufixo aleatório, já que
  // Date.now() sozinho colide entre execuções simultâneas.
  async function cadastrarECriarEscritorio(page: Page, nomeEscritorio: string) {
    const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Advogada Titular");
    await page.getByLabel("E-mail").fill(`e2e-casos-${sufixo}@teste.com`);
    await page.getByLabel("Senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();
    await expect(page).toHaveURL("/onboarding");

    await page.getByLabel("Nome do escritório").fill(nomeEscritorio);
    await page.getByRole("button", { name: /criar escritório/i }).click();
    await expect(page).toHaveURL("/");
  }

  async function criarCliente(page: Page, nome: string, cpf: string) {
    await page.goto("/clientes");
    await page.getByRole("button", { name: "Criar novo cliente" }).click();
    await page.getByLabel(/Nome completo/).fill(nome);
    await page.getByLabel("CPF").fill(cpf);
    await page.getByRole("button", { name: "Criar cliente" }).click();
    await expect(page.getByRole("dialog", { name: "Novo cliente" })).toBeHidden();
  }

  test("cria um caso, aparece no kanban, comenta, muda status pela tabela e arquiva", async ({
    page,
  }) => {
    await cadastrarECriarEscritorio(page, "Escritório Casos E2E");
    await criarCliente(page, "Cliente do Caso", "529.982.247-25");

    await page.goto("/casos");

    // Criar caso: por padrão a tela abre em Kanban.
    await page.getByRole("button", { name: "Novo processo" }).click();
    await page.getByLabel("Título").fill("Ação de cobrança");
    await page.getByRole("combobox", { name: "Cliente" }).click();
    await page.getByRole("option", { name: "Cliente do Caso" }).click();
    await page.getByRole("button", { name: "Criar processo" }).click();
    await expect(page.getByRole("dialog", { name: "Novo processo" })).toBeHidden();

    // O card aparece na primeira coluna do kanban (status padrão de menor ordem).
    await expect(page.getByText("Ação de cobrança")).toBeVisible();

    // Abrir o caso e comentar.
    await page.getByRole("button", { name: "Abrir processo Ação de cobrança" }).click();
    await page.getByLabel("Novo comentário").fill("Cliente contatado por telefone.");
    await page.getByRole("button", { name: "Comentar" }).click();
    await expect(page.getByText("Cliente contatado por telefone.")).toBeVisible();
    await page.keyboard.press("Escape");

    // Alternar para a visão de tabela e mudar o status pelo select da linha.
    await page.getByRole("button", { name: "Tabela" }).click();
    await expect(page.getByRole("cell", { name: "Ação de cobrança", exact: true })).toBeVisible();

    await page.getByRole("combobox", { name: "Status de Ação de cobrança" }).click();
    await page.getByRole("option", { name: "Qualificado" }).click();
    await expect(page.getByRole("combobox", { name: "Status de Ação de cobrança" })).toContainText(
      "Qualificado"
    );

    // Filtrar por responsável "Sem responsável" continua mostrando o caso recém-criado.
    await page.getByRole("button", { name: /responsável/i }).click();
    await page.getByRole("option", { name: "Sem responsável" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("cell", { name: "Ação de cobrança", exact: true })).toBeVisible();

    // Abrir pelo botão de ação da primeira coluna e arquivar.
    await page.getByRole("button", { name: "Abrir Ação de cobrança" }).click();
    await page.getByRole("button", { name: "Arquivar processo" }).click();
    await expect(page.getByRole("dialog", { name: "Ação de cobrança" })).toBeHidden();

    // Arquivado, o caso some da visão ativa (kanban e tabela mostram só ativos por padrão).
    await expect(page.getByText("Ação de cobrança")).not.toBeVisible();
  });
});
