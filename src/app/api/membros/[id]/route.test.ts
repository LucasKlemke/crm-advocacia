/**
 * @jest-environment node
 */
import { PATCH, DELETE } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import {
  membroService,
  PermissaoNegadaError,
  MembroNaoEncontradoError,
  UltimoOwnerError,
} from "@/services/membro.service";

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
jest.mock("@/services/membro.service", () => {
  const actual = jest.requireActual("@/services/membro.service");
  return { ...actual, membroService: { alterarRole: jest.fn(), remover: jest.fn() } };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const mockedService = membroService as jest.Mocked<typeof membroService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };
const params = Promise.resolve({ id: "membro-1" });

function buildPatchRequest(body: unknown) {
  return new Request("http://localhost/api/membros/membro-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/membros/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetTenantContext.mockResolvedValue(ctx);
  });

  it("retorna 400 para role inválido", async () => {
    const response = await PATCH(buildPatchRequest({ role: "invalido" }), { params });

    expect(response.status).toBe(400);
    expect(mockedService.alterarRole).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o membro não existe", async () => {
    mockedService.alterarRole.mockRejectedValue(new MembroNaoEncontradoError());

    const response = await PATCH(buildPatchRequest({ role: "admin" }), { params });

    expect(response.status).toBe(404);
  });

  it("retorna 403 quando a permissão é negada", async () => {
    mockedService.alterarRole.mockRejectedValue(new PermissaoNegadaError());

    const response = await PATCH(buildPatchRequest({ role: "admin" }), { params });

    expect(response.status).toBe(403);
  });

  it("retorna 409 ao violar o último owner", async () => {
    mockedService.alterarRole.mockRejectedValue(new UltimoOwnerError());

    const response = await PATCH(buildPatchRequest({ role: "admin" }), { params });

    expect(response.status).toBe(409);
  });

  it("retorna 200 com o membro atualizado", async () => {
    mockedService.alterarRole.mockResolvedValue({ id: "membro-1", role: "admin" } as never);

    const response = await PATCH(buildPatchRequest({ role: "admin" }), { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.membro.role).toBe("admin");
    expect(mockedService.alterarRole).toHaveBeenCalledWith(ctx, "membro-1", "admin");
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedService.alterarRole.mockRejectedValue(new Error("boom"));

    const response = await PATCH(buildPatchRequest({ role: "admin" }), { params });

    expect(response.status).toBe(500);
  });
});

describe("DELETE /api/membros/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetTenantContext.mockResolvedValue(ctx);
  });

  it("retorna 404 quando o membro não existe", async () => {
    mockedService.remover.mockRejectedValue(new MembroNaoEncontradoError());

    const response = await DELETE(new Request("http://localhost"), { params });

    expect(response.status).toBe(404);
  });

  it("retorna 409 ao tentar remover o último owner", async () => {
    mockedService.remover.mockRejectedValue(new UltimoOwnerError());

    const response = await DELETE(new Request("http://localhost"), { params });

    expect(response.status).toBe(409);
  });

  it("retorna 200 ao remover com sucesso", async () => {
    mockedService.remover.mockResolvedValue(undefined);

    const response = await DELETE(new Request("http://localhost"), { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedService.remover.mockRejectedValue(new Error("boom"));

    const response = await DELETE(new Request("http://localhost"), { params });

    expect(response.status).toBe(500);
  });
});
