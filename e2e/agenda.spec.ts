import { test, expect, type Page } from "@playwright/test";

test.describe("Agenda do escritório", () => {
  // Os testes rodam em paralelo: o e-mail precisa de um sufixo aleatório, já que
  // Date.now() sozinho colide entre execuções simultâneas.
  async function cadastrarECriarEscritorio(page: Page, nomeEscritorio: string) {
    const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Advogada Titular");
    await page.getByLabel("E-mail").fill(`e2e-agenda-${sufixo}@teste.com`);
    await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
    await page.getByLabel("Confirmar senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();
    await expect(page).toHaveURL("/onboarding");

    await page.getByLabel("Nome do escritório").fill(nomeEscritorio);
    await page.getByRole("button", { name: /criar escritório/i }).click();
    await expect(page).toHaveURL("/");
  }

  test("cria, edita e exclui um evento pelas três visões", async ({ page }) => {
    await cadastrarECriarEscritorio(page, "Escritório Agenda E2E");

    await page.getByRole("link", { name: "Agenda" }).click();
    await expect(page).toHaveURL(/\/agenda/);

    // Criar: presencial, sem vínculo.
    await page.getByRole("button", { name: /novo evento/i }).click();
    await page.getByLabel("Título").fill("Audiência de instrução");
    await page.getByLabel("Local").fill("Fórum de Joinville, sala 3");
    await page.getByLabel("Notas").fill("Levar procuração assinada.");
    await page.getByRole("button", { name: /criar evento/i }).click();

    await expect(page.getByRole("button", { name: /audiência de instrução/i })).toBeVisible();

    // O evento aparece nas três visões — o mesmo período consultado de formas diferentes.
    await page.getByRole("button", { name: "Semana" }).click();
    await expect(page.getByRole("button", { name: /audiência de instrução/i })).toBeVisible();
    await page.getByRole("button", { name: "Dia" }).click();
    await expect(page.getByRole("button", { name: /audiência de instrução/i })).toBeVisible();
    await page.getByRole("button", { name: "Mês" }).click();

    // Abrir o detalhe: mostra quem criou e o local.
    await page.getByRole("button", { name: /audiência de instrução/i }).click();
    await expect(page.getByText("Fórum de Joinville, sala 3")).toBeVisible();
    await expect(page.getByText(/criado por advogada titular/i)).toBeVisible();

    // Editar trocando para online: o local sai e o link entra (RN32).
    await page.getByRole("button", { name: "Editar" }).click();
    await page.getByRole("button", { name: "Online" }).click();
    await page.getByLabel("Link da reunião").fill("https://meet.example.com/audiencia");
    await page.getByRole("button", { name: /salvar alterações/i }).click();

    await expect(page.getByRole("link", { name: /entrar na reunião/i })).toBeVisible();

    // Excluir com confirmação.
    await page.getByRole("button", { name: "Excluir" }).click();
    await page.getByRole("button", { name: "Excluir", exact: true }).last().click();

    await expect(page.getByRole("button", { name: /audiência de instrução/i })).toBeHidden();
  });

  test("recusa evento com fim antes do início e vincula a um cliente", async ({ page }) => {
    await cadastrarECriarEscritorio(page, "Escritório Agenda Vínculo E2E");

    // Um cliente para o evento apontar (RN31).
    await page.goto("/clientes");
    await page.getByRole("button", { name: "Criar novo cliente" }).click();
    await page.getByLabel(/Nome completo/).fill("Maria da Agenda");
    await page.getByLabel("CPF").fill("529.982.247-25");
    await page.getByRole("button", { name: /criar cliente/i }).click();
    await expect(page.getByText("Maria da Agenda").first()).toBeVisible();

    await page.goto("/agenda");
    await page.getByRole("button", { name: /novo evento/i }).click();
    await page.getByLabel("Título").fill("Reunião inicial");
    await page.getByLabel("Local").fill("Escritório");

    // Fim antes do início é recusado antes de chegar ao servidor (RN35).
    const inicio = await page.getByLabel("Início").inputValue();
    const [dia] = inicio.split("T");
    await page.getByLabel("Início").fill(`${dia}T15:00`);
    await page.getByLabel("Fim").fill(`${dia}T14:00`);
    await page.getByRole("button", { name: /criar evento/i }).click();
    await expect(page.getByRole("alert")).toContainText(/depois do início/i);

    // Corrigido e vinculado ao cliente.
    await page.getByLabel("Fim").fill(`${dia}T16:00`);
    await page.getByRole("button", { name: /vínculo do evento/i }).click();
    await page.getByText("Maria da Agenda").click();
    await page.getByRole("button", { name: /criar evento/i }).click();

    await page.getByRole("button", { name: /reunião inicial/i }).click();
    await expect(page.getByText("Maria da Agenda")).toBeVisible();
  });
});
