/**
 * @jest-environment node
 */
import { GET, PATCH, DELETE } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { casoService } from "@/services/caso.service";

jest.mock("@/lib/auth/tenant-context", () => {
  class NaoAutenticadoError extends Error {}
  class SemEscritorioAtivoError extends Error {}
  class AcessoNegadoError extends Error {}
  return {
    getTenantContext: jest.fn(),
    NaoAutenticadoError,
    SemEscritorioAtivoError,
    AcessoNegadoError,
  };
});
jest.mock("@/services/caso.service", () => {
  class CasoNaoEncontradoError extends Error {}
  class ClienteInativoError extends Error {}
  class ResponsavelInvalidoError extends Error {}
  return {
    casoService: { obter: jest.fn(), atualizar: jest.fn(), arquivar: jest.fn() },
    CasoNaoEncontradoError,
    ClienteInativoError,
    ResponsavelInvalidoError,
  };
});
jest.mock("@/services/cliente.service", () => {
  class ClienteNaoEncontradoError extends Error {}
  return { ClienteNaoEncontradoError };
});
jest.mock("@/services/status.service", () => {
  class StatusNaoEncontradoError extends Error {}
  return { StatusNaoEncontradoError };
});
jest.mock("@/services/usuario.service", () => ({
  usuarioService: { assinarUrlAvatar: jest.fn() },
}));

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = casoService as jest.Mocked<typeof casoService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };
const params = Promise.resolve({ id: "caso-1" });

function get() {
  return GET(new Request("http://localhost/api/casos/caso-1"), { params });
}

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/casos/caso-1", { method: "PATCH", body: JSON.stringify(body) }),
    { params }
  );
}

function del() {
  return DELETE(new Request("http://localhost/api/casos/caso-1", { method: "DELETE" }), { params });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/casos/[id]", () => {
  it("devolve o caso", async () => {
    service.obter.mockResolvedValue({ id: "caso-1" } as never);
    const response = await get();
    expect(response.status).toBe(200);
    expect(service.obter).toHaveBeenCalledWith(ctx, "caso-1");
  });

  it("responde 404 quando o caso não é do tenant", async () => {
    const { CasoNaoEncontradoError } = jest.requireMock("@/services/caso.service");
    service.obter.mockRejectedValue(new CasoNaoEncontradoError());
    const response = await get();
    expect(response.status).toBe(404);
  });

  it("não vaza o senhaHash do responsável e assina o avatar", async () => {
    const { usuarioService } = jest.requireMock("@/services/usuario.service");
    usuarioService.assinarUrlAvatar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");
    service.obter.mockResolvedValue({
      id: "caso-1",
      responsavel: {
        id: "membro-1",
        usuario: {
          id: "user-1",
          nome: "Fulano",
          email: "fulano@teste.com",
          senhaHash: "hash-nunca-deveria-sair",
          avatarUrl: "development/avatares/user-1/foto.png",
        },
      },
    } as never);

    const response = await get();
    const corpo = await response.json();

    expect(JSON.stringify(corpo)).not.toContain("hash-nunca-deveria-sair");
    expect(corpo.caso.responsavel.usuario.avatarUrl).toBe("https://bucket.s3.amazonaws.com/signed-get");
  });
});

describe("PATCH /api/casos/[id]", () => {
  it("atualiza o caso (inclusive troca de status via drag-and-drop)", async () => {
    service.atualizar.mockResolvedValue({ id: "caso-1" } as never);

    const response = await patch({ statusId: "22222222-2222-4222-8222-222222222222" });

    expect(response.status).toBe(200);
    expect(service.atualizar).toHaveBeenCalledWith(ctx, "caso-1", {
      statusId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("responde 400 para payload inválido", async () => {
    const response = await patch({ titulo: "" });
    expect(response.status).toBe(400);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("responde 400 quando o responsável é inválido", async () => {
    const { ResponsavelInvalidoError } = jest.requireMock("@/services/caso.service");
    service.atualizar.mockRejectedValue(new ResponsavelInvalidoError());

    const response = await patch({ responsavelMembroId: "33333333-3333-4333-8333-333333333333" });
    expect(response.status).toBe(400);
  });

  it("responde 404 quando o caso não é do tenant", async () => {
    const { CasoNaoEncontradoError } = jest.requireMock("@/services/caso.service");
    service.atualizar.mockRejectedValue(new CasoNaoEncontradoError());

    const response = await patch({ titulo: "Novo título" });
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/casos/[id]", () => {
  it("arquiva (soft) o caso em vez de excluir de fato", async () => {
    service.arquivar.mockResolvedValue({ id: "caso-1", arquivado: true } as never);

    const response = await del();

    expect(response.status).toBe(200);
    expect(service.arquivar).toHaveBeenCalledWith(ctx, "caso-1");
  });

  it("responde 404 quando o caso não é do tenant", async () => {
    const { CasoNaoEncontradoError } = jest.requireMock("@/services/caso.service");
    service.arquivar.mockRejectedValue(new CasoNaoEncontradoError());

    const response = await del();
    expect(response.status).toBe(404);
  });

  it("responde 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await del();
    expect(response.status).toBe(401);
  });
});
