import { novaCampanhaSchema } from "./schemas-campanha";

function dadosValidos(over: Record<string, unknown> = {}) {
  return {
    nome: "Campanha",
    instanciaId: "3f1a0c62-9d4e-4b7a-8c1f-2e5d6a7b8c90",
    mensagemTemplate: "Olá {{nome}}",
    colunaNumero: "numero",
    mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: [] } },
    delayMin: 3,
    delayMax: 6,
    linhas: [{ Nome: "Ana", numero: "5547997355799" }],
    ...over,
  };
}

function emHoras(horas: number): string {
  return new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();
}

describe("novaCampanhaSchema — agendadaPara", () => {
  it("aceita campanha sem agendamento (envio imediato)", () => {
    expect(novaCampanhaSchema.safeParse(dadosValidos()).success).toBe(true);
  });

  it("aceita um instante no futuro", () => {
    expect(
      novaCampanhaSchema.safeParse(dadosValidos({ agendadaPara: emHoras(2) })).success
    ).toBe(true);
  });

  // A UAZAPI enfileira para envio imediato quando a data já passou, enquanto a linha local
  // seria gravada como "agendada": a tela anunciaria uma campanha que já está disparando.
  it("recusa um instante no passado", () => {
    const resultado = novaCampanhaSchema.safeParse(
      dadosValidos({ agendadaPara: emHoras(-2) })
    );

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].path).toEqual(["agendadaPara"]);
      expect(resultado.error.issues[0].message).toMatch(/futuro/i);
    }
  });

  // Tolerância para o tempo entre montar o payload no cliente e ele chegar na rota: sem
  // ela, agendar "para daqui a instantes" viraria erro de validação por alguns segundos.
  it("tolera o instante que acabou de passar", () => {
    const agoraMenosUmSegundo = new Date(Date.now() - 1000).toISOString();

    expect(
      novaCampanhaSchema.safeParse(dadosValidos({ agendadaPara: agoraMenosUmSegundo })).success
    ).toBe(true);
  });

  it("continua recusando data em formato inválido", () => {
    expect(
      novaCampanhaSchema.safeParse(dadosValidos({ agendadaPara: "01/03/2026" })).success
    ).toBe(false);
  });
});
