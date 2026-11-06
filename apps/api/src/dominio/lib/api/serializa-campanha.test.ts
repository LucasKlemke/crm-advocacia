import { serializarCampanha } from "./serializa-campanha";
import type { CampanhaComInstancia } from "@dominio/repositories/campanha.repository";

function campanha(over: Partial<CampanhaComInstancia> = {}): CampanhaComInstancia {
  return {
    id: "campanha-1",
    escritorioId: "esc-1",
    instanciaWhatsappId: "instancia-1",
    criadoPorId: "user-1",
    nome: "Campanha",
    mensagemTemplate: "Olá {{nome}}",
    mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: [] } },
    colunaNumero: "numero",
    arquivoCsvNome: null,
    delayMin: 3,
    delayMax: 6,
    agendadaPara: new Date("2026-02-01T12:00:00.000Z"),
    status: "enviando",
    uazapiFolderId: "folder-1",
    totalDestinatarios: 2,
    logTotal: 2,
    logSucesso: 1,
    logFalha: 0,
    logEntregue: 1,
    logLido: 0,
    logReproduzido: 0,
    sincronizadoEm: new Date("2026-02-01T12:05:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    instancia: {
      id: "instancia-1",
      nome: "Atendimento",
      status: "connected",
      softDeletedAt: new Date("2026-03-01T00:00:00.000Z"),
    },
    ...over,
  };
}

describe("serializarCampanha", () => {
  // A propriedade que importa: o evento de tempo real e a resposta HTTP são a mesma coisa.
  it("produz exatamente o JSON que a resposta HTTP da campanha produziria", () => {
    const entidade = campanha();

    expect(serializarCampanha(entidade)).toEqual(JSON.parse(JSON.stringify(entidade)));
  });

  it("mantém datas nulas e campanha sem instância como null", () => {
    const entidade = campanha({
      agendadaPara: null,
      sincronizadoEm: null,
      instanciaWhatsappId: null,
      instancia: null,
    });

    const dto = serializarCampanha(entidade);

    expect(dto.agendadaPara).toBeNull();
    expect(dto.sincronizadoEm).toBeNull();
    expect(dto.instancia).toBeNull();
    expect(dto).toEqual(JSON.parse(JSON.stringify(entidade)));
  });

  // Mesmo que algum chamador passe a instância inteira (com token), só id/nome/status/
  // softDeletedAt atravessam.
  it("nunca deixa o uazapiToken da instância escapar", () => {
    const entidade = campanha();
    const comToken = {
      ...entidade,
      instancia: { ...entidade.instancia, uazapiToken: "token-secreto" },
    } as CampanhaComInstancia;

    expect(JSON.stringify(serializarCampanha(comToken))).not.toContain("token-secreto");
  });
});
