import { test, expect, type Page } from "@playwright/test";

test.describe("CRUD de status", () => {
  // Os testes rodam em paralelo: o e-mail precisa de um sufixo aleatório, já que
  // Date.now() sozinho colide entre execuções simultâneas.
  async function cadastrarECriarEscritorio(page: Page, nomeEscritorio: string) {
    const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Advogada Titular");
    await page.getByLabel("E-mail").fill(`e2e-status-${sufixo}@teste.com`);
    await page.getByLabel("Senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();
    await expect(page).toHaveURL("/onboarding");

    await page.getByLabel("Nome do escritório").fill(nomeEscritorio);
    await page.getByRole("button", { name: /criar escritório/i }).click();
    await expect(page).toHaveURL("/");
  }

  test("já vem com o funil básico, permite criar/editar status e bloqueia exclusão com caso vinculado", async ({
    page,
  }) => {
    await cadastrarECriarEscritorio(page, "Escritório Status E2E");
    await page.goto("/configuracoes/status");

    // Todo escritório novo já nasce com os 6 status padrão do funil.
    await expect(page.getByText("Nova conversa").first()).toBeVisible();
    await expect(page.getByText("Em análise").first()).toBeVisible();
    await expect(page.getByText("Qualificado").first()).toBeVisible();
    await expect(page.getByText("Proposta enviada").first()).toBeVisible();
    await expect(page.getByText("Contrato fechado").first()).toBeVisible();
    await expect(page.getByText("Não interessado").first()).toBeVisible();

    // Criar um status novo, associado a um tipo de status existente.
    await page.getByRole("button", { name: "Novo status" }).click();
    await page.getByLabel("Nome").fill("Reunião agendada");
    await page.getByLabel("Tipo de status").click();
    await page.getByRole("option", { name: "Proposta" }).click();
    await page.getByRole("button", { name: "Selecionar ícone" }).click();
    await page.getByRole("option", { name: "Handshake" }).click();
    await page.getByRole("radio", { name: "Cor #8b5cf6" }).click();
    await page.getByRole("button", { name: "Criar status" }).click();
    await expect(page.getByRole("dialog", { name: "Novo status" })).toBeHidden();
    await expect(page.getByText("Reunião agendada")).toBeVisible();

    // Editar o status recém-criado.
    await page.getByRole("button", { name: "Editar Reunião agendada" }).click();
    await page.getByLabel("Nome").fill("Reunião confirmada");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("dialog", { name: "Editar status" })).toBeHidden();
    await expect(page.getByText("Reunião confirmada")).toBeVisible();

    // Vincula um caso a "Nova conversa" via API (mais rápido e estável que passar
    // pelo formulário de caso completo só para gerar a dependência deste teste).
    const clienteResp = await page.request.post("/api/clientes", {
      data: { nome: "Cliente Status E2E", cpf: "52998224725" },
    });
    const { cliente } = await clienteResp.json();
    const statusResp = await page.request.get("/api/status");
    const { status } = await statusResp.json();
    const novaConversa = status.find((s: { nome: string }) => s.nome === "Nova conversa");
    await page.request.post("/api/casos", {
      data: { titulo: "Caso vinculado", clienteId: cliente.id, statusId: novaConversa.id },
    });

    await page.reload();
    await page.getByRole("button", { name: "Excluir Nova conversa" }).click();
    const dialogoExcluir = page.getByRole("alertdialog");
    await dialogoExcluir.getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(page.getByText(/tem casos vinculados|não pode ser excluído/i)).toBeVisible();
    // O status continua na lista: a exclusão foi recusada, não silenciosamente ignorada.
    await expect(page.getByText("Nova conversa").first()).toBeVisible();
  });
});
