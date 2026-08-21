/**
 * @jest-environment node
 */
import { PATCH, DELETE } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { statusService } from "@/services/status.service";

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
jest.mock("@/services/status.service", () => {
  class StatusNaoEncontradoError extends Error {}
  class NomeStatusDuplicadoError extends Error {}
  class TipoStatusInvalidoError extends Error {}
  class StatusComCasosError extends Error {}
  class PermissaoNegadaError extends Error {}
  return {
    statusService: { atualizar: jest.fn(), excluir: jest.fn() },
    StatusNaoEncontradoError,
    NomeStatusDuplicadoError,
    TipoStatusInvalidoError,
    StatusComCasosError,
    PermissaoNegadaError,
  };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = statusService as jest.Mocked<typeof statusService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };
const params = Promise.resolve({ id: "status-1" });

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/status/status-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params }
  );
}

function del() {
  return DELETE(new Request("http://localhost/api/status/status-1", { method: "DELETE" }), {
    params,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("PATCH /api/status/[id]", () => {
  it("atualiza apenas os campos enviados", async () => {
    service.atualizar.mockResolvedValue({ id: "status-1" } as never);

    const response = await patch({ nome: "Renomeado" });

    expect(response.status).toBe(200);
    expect(service.atualizar).toHaveBeenCalledWith(ctx, "status-1", { nome: "Renomeado" });
  });

  it("responde 400 com detalhes quando o nome é vazio", async () => {
    const response = await patch({ nome: "" });

    expect(response.status).toBe(400);
    expect((await response.json()).detalhes.nome).toBeDefined();
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  // RN19: status de outro tenant responde 404, nunca 403 — não confirma que existe.
  it("responde 404 para status de outro escritório", async () => {
    const { StatusNaoEncontradoError } = jest.requireMock("@/services/status.service");
    service.atualizar.mockRejectedValue(new StatusNaoEncontradoError());

    const response = await patch({ nome: "Renomeado" });
    expect(response.status).toBe(404);
  });

  it("responde 409 em colisão de nome", async () => {
    const { NomeStatusDuplicadoError } = jest.requireMock("@/services/status.service");
    service.atualizar.mockRejectedValue(new NomeStatusDuplicadoError());

    const response = await patch({ nome: "Já Usado" });
    expect(response.status).toBe(409);
  });

  it("responde 403 quando o role não tem permissão de gestão", async () => {
    const { PermissaoNegadaError } = jest.requireMock("@/services/status.service");
    service.atualizar.mockRejectedValue(new PermissaoNegadaError());

    const response = await patch({ nome: "Renomeado" });
    expect(response.status).toBe(403);
  });

  it("responde 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await patch({ nome: "Renomeado" });
    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/status/[id]", () => {
  it("exclui o status e responde ok", async () => {
    service.excluir.mockResolvedValue(undefined);

    const response = await del();

    expect(response.status).toBe(200);
    expect(service.excluir).toHaveBeenCalledWith(ctx, "status-1");
  });

  it("responde 404 para status de outro escritório", async () => {
    const { StatusNaoEncontradoError } = jest.requireMock("@/services/status.service");
    service.excluir.mockRejectedValue(new StatusNaoEncontradoError());

    const response = await del();
    expect(response.status).toBe(404);
  });

  it("responde 409 quando o status tem casos vinculados", async () => {
    const { StatusComCasosError } = jest.requireMock("@/services/status.service");
    service.excluir.mockRejectedValue(new StatusComCasosError());

    const response = await del();
    expect(response.status).toBe(409);
  });

  it("responde 403 quando o role não tem permissão de gestão", async () => {
    const { PermissaoNegadaError } = jest.requireMock("@/services/status.service");
    service.excluir.mockRejectedValue(new PermissaoNegadaError());

    const response = await del();
    expect(response.status).toBe(403);
  });
});
