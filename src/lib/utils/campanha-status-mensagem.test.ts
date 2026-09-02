import {
  numeroDoChatid,
  paraDataMensagem,
  paraStatusMensagem,
  resumirPorNumero,
} from "./campanha-status-mensagem";

describe("paraStatusMensagem", () => {
  it("entende os status documentados no filtro do /sender/listmessages", () => {
    expect(paraStatusMensagem("Scheduled")).toBe("pendente");
    expect(paraStatusMensagem("Sent")).toBe("enviada");
    expect(paraStatusMensagem("Failed")).toBe("falha");
  });

  it("entende também os status de entrega que a UAZAPI reporta nos contadores", () => {
    expect(paraStatusMensagem("Delivered")).toBe("entregue");
    expect(paraStatusMensagem("Read")).toBe("lida");
    expect(paraStatusMensagem("Played")).toBe("lida");
  });

  // A doc só tipa `status` como string: o caso não é garantido e há variantes na prática.
  it("não se importa com caixa nem com espaços em volta", () => {
    expect(paraStatusMensagem("SENT")).toBe("enviada");
    expect(paraStatusMensagem(" failed ")).toBe("falha");
    expect(paraStatusMensagem("pending")).toBe("pendente");
    expect(paraStatusMensagem("error")).toBe("falha");
  });

  // Diferente do status da campanha (que vira enum do Prisma e por isso estoura em valor
  // fora do contrato), aqui é só exibição: um status novo não pode derrubar a tela.
  it("cai em desconhecido no que não reconhece", () => {
    expect(paraStatusMensagem("algo_novo")).toBe("desconhecido");
    expect(paraStatusMensagem("")).toBe("desconhecido");
  });
});

describe("numeroDoChatid", () => {
  it("extrai só os dígitos do jid do WhatsApp", () => {
    expect(numeroDoChatid("5511999998888@s.whatsapp.net")).toBe("5511999998888");
    expect(numeroDoChatid("5511999998888@c.us")).toBe("5511999998888");
    expect(numeroDoChatid("5511999998888")).toBe("5511999998888");
  });

  it("devolve vazio quando não há número nenhum", () => {
    expect(numeroDoChatid("")).toBe("");
    expect(numeroDoChatid("grupo@g.us")).toBe("");
  });
});

describe("paraDataMensagem", () => {
  it("trata timestamp em segundos, que é o que o WhatsApp usa", () => {
    expect(paraDataMensagem(1_777_000_000)?.toISOString()).toBe(
      new Date(1_777_000_000_000).toISOString()
    );
  });

  it("aceita timestamp já em milissegundos", () => {
    expect(paraDataMensagem(1_777_000_000_000)?.toISOString()).toBe(
      new Date(1_777_000_000_000).toISOString()
    );
  });

  it("devolve null quando não há data", () => {
    expect(paraDataMensagem(0)).toBeNull();
    expect(paraDataMensagem(Number.NaN)).toBeNull();
  });
});

describe("resumirPorNumero", () => {
  it("indexa cada mensagem pelo número de destino", () => {
    const resumo = resumirPorNumero([
      { numero: "5511999998888", status: "enviada", erro: null },
      { numero: "5511977776666", status: "falha", erro: "número inexistente" },
    ]);

    expect(resumo.get("5511999998888")).toEqual({
      status: "enviada",
      erro: null,
      quantidade: 1,
    });
    expect(resumo.get("5511977776666")?.erro).toBe("número inexistente");
  });

  // Número repetido na planilha é permitido, e aí o mesmo número tem várias mensagens.
  // Vence a mais grave: uma falha escondida atrás de um "enviada" é o pior resultado.
  it("mostra o status mais grave quando o número aparece mais de uma vez", () => {
    const resumo = resumirPorNumero([
      { numero: "5511999998888", status: "lida", erro: null },
      { numero: "5511999998888", status: "falha", erro: "bloqueado" },
      { numero: "5511999998888", status: "enviada", erro: null },
    ]);

    expect(resumo.get("5511999998888")).toEqual({
      status: "falha",
      erro: "bloqueado",
      quantidade: 3,
    });
  });

  it("prefere pendente a enviada, e enviada a entregue", () => {
    const resumo = resumirPorNumero([
      { numero: "1", status: "entregue", erro: null },
      { numero: "1", status: "pendente", erro: null },
      { numero: "2", status: "entregue", erro: null },
      { numero: "2", status: "enviada", erro: null },
    ]);

    expect(resumo.get("1")?.status).toBe("pendente");
    expect(resumo.get("2")?.status).toBe("enviada");
  });

  it("ignora mensagem sem número", () => {
    const resumo = resumirPorNumero([{ numero: "", status: "enviada", erro: null }]);

    expect(resumo.size).toBe(0);
  });
});
