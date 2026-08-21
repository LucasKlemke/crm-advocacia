import { test, expect } from "@playwright/test";

// Fluxo crítico: cadastro de usuário (nome/e-mail/senha), login e onboarding do
// primeiro escritório (RN01/RN02).
test.describe("Cadastro de usuário, onboarding e login", () => {
  test("cadastra um novo usuário, loga automaticamente e cai no onboarding", async ({ page }) => {
    const email = `e2e-cadastro-${Date.now()}@teste.com`;

    await page.goto("/cadastro");

    await page.getByLabel("Seu nome").fill("Advogado E2E");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();

    await expect(page).toHaveURL("/onboarding");
  });

  test("cria o primeiro escritório no onboarding e entra no shell como owner", async ({
    page,
  }) => {
    const email = `e2e-onboarding-${Date.now()}@teste.com`;

    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Advogado Onboarding");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();
    await expect(page).toHaveURL("/onboarding");

    await page.getByLabel("Nome do escritório").fill("Escritório E2E Onboarding");
    await page.getByRole("button", { name: /criar escritório/i }).click();

    await expect(page).toHaveURL("/");
  });

  test("permite login com as credenciais recém-cadastradas", async ({ page }) => {
    const email = `e2e-login-${Date.now()}@teste.com`;

    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Advogado E2E Login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();
    await expect(page).toHaveURL("/onboarding");

    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(page).toHaveURL("/onboarding");
  });

  test("mantém o usuário na tela de login com erro para credenciais inválidas (FA-01)", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("E-mail").fill("nao-existe@teste.com");
    await page.getByLabel("Senha").fill("senha-qualquer");
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(page.getByText(/e-mail ou senha inválidos/i)).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("bloqueia acesso à home sem sessão (RN01)", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/login");
  });
});
