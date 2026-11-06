import { atrasoReconexao, interpretarMensagem, montarUrlWs } from "./tempo-real";

function localizacao(protocol: string, host: string) {
  return { protocol, host } as Location;
}

describe("montarUrlWs", () => {
  it("usa ws:// e o host da página quando ela é servida por http", () => {
    expect(montarUrlWs("abc", undefined, localizacao("http:", "localhost:5173"))).toBe(
      "ws://localhost:5173/api/ws?ticket=abc"
    );
  });

  it("usa wss:// quando a página é servida por https", () => {
    expect(montarUrlWs("abc", undefined, localizacao("https:", "crm.exemplo.com"))).toBe(
      "wss://crm.exemplo.com/api/ws?ticket=abc"
    );
  });

  it("com base configurada ignora a página e não duplica a barra final", () => {
    const pagina = localizacao("https:", "crm.exemplo.com");
    expect(montarUrlWs("abc", "wss://api.exemplo.com/", pagina)).toBe(
      "wss://api.exemplo.com/api/ws?ticket=abc"
    );
    expect(montarUrlWs("abc", "wss://api.exemplo.com", pagina)).toBe(
      "wss://api.exemplo.com/api/ws?ticket=abc"
    );
  });

  it("base vazia vale como ausente", () => {
    expect(montarUrlWs("abc", "", localizacao("http:", "localhost:4173"))).toBe(
      "ws://localhost:4173/api/ws?ticket=abc"
    );
  });

  it("codifica o ticket na query string", () => {
    expect(montarUrlWs("a+b/c=", undefined, localizacao("http:", "h"))).toBe(
      "ws://h/api/ws?ticket=a%2Bb%2Fc%3D"
    );
  });
});

describe("atrasoReconexao", () => {
  it("dobra a partir de 1 s e para em 30 s", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(atrasoReconexao)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000,
    ]);
  });
});

describe("interpretarMensagem", () => {
  it("aceita os três tipos do contrato", () => {
    expect(interpretarMensagem('{"tipo":"pronto"}')).toEqual({ tipo: "pronto" });
    expect(interpretarMensagem('{"tipo":"campanha.removida","campanhaId":"c1"}')).toEqual({
      tipo: "campanha.removida",
      campanhaId: "c1",
    });
    expect(
      interpretarMensagem('{"tipo":"campanha.atualizada","campanha":{"id":"c1"}}')
    ).toEqual({ tipo: "campanha.atualizada", campanha: { id: "c1" } });
  });

  it("ignora JSON inválido, binário, tipo desconhecido e payload incompleto", () => {
    expect(interpretarMensagem("não é json")).toBeNull();
    expect(interpretarMensagem(new ArrayBuffer(2))).toBeNull();
    expect(interpretarMensagem('{"tipo":"outro"}')).toBeNull();
    expect(interpretarMensagem('{"tipo":"campanha.atualizada"}')).toBeNull();
    expect(interpretarMensagem('{"tipo":"campanha.removida"}')).toBeNull();
    expect(interpretarMensagem("null")).toBeNull();
  });
});
