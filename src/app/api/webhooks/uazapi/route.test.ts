/**
 * @jest-environment node
 */
import { POST } from "./route";

describe("POST /api/webhooks/uazapi", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("loga o payload recebido e responde 200", async () => {
    const payload = { event: "messages", instance: "abc123", data: { texto: "oi" } };
    const request = new Request("http://localhost/api/webhooks/uazapi", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const resposta = await POST(request);

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({ ok: true });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[webhook uazapi]"),
      expect.objectContaining(payload)
    );
  });

  it("responde 200 mesmo com corpo vazio, sem lançar erro", async () => {
    const request = new Request("http://localhost/api/webhooks/uazapi", {
      method: "POST",
      body: "",
    });

    const resposta = await POST(request);

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({ ok: true });
  });

  it("responde 200 mesmo com corpo não-JSON, sem lançar erro", async () => {
    const request = new Request("http://localhost/api/webhooks/uazapi", {
      method: "POST",
      body: "isso não é json",
    });

    const resposta = await POST(request);

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({ ok: true });
  });
});
