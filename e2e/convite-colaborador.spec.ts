import { test, expect } from "@playwright/test";

// Fluxo crítico: convite e gestão de colaborador pelo titular (owner), e bloqueio
// quando um colaborador (padrao) tenta gerenciar outros membros.
test.describe("Convite de colaborador", () => {
  async function cadastrarECriarEscritorio(
    page: import("@playwright/test").Page,
    nome: string,
    email: string,
    nomeEscritorio: string
  ) {
    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill(nome);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();
    await expect(page).toHaveURL("/onboarding");

    await page.getByLabel("Nome do escritório").fill(nomeEscritorio);
    await page.getByRole("button", { name: /criar escritório/i }).click();
    await expect(page).toHaveURL("/");
  }

  test("convida um e-mail sem cadastro prévio e ele aparece em pendentes", async ({ page }) => {
    const ownerEmail = `e2e-owner-${Date.now()}@teste.com`;
    const convidadoEmail = `e2e-convidado-${Date.now()}@teste.com`;

    await cadastrarECriarEscritorio(page, "Advogada Titular", ownerEmail, "Escritório Convite E2E");

    await page.goto("/configuracoes/usuarios");
    await page.getByLabel("E-mail do colaborador").fill(convidadoEmail);
    await page.getByRole("button", { name: /^convidar$/i }).click();

    await expect(page.getByText(convidadoEmail)).toBeVisible();
  });

  test("cadastro com convite pendente entra direto no escritório, sem onboarding", async ({
    page,
  }) => {
    const ownerEmail = `e2e-owner2-${Date.now()}@teste.com`;
    const convidadoEmail = `e2e-convidado2-${Date.now()}@teste.com`;

    await cadastrarECriarEscritorio(
      page,
      "Advogada Titular Dois",
      ownerEmail,
      "Escritório Convite E2E 2"
    );

    await page.goto("/configuracoes/usuarios");
    await page.getByLabel("E-mail do colaborador").fill(convidadoEmail);
    await page.getByRole("button", { name: /^convidar$/i }).click();
    await expect(page.getByText(convidadoEmail)).toBeVisible();

    await page.context().clearCookies();
    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Colaborador Convidado");
    await page.getByLabel("E-mail").fill(convidadoEmail);
    await page.getByLabel("Senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();

    // Convite consumido: vai direto para a home do escritório, sem passar por onboarding.
    await expect(page).toHaveURL("/");
  });

  test("colaborador padrao não vê ações de gestão de usuários", async ({ page }) => {
    const ownerEmail = `e2e-owner3-${Date.now()}@teste.com`;
    const colaboradorEmail = `e2e-colaborador3-${Date.now()}@teste.com`;

    await cadastrarECriarEscritorio(
      page,
      "Advogada Titular Três",
      ownerEmail,
      "Escritório Convite E2E 3"
    );

    await page.goto("/configuracoes/usuarios");
    await page.getByLabel("E-mail do colaborador").fill(colaboradorEmail);
    await page.getByRole("button", { name: /^convidar$/i }).click();
    await expect(page.getByText(colaboradorEmail)).toBeVisible();

    await page.context().clearCookies();
    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Colaborador Padrao");
    await page.getByLabel("E-mail").fill(colaboradorEmail);
    await page.getByLabel("Senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/configuracoes/usuarios");
    await expect(page.getByLabel("E-mail do colaborador")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /remover/i })).not.toBeVisible();
  });
});
