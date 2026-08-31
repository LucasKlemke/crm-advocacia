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
    it("chama POST /instance/status com URL e headers corretos, sem body", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ instance: { status: "connected", owner: "5511999999999" } })
      );

      await uazapiClient.consultarStatus("tok-instancia");

      expect(global.fetch).toHaveBeenCalledWith(`${SERVER_URL}/instance/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          token: "tok-instancia",
        },
      });
    });

    it("faz parsing de status/numeroConectado (owner) a partir de body.instance", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ instance: { status: "connected", owner: "5511999999999" } })
      );

      await expect(uazapiClient.consultarStatus("tok")).resolves.toEqual({
        status: "connected",
        numeroConectado: "5511999999999",
      });
    });

    it("faz parsing tolerante quando os campos vêm no nível raiz (sem body.instance)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        respostaFake({ status: "disconnected" })
      );

      await expect(uazapiClient.consultarStatus("tok")).resolves.toEqual({
        status: "disconnected",
        numeroConectado: undefined,
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
});
