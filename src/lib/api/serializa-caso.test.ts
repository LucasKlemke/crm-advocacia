/**
 * @jest-environment node
 */
import { serializarCaso, serializarCasos } from "./serializa-caso";
import { usuarioService } from "@/services/usuario.service";
import type { CasoComRelacoes } from "@/repositories/caso.repository";

jest.mock("@/services/usuario.service", () => ({
  usuarioService: { assinarUrlAvatar: jest.fn() },
}));

const mockedAssinar = usuarioService.assinarUrlAvatar as jest.Mock;

function casoComResponsavel(): CasoComRelacoes {
  return {
    id: "caso-1",
    escritorioId: "esc-1",
    clienteId: "cli-1",
    statusId: "status-1",
    responsavelMembroId: "membro-1",
    titulo: "Ação de cobrança",
    numeroProcesso: null,
    descricao: null,
    valor: null,
    arquivado: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    cliente: { id: "cli-1", nome: "Fulano", cpf: "12345678901" },
    status: { id: "status-1", nome: "Em análise", cor: "#000000" },
    responsavel: {
      id: "membro-1",
      usuario: {
        id: "user-1",
        nome: "Advogado Um",
        email: "advogado@teste.com",
        senhaHash: "hash-secreto-nunca-deveria-sair-daqui",
        avatarUrl: "development/avatares/user-1/foto.png",
      },
    },
  } as unknown as CasoComRelacoes;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedAssinar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get-avatar");
});

describe("serializarCaso", () => {
  it("nunca inclui o senhaHash do responsável", async () => {
    const dto = await serializarCaso(casoComResponsavel());

    expect(dto.responsavel).not.toHaveProperty("usuario.senhaHash");
    expect(JSON.stringify(dto)).not.toContain("hash-secreto-nunca-deveria-sair-daqui");
  });

  it("assina o avatarUrl do responsável", async () => {
    const dto = await serializarCaso(casoComResponsavel());

    expect(mockedAssinar).toHaveBeenCalledWith("development/avatares/user-1/foto.png");
    expect(dto.responsavel?.usuario.avatarUrl).toBe("https://bucket.s3.amazonaws.com/signed-get-avatar");
  });

  it("mantém os outros campos do caso intactos", async () => {
    const dto = await serializarCaso(casoComResponsavel());

    expect(dto.id).toBe("caso-1");
    expect(dto.titulo).toBe("Ação de cobrança");
    expect(dto.cliente).toEqual({ id: "cli-1", nome: "Fulano", cpf: "12345678901" });
    expect(dto.status).toEqual({ id: "status-1", nome: "Em análise", cor: "#000000" });
  });

  it("não chama o serviço de avatar quando não há responsável", async () => {
    const caso = { ...casoComResponsavel(), responsavel: null, responsavelMembroId: null };

    const dto = await serializarCaso(caso);

    expect(dto.responsavel).toBeNull();
    expect(mockedAssinar).not.toHaveBeenCalled();
  });
});

describe("serializarCasos", () => {
  it("serializa uma lista preservando a ordem", async () => {
    const casoA = { ...casoComResponsavel(), id: "caso-a" };
    const casoB = { ...casoComResponsavel(), id: "caso-b", responsavel: null };

    const dtos = await serializarCasos([casoA, casoB]);

    expect(dtos.map((c) => c.id)).toEqual(["caso-a", "caso-b"]);
  });
});
