import { test, expect, type Page } from "@playwright/test";

// Fluxos críticos da sessão própria (Fase 3 da migração): cookie crm_sessao emitido pela
// API Nest, login/logout, troca de escritório e sessões antigas do NextAuth invalidadas.
const SENHA = "senha-forte-123";

async function cadastrar(page: Page, nome: string, email: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(nome);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByLabel("Confirmar senha").fill(SENHA);
  await page.getByRole("button", { name: /cadastrar/i }).click();
  await expect(page).toHaveURL("/onboarding");
}

async function criarEscritorio(page: Page, nome: string) {
  await page.getByLabel("Nome do escritório").fill(nome);
  await page.getByRole("button", { name: /criar escritório/i }).click();
  await expect(page).toHaveURL("/");
}

// Em dev o primeiro clique pode cair antes da hidratação e não abrir o menu: repete até abrir.
async function abrirSwitcher(page: Page) {
  const item = page.getByRole("menuitem", { name: /criar escritório/i });
  await expect(async () => {
    if (!(await item.isVisible())) await page.getByRole("button", { name: /selecionar escritório/i }).click();
    await expect(item).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
}

// O item "Criar escritório" do switcher abre um dialog (não navega para /onboarding).
async function criarEscritorioPeloSwitcher(page: Page, nome: string) {
  await abrirSwitcher(page);
  await page.getByRole("menuitem", { name: /criar escritório/i }).click();
  await criarEscritorio(page, nome);
}

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: /entrar/i }).click();
}

async function sair(page: Page, nome: string) {
  await page.getByRole("button", { name: new RegExp(nome) }).click();
  await page.getByRole("menuitem", { name: /sair/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe("Sessão própria (crm_sessao)", () => {
  test("cadastro + onboarding abrem sessão com cookie httpOnly e role do banco", async ({ page, context }) => {
    await cadastrar(page, "Advogada Sessão E2E", `e2e-sessao-${Date.now()}@teste.com`);

    const cookies = await context.cookies();
    const sessao = cookies.find((cookie) => cookie.name === "crm_sessao");
    expect(sessao?.httpOnly).toBe(true);
    expect(sessao?.sameSite).toBe("Lax");
    expect(cookies.some((cookie) => cookie.name.includes("authjs"))).toBe(false);

    await criarEscritorio(page, "Escritório Sessão E2E");

    const resposta = await page.request.get("/api/auth/sessao");
    expect(resposta.status()).toBe(200);
    expect(await resposta.json()).toMatchObject({ escritorioId: expect.any(String), role: "owner" });
  });

  test("logout limpa a sessão; login volta a abrir no escritório mais antigo", async ({ page, context }) => {
    const nome = "Advogado Logout E2E";
    const email = `e2e-logout-${Date.now()}@teste.com`;
    await cadastrar(page, nome, email);
    await criarEscritorio(page, "Escritório Antigo E2E");

    await criarEscritorioPeloSwitcher(page, "Escritório Novo E2E");

    await sair(page, nome);
    expect((await context.cookies()).some((cookie) => cookie.name === "crm_sessao")).toBe(false);
    expect((await page.request.get("/api/auth/sessao")).status()).toBe(401);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2F/);

    // Login escolhe a membership ativa mais antiga (resolverEscritorioAtivo).
    await entrar(page, email);
    await expect(page).toHaveURL("/");
    await page.goto("/configuracoes/escritorio");
    await expect(page.getByLabel("Nome do escritório")).toHaveValue("Escritório Antigo E2E");
  });

  test("troca de escritório regrava o cookie e sobrevive a um reload", async ({ page }) => {
    await cadastrar(page, "Advogada Troca Sessão", `e2e-troca-sessao-${Date.now()}@teste.com`);
    await criarEscritorio(page, "Escritório A Sessão");
    await criarEscritorioPeloSwitcher(page, "Escritório B Sessão");

    await abrirSwitcher(page);
    const [troca] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/sessao/escritorio-ativo")),
      page.getByRole("menuitem", { name: "Escritório A Sessão" }).click(),
    ]);
    expect(troca.status()).toBe(200);
    expect((await troca.allHeaders())["set-cookie"]).toContain("crm_sessao=");

    await page.reload();
    await page.goto("/configuracoes/escritorio");
    await expect(page.getByLabel("Nome do escritório")).toHaveValue("Escritório A Sessão");
  });

  test("login com credenciais inválidas mantém na tela e não grava cookie (FA-01)", async ({ page, context }) => {
    await entrar(page, "nao-existe@teste.com");

    await expect(page.getByText(/e-mail ou senha inválidos/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect((await context.cookies()).some((cookie) => cookie.name === "crm_sessao")).toBe(false);
  });

  test("cookie legado do NextAuth não abre sessão (decisão da Fase 3)", async ({ page, context }) => {
    await context.addCookies([
      { name: "authjs.session-token", value: "sessao-antiga", url: "http://localhost:3000" },
    ]);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("crm_sessao adulterado não abre sessão", async ({ page, context }) => {
    await context.addCookies([{ name: "crm_sessao", value: "a.b.c", url: "http://localhost:3000" }]);

    await page.goto("/clientes");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fclientes/);
  });
});
