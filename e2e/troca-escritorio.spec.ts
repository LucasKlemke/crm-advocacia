import { test, expect } from "@playwright/test";

// Fluxo crítico: criar mais de um escritório e trocar entre eles pelo switcher do
// header, confirmando que /configuracoes/escritorio reflete o tenant ativo certo.
test.describe("Troca de escritório ativo", () => {
  test("cria um segundo escritório e alterna entre os dois pelo switcher", async ({ page }) => {
    const email = `e2e-troca-${Date.now()}@teste.com`;

    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Advogada Multi Escritório");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();
    await expect(page).toHaveURL("/onboarding");

    await page.getByLabel("Nome do escritório").fill("Escritório Um E2E");
    await page.getByRole("button", { name: /criar escritório/i }).click();
    await expect(page).toHaveURL("/");

    // Cria o segundo escritório pelo switcher do header.
    await page.getByRole("button", { name: /selecionar escritório/i }).click();
    await page.getByRole("menuitem", { name: /criar escritório/i }).click();
    await expect(page).toHaveURL("/onboarding");

    await page.getByLabel("Nome do escritório").fill("Escritório Dois E2E");
    await page.getByRole("button", { name: /criar escritório/i }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/configuracoes/escritorio");
    await expect(page.getByLabel("Nome do escritório")).toHaveValue("Escritório Dois E2E");

    // Troca de volta para o primeiro escritório — espera a API confirmar a troca antes
    // de navegar, já que o clique só dispara o fetch (não aguarda a resposta).
    await page.getByRole("button", { name: /selecionar escritório/i }).click();
    const [trocaResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/api/sessao/escritorio-ativo") && res.status() === 200
      ),
      page.getByRole("menuitem", { name: "Escritório Um E2E" }).click(),
    ]);
    expect(trocaResponse.ok()).toBe(true);

    await page.goto("/configuracoes/escritorio");
    await expect(page.getByLabel("Nome do escritório")).toHaveValue("Escritório Um E2E");
  });
});
