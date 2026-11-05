import { test, expect, type Page } from "@playwright/test";

// Fluxos que dependiam do Next (middleware, Server Components, router.refresh) e agora
// são responsabilidade da SPA: RotaProtegida, fallback de rota, invalidação de queries.
function sufixo() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cadastrarComEscritorio(
  page: Page,
  nome: string,
  nomeEscritorio: string,
) {
  const email = `e2e-spa-${sufixo()}@teste.com`;
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(nome);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
  await page.getByLabel("Confirmar senha").fill("senha-forte-123");
  await page.getByRole("button", { name: /cadastrar/i }).click();
  await expect(page).toHaveURL("/onboarding");
  await page.getByLabel("Nome do escritório").fill(nomeEscritorio);
  await page.getByRole("button", { name: /criar escritório/i }).click();
  await expect(page).toHaveURL("/");
  return email;
}

async function sair(page: Page, nome: string) {
  await page.getByRole("button", { name: new RegExp(nome) }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe("SPA — fluxos críticos", () => {
  test("deep link sem sessão vai ao login e volta à rota pedida depois de entrar", async ({
    page,
  }) => {
    const email = await cadastrarComEscritorio(
      page,
      "Advogada Deep Link",
      "Escritório Deep Link",
    );
    await sair(page, "Advogada Deep Link");

    await page.goto("/configuracoes/membros");
    await expect(page).toHaveURL(
      "/login?callbackUrl=%2Fconfiguracoes%2Fmembros",
    );

    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(page).toHaveURL("/configuracoes/membros");
    await expect(page.getByRole("heading", { name: "Membros" })).toBeVisible();
    await expect(page.getByText("Advogada Deep Link").first()).toBeVisible();
    await expect(page).toHaveTitle(/Membros/);
  });

  test("reload numa rota profunda mantém a página (fallback da SPA)", async ({
    page,
  }) => {
    await cadastrarComEscritorio(page, "Advogada Reload", "Escritório Reload");
    await page.goto("/casos");
    await expect(
      page.getByRole("heading", { name: "Processos" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Processos" }),
    ).toBeVisible();
  });

  test("/configuracoes abre a aba do escritório e renomear reflete no switcher", async ({
    page,
  }) => {
    await cadastrarComEscritorio(
      page,
      "Advogada Renomeia",
      "Escritório Antigo",
    );
    await page.goto("/configuracoes");
    await expect(page).toHaveURL("/configuracoes/escritorio");

    await page.getByLabel("Nome do escritório").fill("Escritório Renomeado");
    await page.getByRole("button", { name: /salvar/i }).click();
    await expect(page.getByText("Escritório atualizado.")).toBeVisible();

    // Sem reload: o refresh() invalida as queries e o header relê GET /api/escritorios.
    await expect(
      page.getByRole("button", { name: /selecionar escritório/i }),
    ).toContainText("Escritório Renomeado");
  });

  test("editar o perfil reflete na página sem novo login", async ({ page }) => {
    await cadastrarComEscritorio(page, "Nome Antigo", "Escritório Perfil");
    await page.goto("/perfil");
    await expect(page.getByLabel("Nome")).toHaveValue("Nome Antigo");

    await page.getByLabel("Nome").fill("Nome Novo");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Perfil atualizado.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Nome")).toHaveValue("Nome Novo");
  });

  test("rota inexistente mostra a página 404 dentro do shell", async ({
    page,
  }) => {
    await cadastrarComEscritorio(page, "Advogada 404", "Escritório 404");
    await page.goto("/rota-que-nao-existe");
    await expect(
      page.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeVisible();
    await page.getByRole("link", { name: /voltar ao início/i }).click();
    await expect(page).toHaveURL("/");
  });
});
