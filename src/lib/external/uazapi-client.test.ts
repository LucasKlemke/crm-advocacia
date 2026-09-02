import { uazapiClient, UazapiIndisponivelError } from "./uazapi-client";

function respostaFake(corpo: unknown, init: { status?: number; ok?: boolean } = {}) {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? status < 400,
    status,
    json: async () => corpo,
  } as unknown as Response;
}

const SERVER_URL = "https://escritorio.uazapi.com";
const ADMIN_TOKEN = "admin-token-123";

describe("uazapiClient", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.UAZAPI_SERVER_URL = SERVER_URL;
    process.env.UAZAPI_ADMIN_TOKEN = ADMIN_TOKEN;
  });

  afterEach(() => {
    delete process.env.UAZAPI_SERVER_URL;
    delete process.env.UAZAPI_ADMIN_TOKEN;
  });

  describe("criarInstancia", () => {
    it("chama POST /instance/create com URL, headers e body corretos", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ instance: { id: "inst-1", token: "tok-1", status: "loading" } })
      );

      await uazapiClient.criarInstancia("Escritório Lucas");

      expect(global.fetch).toHaveBeenCalledWith(`${SERVER_URL}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          admintoken: ADMIN_TOKEN,
        },
        body: JSON.stringify({ name: "Escritório Lucas" }),
      });
    });

    it("inclui adminField01 no body quando informado (namespacing por tenant na UAZAPI)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ instance: { id: "inst-1", token: "tok-1", status: "loading" } })
      );

      await uazapiClient.criarInstancia("esc-1:Atendimento", { adminField01: "esc-1" });

      expect(global.fetch).toHaveBeenCalledWith(`${SERVER_URL}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          admintoken: ADMIN_TOKEN,
        },
        body: JSON.stringify({ name: "esc-1:Atendimento", adminField01: "esc-1" }),
      });
    });

    it("faz parsing de id/token/status a partir de body.instance", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ instance: { id: "inst-1", token: "tok-1", status: "connected", name: "x" } })
      );

      await expect(uazapiClient.criarInstancia("x")).resolves.toEqual({
        id: "inst-1",
        token: "tok-1",
        status: "connected",
      });
    });

    it("usa fallback pro token/id de nível raiz quando body.instance vem ausente", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ id: "inst-raiz", token: "tok-raiz", status: "loading" })
      );

      await expect(uazapiClient.criarInstancia("x")).resolves.toEqual({
        id: "inst-raiz",
        token: "tok-raiz",
        status: "loading",
      });
    });

    it("lança erro se UAZAPI_SERVER_URL não estiver configurado", async () => {
      delete process.env.UAZAPI_SERVER_URL;

      await expect(uazapiClient.criarInstancia("x")).rejects.toThrow(
        "UAZAPI_SERVER_URL não configurado."
      );
    });

    it("lança erro se UAZAPI_ADMIN_TOKEN não estiver configurado", async () => {
      delete process.env.UAZAPI_ADMIN_TOKEN;

      await expect(uazapiClient.criarInstancia("x")).rejects.toThrow(
        "UAZAPI_ADMIN_TOKEN não configurado."
      );
    });

    it("lança UazapiIndisponivelError se a resposta HTTP não for 2xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ error: "algum detalhe interno sensível" }, { status: 500 })
      );

      const erro: unknown = await uazapiClient.criarInstancia("x").catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(UazapiIndisponivelError);
      expect((erro as Error).message).toBe("Não foi possível se comunicar com o WhatsApp no momento.");
      expect((erro as Error).message).not.toContain("sensível");
    });

    it("lança UazapiIndisponivelError se a resposta 2xx não tiver token", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({ instance: { id: "inst-1" } }));

      await expect(uazapiClient.criarInstancia("x")).rejects.toBeInstanceOf(UazapiIndisponivelError);
    });

    // Regressão: `id` ausente/vazio não pode virar `id: undefined` cast pra string e
    // seguir adiante até estourar validação do Prisma (cuja mensagem ecoaria o token).
    it("lança UazapiIndisponivelError se a resposta 2xx não tiver id", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ instance: { token: "tok-1", status: "loading" } })
      );

      const erro: unknown = await uazapiClient.criarInstancia("x").catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(UazapiIndisponivelError);
      expect((erro as Error).message).not.toContain("tok-1");
    });

    it("lança UazapiIndisponivelError em caso de falha de rede", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(uazapiClient.criarInstancia("x")).rejects.toBeInstanceOf(UazapiIndisponivelError);
    });

    // Corpo 2xx sem JSON legível (vazio, HTML, JSON truncado) é falha de contrato real de
    // API de terceiro — não pode borbulhar como SyntaxError cru pro chamador.
    it("lança UazapiIndisponivelError se a resposta 2xx não tiver JSON legível", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      } as unknown as Response);

      await expect(uazapiClient.criarInstancia("x")).rejects.toBeInstanceOf(UazapiIndisponivelError);
    });
  });

  describe("conectarInstancia", () => {
    it("chama POST /instance/connect com URL, headers (token, não admintoken) e body vazio", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({ instance: { status: "connecting" } }));

      await uazapiClient.conectarInstancia("tok-instancia");

      expect(global.fetch).toHaveBeenCalledWith(`${SERVER_URL}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          token: "tok-instancia",
        },
        body: JSON.stringify({}),
      });
    });

    it("faz parsing de status/qrcode/paircode a partir de body.instance", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ instance: { status: "connecting", qrcode: "data:img", paircode: "ABCD-1234" } })
      );

      await expect(uazapiClient.conectarInstancia("tok")).resolves.toEqual({
        status: "connecting",
        qrcode: "data:img",
        paircode: "ABCD-1234",
        numeroConectado: undefined,
        fotoPerfilUrl: undefined,
      });
    });

    it("faz parsing tolerante quando os campos vêm no nível raiz (sem body.instance)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ status: "connecting", qrcode: "data:img-raiz" })
      );

      await expect(uazapiClient.conectarInstancia("tok")).resolves.toEqual({
        status: "connecting",
        qrcode: "data:img-raiz",
        paircode: undefined,
        numeroConectado: undefined,
        fotoPerfilUrl: undefined,
      });
    });

    // O usuário confirmou (payloads reais de webhook) que /instance/connect também
    // devolve owner/profilePicUrl quando já disponíveis — mesmo parsing tolerante de
    // consultarStatus, mas ambos os campos são opcionais aqui (instância recém-criada
    // ainda não tem número/foto).
    it("faz parsing tolerante de numeroConectado (owner) e fotoPerfilUrl (profilePicUrl) quando presentes", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({
          instance: {
            status: "connected",
            owner: "554796589979",
            profilePicUrl: "https://pps.whatsapp.net/foto.jpg",
          },
        })
      );

      await expect(uazapiClient.conectarInstancia("tok")).resolves.toEqual({
        status: "connected",
        qrcode: undefined,
        paircode: undefined,
        numeroConectado: "554796589979",
        fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
      });
    });

    it("não lança e devolve numeroConectado/fotoPerfilUrl undefined quando ausentes (instância recém-criada)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ instance: { status: "connecting", qrcode: "data:img" } })
      );

      await expect(uazapiClient.conectarInstancia("tok")).resolves.toEqual({
        status: "connecting",
        qrcode: "data:img",
        paircode: undefined,
        numeroConectado: undefined,
        fotoPerfilUrl: undefined,
      });
    });

    it("lança UazapiIndisponivelError se a resposta HTTP não for 2xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({}, { status: 503 }));

      await expect(uazapiClient.conectarInstancia("tok")).rejects.toBeInstanceOf(UazapiIndisponivelError);
    });

    it("lança UazapiIndisponivelError em caso de falha de rede", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(uazapiClient.conectarInstancia("tok")).rejects.toBeInstanceOf(UazapiIndisponivelError);
    });
  });

  describe("consultarStatus", () => {
    // Regressão: UAZAPI responde 405 Method Not Allowed pra POST em /instance/status —
    // esse endpoint só aceita GET (confirmado testando ao vivo contra o servidor real).
    it("chama GET /instance/status com URL e headers corretos, sem body", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ instance: { status: "connected", owner: "5511999999999" } })
      );

      await uazapiClient.consultarStatus("tok-instancia");

      const chamada = (global.fetch as jest.Mock).mock.calls[0];
      expect(chamada[0]).toBe(`${SERVER_URL}/instance/status`);
      expect(chamada[1]).toEqual({
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          token: "tok-instancia",
        },
      });
      expect(chamada[1]).not.toHaveProperty("body");
    });

    it("faz parsing de status/numeroConectado (owner)/fotoPerfilUrl (profilePicUrl) a partir de body.instance", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({
          instance: {
            status: "connected",
            owner: "5511999999999",
            profilePicUrl: "https://pps.whatsapp.net/foto.jpg",
          },
        })
      );

      await expect(uazapiClient.consultarStatus("tok")).resolves.toEqual({
        status: "connected",
        numeroConectado: "5511999999999",
        fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
      });
    });

    it("faz parsing tolerante quando os campos vêm no nível raiz (sem body.instance)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ status: "disconnected" })
      );

      await expect(uazapiClient.consultarStatus("tok")).resolves.toEqual({
        status: "disconnected",
        numeroConectado: undefined,
        fotoPerfilUrl: undefined,
      });
    });

    it("não lança e devolve numeroConectado/fotoPerfilUrl undefined quando ausentes", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ instance: { status: "connecting" } })
      );

      await expect(uazapiClient.consultarStatus("tok")).resolves.toEqual({
        status: "connecting",
        numeroConectado: undefined,
        fotoPerfilUrl: undefined,
      });
    });

    it("lança UazapiIndisponivelError se a resposta HTTP não for 2xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({}, { status: 401 }));

      await expect(uazapiClient.consultarStatus("tok")).rejects.toBeInstanceOf(UazapiIndisponivelError);
    });

    it("lança UazapiIndisponivelError em caso de falha de rede", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(uazapiClient.consultarStatus("tok")).rejects.toBeInstanceOf(UazapiIndisponivelError);
    });
  });

  describe("listarTodasInstancias", () => {
    it("chama GET /instance/all com admintoken (não token de instância) e sem body", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake([{ id: "i1", status: "connected", token: "tok-alheio" }])
      );

      await uazapiClient.listarTodasInstancias();

      const chamada = (global.fetch as jest.Mock).mock.calls[0];
      expect(chamada[0]).toBe(`${SERVER_URL}/instance/all`);
      expect(chamada[1]).toEqual({
        method: "GET",
        headers: {
          Accept: "application/json",
          admintoken: ADMIN_TOKEN,
        },
      });
      expect(chamada[1]).not.toHaveProperty("body");
    });

    // Segurança crítica: essa resposta mistura instâncias de TODOS os escritórios da
    // conta UAZAPI compartilhada — cada item carrega um `token` de algum tenant
    // (possivelmente de outro escritório). O mapeamento precisa jogar fora tudo que não
    // está na lista branca, mesmo que a resposta bruta traga token/openai_apikey/etc.
    it("mapeia cada item pro formato whitelisted, sem token (mesmo que a resposta bruta traga um)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake([
          {
            id: "i1",
            token: "tok-secreto-de-outro-tenant",
            status: "connected",
            owner: "5511999999999",
            profilePicUrl: "https://example.com/foto.jpg",
            adminField01: "esc-1",
            openai_apikey: "sk-xyz",
            chatbot_enabled: true,
          },
        ])
      );

      const resultado = await uazapiClient.listarTodasInstancias();

      expect(resultado).toEqual([
        {
          id: "i1",
          status: "connected",
          owner: "5511999999999",
          fotoPerfilUrl: "https://example.com/foto.jpg",
          adminField01: "esc-1",
        },
      ]);
      for (const item of resultado) {
        expect(item).not.toHaveProperty("token");
        expect(item).not.toHaveProperty("openai_apikey");
        expect(item).not.toHaveProperty("chatbot_enabled");
      }
    });

    it("mapeia owner/fotoPerfilUrl/adminField01 ausentes como undefined (não string vazia)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake([{ id: "i2", status: "disconnected" }])
      );

      await expect(uazapiClient.listarTodasInstancias()).resolves.toEqual([
        { id: "i2", status: "disconnected", owner: undefined, fotoPerfilUrl: undefined, adminField01: undefined },
      ]);
    });

    it("lança UazapiIndisponivelError se a resposta não for um array", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({ instance: [] }));

      await expect(uazapiClient.listarTodasInstancias()).rejects.toBeInstanceOf(
        UazapiIndisponivelError
      );
    });

    it("lança UazapiIndisponivelError se a resposta HTTP não for 2xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake([], { status: 500 }));

      await expect(uazapiClient.listarTodasInstancias()).rejects.toBeInstanceOf(
        UazapiIndisponivelError
      );
    });

    it("lança UazapiIndisponivelError em caso de falha de rede", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(uazapiClient.listarTodasInstancias()).rejects.toBeInstanceOf(
        UazapiIndisponivelError
      );
    });
  });

  const TOKEN_INSTANCIA = "tok-instancia-1";

  describe("criarEnvioAvancado", () => {
    const envio = {
      delayMin: 3,
      delayMax: 6,
      info: "Campanha de teste",
      messages: [
        { number: "5511999999999", type: "text" as const, text: "Olá, Ana" },
        { number: "5511888888888", type: "text" as const, text: "Olá, Bruno" },
      ],
    };

    it("chama POST /sender/advanced com o token da instância e as mensagens no body", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ folder_id: "folder-1", count: 2, status: "queued" })
      );

      await uazapiClient.criarEnvioAvancado(TOKEN_INSTANCIA, envio);

      expect(global.fetch).toHaveBeenCalledWith(`${SERVER_URL}/sender/advanced`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          token: TOKEN_INSTANCIA,
        },
        body: JSON.stringify({
          delayMin: 3,
          delayMax: 6,
          info: "Campanha de teste",
          messages: envio.messages,
        }),
      });
    });

    it("inclui scheduled_for apenas quando há agendamento", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ folder_id: "folder-1", count: 2, status: "scheduled" })
      );

      await uazapiClient.criarEnvioAvancado(TOKEN_INSTANCIA, { ...envio, scheduledFor: 1767225600000 });

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.scheduled_for).toBe(1767225600000);
    });

    it("devolve folderId, count e status da resposta", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ folder_id: "folder-1", count: 2, status: "queued" })
      );

      await expect(uazapiClient.criarEnvioAvancado(TOKEN_INSTANCIA, envio)).resolves.toEqual({
        folderId: "folder-1",
        count: 2,
        status: "queued",
      });
    });

    // Sem folder_id não há como sincronizar nem controlar a campanha depois: é resposta
    // fora de contrato, não um envio bem-sucedido.
    it("lança UazapiIndisponivelError quando a resposta não traz folder_id", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({ count: 2, status: "queued" }));

      await expect(
        uazapiClient.criarEnvioAvancado(TOKEN_INSTANCIA, envio)
      ).rejects.toBeInstanceOf(UazapiIndisponivelError);
    });

    it("usa o count do corpo ou, na falta dele, o total de mensagens enviadas", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({ folder_id: "folder-1" }));

      const resultado = await uazapiClient.criarEnvioAvancado(TOKEN_INSTANCIA, envio);

      expect(resultado.count).toBe(2);
    });

    it("lança UazapiIndisponivelError se a resposta HTTP não for 2xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({}, { status: 401 }));

      await expect(
        uazapiClient.criarEnvioAvancado(TOKEN_INSTANCIA, envio)
      ).rejects.toBeInstanceOf(UazapiIndisponivelError);
    });
  });

  describe("listarCampanhas", () => {
    it("chama GET /sender/listfolders com o token da instância e sem body", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake([]));

      await uazapiClient.listarCampanhas(TOKEN_INSTANCIA);

      const chamada = (global.fetch as jest.Mock).mock.calls[0];
      expect(chamada[0]).toBe(`${SERVER_URL}/sender/listfolders`);
      expect(chamada[1]).toEqual({
        method: "GET",
        headers: { Accept: "application/json", token: TOKEN_INSTANCIA },
      });
      expect(chamada[1]).not.toHaveProperty("body");
    });

    it("mapeia os contadores snake_case da UAZAPI para camelCase", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake([
          {
            id: "folder-1",
            info: "Campanha de teste",
            status: "sending",
            log_total: 10,
            log_sucess: 7,
            log_failed: 1,
            log_delivered: 6,
            log_read: 4,
            log_played: 2,
          },
        ])
      );

      await expect(uazapiClient.listarCampanhas(TOKEN_INSTANCIA)).resolves.toEqual([
        {
          id: "folder-1",
          info: "Campanha de teste",
          status: "sending",
          logTotal: 10,
          logSucesso: 7,
          logFalha: 1,
          logEntregue: 6,
          logLido: 4,
          logReproduzido: 2,
        },
      ]);
    });

    it("trata contador ausente como zero", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake([{ id: "folder-1", status: "done" }])
      );

      const [folder] = await uazapiClient.listarCampanhas(TOKEN_INSTANCIA);

      expect(folder.logTotal).toBe(0);
      expect(folder.logSucesso).toBe(0);
      expect(folder.logFalha).toBe(0);
    });

    // Mesmo formato de /instance/all: array na raiz do corpo, e não um objeto.
    it("lança UazapiIndisponivelError se a resposta não for um array", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({ folders: [] }));

      await expect(uazapiClient.listarCampanhas(TOKEN_INSTANCIA)).rejects.toBeInstanceOf(
        UazapiIndisponivelError
      );
    });
  });

  describe("controlarCampanha", () => {
    it("chama POST /sender/edit com folder_id e action", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake(null));

      await uazapiClient.controlarCampanha(TOKEN_INSTANCIA, "folder-1", "stop");

      expect(global.fetch).toHaveBeenCalledWith(`${SERVER_URL}/sender/edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          token: TOKEN_INSTANCIA,
        },
        body: JSON.stringify({ folder_id: "folder-1", action: "stop" }),
      });
    });

    // O endpoint documenta resposta `null`. Sem tolerar corpo vazio, uma ação
    // bem-sucedida viraria UazapiIndisponivelError (502) na cara do usuário.
    it("aceita corpo vazio como sucesso", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake(null));

      await expect(
        uazapiClient.controlarCampanha(TOKEN_INSTANCIA, "folder-1", "continue")
      ).resolves.toBeUndefined();
    });

    it("lança UazapiIndisponivelError se a resposta HTTP não for 2xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake(null, { status: 404 }));

      await expect(
        uazapiClient.controlarCampanha(TOKEN_INSTANCIA, "folder-1", "delete")
      ).rejects.toBeInstanceOf(UazapiIndisponivelError);
    });

    it("lança UazapiIndisponivelError em caso de falha de rede", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(
        uazapiClient.controlarCampanha(TOKEN_INSTANCIA, "folder-1", "stop")
      ).rejects.toBeInstanceOf(UazapiIndisponivelError);
    });
  });

  describe("desconectarInstancia", () => {
    it("chama POST /instance/disconnect com o token da instância", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ instance: { status: "disconnected" }, response: "Disconnected" })
      );

      await uazapiClient.desconectarInstancia("tok-instancia");

      expect(global.fetch).toHaveBeenCalledWith(`${SERVER_URL}/instance/disconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          token: "tok-instancia",
        },
        body: JSON.stringify({}),
      });
    });

    // Nunca o admintoken: a instância desconectada é a dona do token enviado. Um
    // admintoken aqui desconectaria uma instância indeterminada da conta compartilhada.
    it("não envia admintoken", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({ response: "Disconnected" }));

      await uazapiClient.desconectarInstancia("tok-instancia");

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.headers).not.toHaveProperty("admintoken");
    });

    it("lança UazapiIndisponivelError se a resposta HTTP não for 2xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({}, { status: 401 }));

      await expect(uazapiClient.desconectarInstancia("tok")).rejects.toBeInstanceOf(
        UazapiIndisponivelError
      );
    });

    it("lança UazapiIndisponivelError em caso de falha de rede", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(uazapiClient.desconectarInstancia("tok")).rejects.toBeInstanceOf(
        UazapiIndisponivelError
      );
    });
  });

  describe("deletarInstancia", () => {
    it("chama DELETE /instance com o token da instância e sem body", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ response: "Instance Deleted" })
      );

      await uazapiClient.deletarInstancia("tok-instancia");

      const chamada = (global.fetch as jest.Mock).mock.calls[0];
      expect(chamada[0]).toBe(`${SERVER_URL}/instance`);
      expect(chamada[1]).toEqual({
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          token: "tok-instancia",
        },
      });
      expect(chamada[1]).not.toHaveProperty("body");
    });

    // A rota não recebe id: quem é excluído é a dona do token do header. Com admintoken
    // a chamada deixaria de identificar a instância alvo.
    it("não envia admintoken", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ response: "Instance Deleted" })
      );

      await uazapiClient.deletarInstancia("tok-instancia");

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.headers).not.toHaveProperty("admintoken");
    });

    it("lança UazapiIndisponivelError se a resposta HTTP não for 2xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaFake({}, { status: 404 }));

      await expect(uazapiClient.deletarInstancia("tok")).rejects.toBeInstanceOf(
        UazapiIndisponivelError
      );
    });

    it("lança UazapiIndisponivelError em caso de falha de rede", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(uazapiClient.deletarInstancia("tok")).rejects.toBeInstanceOf(
        UazapiIndisponivelError
      );
    });
  });
});
