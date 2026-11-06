import {
  assinarInstancia,
  assinaturaValida,
  urlWebhookDaInstancia,
} from "./assinatura-webhook";

const SEGREDO = "segredo-de-teste";

describe("assinarInstancia", () => {
  it("é determinística e url-safe", () => {
    const a = assinarInstancia("inst-1", SEGREDO);
    expect(a).toBe(assinarInstancia("inst-1", SEGREDO));
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("assinaturaValida", () => {
  it("aceita a própria assinatura", () => {
    expect(assinaturaValida("inst-1", assinarInstancia("inst-1", SEGREDO), SEGREDO)).toBe(true);
  });

  it("recusa a assinatura de outro id", () => {
    expect(assinaturaValida("inst-1", assinarInstancia("inst-2", SEGREDO), SEGREDO)).toBe(false);
  });

  it("recusa string vazia ou truncada sem lançar", () => {
    const a = assinarInstancia("inst-1", SEGREDO);
    expect(assinaturaValida("inst-1", "", SEGREDO)).toBe(false);
    expect(assinaturaValida("inst-1", a.slice(0, -1), SEGREDO)).toBe(false);
  });

  it("recusa com segredo diferente", () => {
    expect(assinaturaValida("inst-1", assinarInstancia("inst-1", SEGREDO), "outro")).toBe(false);
  });
});

describe("urlWebhookDaInstancia", () => {
  const base = { API_PUBLIC_URL: "https://api.exemplo.com", UAZAPI_WEBHOOK_SECRET: SEGREDO };

  it("monta a URL com a assinatura", () => {
    expect(urlWebhookDaInstancia("inst-1", base)).toBe(
      `https://api.exemplo.com/api/webhooks/uazapi/inst-1/${assinarInstancia("inst-1", SEGREDO)}`
    );
  });

  it("remove a barra final de API_PUBLIC_URL", () => {
    expect(
      urlWebhookDaInstancia("inst-1", { ...base, API_PUBLIC_URL: "https://api.exemplo.com/" })
    ).toBe(urlWebhookDaInstancia("inst-1", base));
  });

  it("devolve null sem API_PUBLIC_URL", () => {
    expect(urlWebhookDaInstancia("inst-1", { UAZAPI_WEBHOOK_SECRET: SEGREDO })).toBeNull();
  });

  it("devolve null sem UAZAPI_WEBHOOK_SECRET", () => {
    expect(urlWebhookDaInstancia("inst-1", { API_PUBLIC_URL: "https://a.com" })).toBeNull();
  });
});
