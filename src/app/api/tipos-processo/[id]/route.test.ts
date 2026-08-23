/**
 * @jest-environment node
 */
import { PATCH, DELETE } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tipoProcessoService } from "@/services/tipo-processo.service";

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
jest.mock("@/services/tipo-processo.service", () => {
  class TipoProcessoNaoEncontradoError extends Error {}
  class NomeTipoProcessoDuplicadoError extends Error {}
  class TipoProcessoComCasosError extends Error {}
  class PermissaoNegadaError extends Error {}
  return {
    tipoProcessoService: { atualizar: jest.fn(), excluir: jest.fn() },
    TipoProcessoNaoEncontradoError,
    NomeTipoProcessoDuplicadoError,
    TipoProcessoComCasosError,
    PermissaoNegadaError,
  };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = tipoProcessoService as jest.Mocked<typeof tipoProcessoService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };
const params = Promise.resolve({ id: "tipo-processo-1" });

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/tipos-processo/tipo-processo-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params }
  );
}

function del() {
  return DELETE(
    new Request("http://localhost/api/tipos-processo/tipo-processo-1", { method: "DELETE" }),
    { params }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("PATCH /api/tipos-processo/[id]", () => {
  it("atualiza e responde 200", async () => {
    service.atualizar.mockResolvedValue({ id: "tipo-processo-1" } as never);

    const response = await patch({ nome: "Revisional" });

    expect(response.status).toBe(200);
    expect(service.atualizar).toHaveBeenCalledWith(ctx, "tipo-processo-1", { nome: "Revisional" });
  });

  it("responde 400 para payload inválido", async () => {
    expect((await patch({ icone: "IconeInventado" })).status).toBe(400);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("responde 404 para tipo de outro escritório", async () => {
    const { TipoProcessoNaoEncontradoError } = jest.requireMock(
      "@/services/tipo-processo.service"
    );
    service.atualizar.mockRejectedValue(new TipoProcessoNaoEncontradoError());

    expect((await patch({ nome: "X" })).status).toBe(404);
  });
});

describe("DELETE /api/tipos-processo/[id]", () => {
  it("exclui e responde 200", async () => {
    service.excluir.mockResolvedValue(undefined);

    const response = await del();

    expect(response.status).toBe(200);
    expect(service.excluir).toHaveBeenCalledWith(ctx, "tipo-processo-1");
  });

  it("responde 409 quando o tipo tem processos vinculados", async () => {
    const { TipoProcessoComCasosError } = jest.requireMock("@/services/tipo-processo.service");
    service.excluir.mockRejectedValue(new TipoProcessoComCasosError());

    expect((await del()).status).toBe(409);
  });

  it("responde 403 para papel sem permissão", async () => {
    const { PermissaoNegadaError } = jest.requireMock("@/services/tipo-processo.service");
    service.excluir.mockRejectedValue(new PermissaoNegadaError());

    expect((await del()).status).toBe(403);
  });
});
