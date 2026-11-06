import { createHmac, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { SEGREDO_WEBHOOK_E2E, URL_UAZAPI_FALSA } from "./ambiente-e2e";

// Mesmo banco da API: localmente vem de apps/api/.env.local/.env (sem sobrescrever o
// ambiente), no CI do env do workflow.
config({
  path: [resolve(__dirname, "../apps/api/.env.local"), resolve(__dirname, "../apps/api/.env")],
  quiet: true,
});

// Cadastra um usuário + escritório pela UI e devolve os ids (a sessão fica na `page`).
async function cadastrarEscritorio(page: Page, prisma: PrismaClient) {
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
  return { usuarioId: usuario.id, escritorioId: usuario.membros[0].escritorioId };
}

// Webhook assinado da instância, como a UAZAPI chamaria a URL registrada.
async function enviarWebhook(request: APIRequestContext, instanciaId: string, evento: string) {
  const assinatura = createHmac("sha256", SEGREDO_WEBHOOK_E2E).update(instanciaId).digest("base64url");
  const resposta = await request.post(`/api/webhooks/uazapi/${instanciaId}/${assinatura}`, {
    data: { EventType: evento },
  });
  expect(resposta.status()).toBe(200);
}

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
    const { usuarioId, escritorioId } = await cadastrarEscritorio(page, prisma);

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
        criadoPorId: usuarioId,
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

    await enviarWebhook(request, instancia.id, "sender");

    // Sem clicar em Sincronizar: janela de 2 s do webhook + sincronização + WebSocket.
    await expect(enviadas).toContainText("7", { timeout: 10_000 });
  });

  // Confirmação de leitura chega depois que o envio terminou e não mexe nos contadores do
  // folder: só o status da mensagem muda, e a tabela do detalhe precisa reler sozinha.
  test("messages_update atualiza o status da mensagem de campanha já concluída", async ({
    page,
    request,
  }) => {
    const { usuarioId, escritorioId } = await cadastrarEscritorio(page, prisma);
    const token = `token-e2e-${randomUUID()}`;
    const folderId = `pasta-e2e-${randomUUID()}`;
    const instancia = await prisma.instanciaWhatsapp.create({
      data: {
        escritorioId,
        nome: "WhatsApp E2E Mensagens",
        uazapiInstanceId: `instancia-e2e-${randomUUID()}`,
        uazapiToken: token,
        status: "connected",
      },
    });
    const campanha = await prisma.campanha.create({
      data: {
        escritorioId,
        instanciaWhatsappId: instancia.id,
        criadoPorId: usuarioId,
        nome: "Campanha Concluída E2E",
        mensagemTemplate: "Olá, {{nome}}!",
        colunaNumero: "telefone",
        delayMin: 1,
        delayMax: 2,
        status: "concluida",
        uazapiFolderId: folderId,
        totalDestinatarios: 1,
        logTotal: 1,
        logSucesso: 1,
        itens: {
          create: { escritorioId, linha: 1, numero: "5547999990001", mensagem: "Olá, Ana!" },
        },
      },
    });
    const pasta = await request.post(`${URL_UAZAPI_FALSA}/__fake/contadores`, {
      data: { token, folderId, status: "done", log_total: 1, log_sucess: 1 },
    });
    expect(pasta.ok()).toBe(true);
    const mensagem = (status: string) => ({
      id: "msg-1",
      chatid: "554799990001@s.whatsapp.net",
      status,
      messageTimestamp: Date.now(),
    });
    const enviada = await request.post(`${URL_UAZAPI_FALSA}/__fake/mensagens`, {
      data: { token, folderId, mensagens: [mensagem("Sent")] },
    });
    expect(enviada.ok()).toBe(true);

    await page.goto(`/campanhas/${campanha.id}`);
    await expect(page.getByText("Ao vivo")).toBeVisible();
    const linha = page.getByRole("row", { name: /Olá, Ana!/ });
    await expect(linha).toContainText("Enviada");

    const lida = await request.post(`${URL_UAZAPI_FALSA}/__fake/mensagens`, {
      data: { token, folderId, mensagens: [mensagem("Read")] },
    });
    expect(lida.ok()).toBe(true);
    await enviarWebhook(request, instancia.id, "messages_update");

    await expect(linha).toContainText("Lida", { timeout: 10_000 });
  });

  test("webhook connection mostra a instância conectada sem verificar à mão", async ({
    page,
    request,
  }) => {
    const { escritorioId } = await cadastrarEscritorio(page, prisma);
    const token = `token-e2e-${randomUUID()}`;
    const instancia = await prisma.instanciaWhatsapp.create({
      data: {
        escritorioId,
        nome: "WhatsApp E2E Conexão",
        uazapiInstanceId: `instancia-e2e-${randomUUID()}`,
        uazapiToken: token,
        status: "connecting",
      },
    });

    await page.goto("/instancias");
    const linha = page.getByRole("row", { name: /WhatsApp E2E Conexão/ });
    await expect(linha).toContainText("Conectando");

    // O celular leu o QR: a UAZAPI passa a responder connected e avisa pelo webhook.
    const conectada = await request.post(`${URL_UAZAPI_FALSA}/__fake/instancia`, {
      data: { token, status: "connected", owner: "5547999990002" },
    });
    expect(conectada.ok()).toBe(true);
    await enviarWebhook(request, instancia.id, "connection");

    await expect(linha).toContainText("Conectado", { timeout: 10_000 });
  });
});
