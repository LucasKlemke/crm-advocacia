import { test, expect, type Page } from "@playwright/test";

// CPFs válidos distintos — a unicidade é por escritório (RN05) e cada teste cria o seu.
const CPF_MARIA = "529.982.247-25";
const CPF_JOAO = "168.995.350-09";

test.describe("CRUD de clientes", () => {
  // Os testes rodam em paralelo: o e-mail precisa de um sufixo aleatório, já que
  // Date.now() sozinho colide entre execuções simultâneas.
  async function cadastrarECriarEscritorio(page: Page, nomeEscritorio: string) {
    const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Advogada Titular");
    await page.getByLabel("E-mail").fill(`e2e-clientes-${sufixo}@teste.com`);
    await page.getByLabel("Senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();
    await expect(page).toHaveURL("/onboarding");

    await page.getByLabel("Nome do escritório").fill(nomeEscritorio);
    await page.getByRole("button", { name: /criar escritório/i }).click();
    await expect(page).toHaveURL("/");
  }

  async function criarCliente(page: Page, nome: string, cpf: string) {
    await page.getByRole("button", { name: "Criar novo cliente" }).click();
    await page.getByLabel(/Nome completo/).fill(nome);
    await page.getByLabel("CPF").fill(cpf);
    await page.getByRole("button", { name: "Criar cliente" }).click();
    // O drawer é modal: enquanto ele não fecha, a tabela fica fora da árvore de
    // acessibilidade e a linha recém-criada não é "visível" para o Playwright.
    await expect(page.getByRole("dialog", { name: "Novo cliente" })).toBeHidden();
    await expect(page.getByRole("cell", { name: nome, exact: true })).toBeVisible();
  }

  test("cria, edita, comenta e desativa em lote", async ({ page }) => {
    await cadastrarECriarEscritorio(page, "Escritório Clientes E2E");
    await page.goto("/clientes");

    await expect(page.getByText("Nenhum cliente cadastrado ainda.")).toBeVisible();

    // Criar
    await criarCliente(page, "Maria Silva", CPF_MARIA);
    await criarCliente(page, "João Souza", CPF_JOAO);
    await expect(page.getByText("529.982.247-25")).toBeVisible();

    // Editar pelo drawer
    await page.getByRole("button", { name: "Ações de Maria Silva" }).click();
    await page.getByRole("menuitem", { name: "Visualizar" }).click();
    await page.getByRole("button", { name: "Editar dados" }).click();
    await page.getByLabel(/Telefone/).fill("48988887777");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("48988887777")).toBeVisible();

    // Comentar no cliente aberto
    await page.getByRole("tab", { name: "Comentários" }).click();
    await expect(page.getByText(/Nenhum comentário ainda/)).toBeVisible();
    await page.getByRole("textbox", { name: "Novo comentário" }).fill("Primeiro contato feito.");
    await page.getByRole("button", { name: "Comentar" }).click();
    await expect(page.getByText("Primeiro contato feito.")).toBeVisible();
    await page.keyboard.press("Escape");

    // Desativar os dois em lote
    await page.getByRole("checkbox", { name: "Selecionar todos os clientes" }).click();
    await expect(page.getByText("2 selecionado(s)")).toBeVisible();
    await page
      .getByRole("region", { name: "Ações em lote" })
      .getByRole("button", { name: "Desativar" })
      .click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Desativar" }).click();

    // Soft delete: somem da listagem padrão, mas continuam existindo. Ao reaparecer,
    // a célula do nome carrega o badge junto — daí o nome acessível com "Excluído".
    await expect(page.getByRole("cell", { name: "Maria Silva", exact: true })).toBeHidden();
    await page.getByRole("checkbox", { name: "Mostrar excluídos" }).click();
    await expect(page.getByRole("cell", { name: "Maria Silva Excluído" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "João Souza Excluído" })).toBeVisible();
  });

  test("recusa CPF duplicado dentro do mesmo escritório", async ({ page }) => {
    await cadastrarECriarEscritorio(page, "Escritório CPF Duplicado E2E");
    await page.goto("/clientes");

    await criarCliente(page, "Maria Silva", CPF_MARIA);

    await page.getByRole("button", { name: "Criar novo cliente" }).click();
    await page.getByLabel(/Nome completo/).fill("Outra Maria");
    await page.getByLabel("CPF").fill(CPF_MARIA);
    await page.getByRole("button", { name: "Criar cliente" }).click();

    await expect(page.getByText(/Já existe um cliente com este CPF/)).toBeVisible();
  });

  test("restaura um cliente desativado", async ({ page }) => {
    await cadastrarECriarEscritorio(page, "Escritório Restaurar E2E");
    await page.goto("/clientes");

    await criarCliente(page, "Maria Silva", CPF_MARIA);

    await page.getByRole("button", { name: "Ações de Maria Silva" }).click();
    await page.getByRole("menuitem", { name: "Desativar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Desativar" }).click();
    await expect(page.getByRole("cell", { name: "Maria Silva", exact: true })).toBeHidden();

    await page.getByRole("checkbox", { name: "Mostrar excluídos" }).click();
    await page.getByRole("button", { name: "Ações de Maria Silva" }).click();
    await page.getByRole("menuitem", { name: "Restaurar" }).click();

    await page.getByRole("checkbox", { name: "Mostrar excluídos" }).click();
    await expect(page.getByRole("cell", { name: "Maria Silva", exact: true })).toBeVisible();
  });
});
