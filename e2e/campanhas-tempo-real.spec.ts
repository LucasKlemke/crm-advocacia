import { createHmac, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { SEGREDO_WEBHOOK_E2E, URL_UAZAPI_FALSA } from "./ambiente-e2e";

// Mesmo banco da API: localmente vem de apps/api/.env.local/.env (sem sobrescrever o
// ambiente), no CI do env do workflow.
config({
  path: [resolve(__dirname, "../apps/api/.env.local"), resolve(__dirname, "../apps/api/.env")],
  quiet: true,
});

// Fluxo crítico do tempo real: a UAZAPI (falsa, e2e/fake-uazapi.mjs) avança os
// contadores, avisa pelo webhook assinado, a API sincroniza e empurra a campanha pelo
// WebSocket — e a tela de detalhe mostra o número novo sem ninguém clicar em Sincronizar.
// A campanha é semeada direto no banco: criá-la pela UI exigiria parear um WhatsApp.
test.describe("Campanhas em tempo real", () => {
  let prisma: PrismaClient;

  test.beforeAll(() => {
    prisma = new PrismaClient();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("webhook da UAZAPI atualiza os contadores do detalhe sem sincronizar à mão", async ({
    page,
    request,
  }) => {
    // UUID e não Date.now(): workers paralelos no mesmo milissegundo colidiriam no e-mail.
    const sufixo = randomUUID();
    const email = `e2e-tempo-real-${sufixo}@teste.com`;

    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Advogada Tempo Real");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
    await page.getByLabel("Confirmar senha").fill("senha-forte-123");
    await page.getByRole("button", { name: /cadastrar/i }).click();
    await expect(page).toHaveURL("/onboarding");

    await page.getByLabel("Nome do escritório").fill(`Escritório Tempo Real ${sufixo}`);
    await page.getByRole("button", { name: /criar escritório/i }).click();
    await expect(page).toHaveURL("/");

    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { email },
      include: { membros: true },
    });
    const escritorioId = usuario.membros[0].escritorioId;

    const token = `token-e2e-${randomUUID()}`;
    const folderId = `pasta-e2e-${randomUUID()}`;
    const instancia = await prisma.instanciaWhatsapp.create({
      data: {
        escritorioId,
        nome: "WhatsApp E2E",
        uazapiInstanceId: `instancia-e2e-${randomUUID()}`,
        uazapiToken: token,
        status: "connected",
      },
    });
    const campanha = await prisma.campanha.create({
      data: {
        escritorioId,
        instanciaWhatsappId: instancia.id,
        criadoPorId: usuario.id,
        nome: "Campanha Tempo Real E2E",
        mensagemTemplate: "Olá, {{nome}}!",
        colunaNumero: "telefone",
        delayMin: 1,
        delayMax: 2,
        status: "enviando",
        uazapiFolderId: folderId,
        totalDestinatarios: 10,
        logTotal: 10,
      },
    });

    // A pasta na UAZAPI falsa começa igual ao banco: nada enviado ainda.
    const pastaInicial = await request.post(`${URL_UAZAPI_FALSA}/__fake/contadores`, {
      data: { token, folderId, status: "sending", log_total: 10, log_sucess: 0 },
    });
    expect(pastaInicial.ok()).toBe(true);

    await page.goto(`/campanhas/${campanha.id}`);
    await expect(page.getByRole("heading", { name: "Campanha Tempo Real E2E" })).toBeVisible();
    await expect(page.getByText("Ao vivo")).toBeVisible();

    const enviadas = page.getByText("Enviadas", { exact: true }).locator("..");
    await expect(enviadas).toHaveText(/^Enviadas\s*0$/);

    // A UAZAPI avança o envio e avisa pelo webhook assinado da instância.
    const pastaAvancada = await request.post(`${URL_UAZAPI_FALSA}/__fake/contadores`, {
      data: { token, folderId, log_sucess: 7 },
    });
    expect(pastaAvancada.ok()).toBe(true);

    const assinatura = createHmac("sha256", SEGREDO_WEBHOOK_E2E)
      .update(instancia.id)
      .digest("base64url");
    const webhook = await request.post(`/api/webhooks/uazapi/${instancia.id}/${assinatura}`, {
      data: { EventType: "sender" },
    });
    expect(webhook.status()).toBe(200);

    // Sem clicar em Sincronizar: janela de 2 s do webhook + sincronização + WebSocket.
    await expect(enviadas).toContainText("7", { timeout: 10_000 });
  });
});
