/**
 * @jest-environment node
 */
import { DELETE } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import {
  conviteService,
  PermissaoNegadaError,
  ConviteNaoEncontradoError,
} from "@/services/convite.service";

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
jest.mock("@/services/convite.service", () => {
  const actual = jest.requireActual("@/services/convite.service");
  return { ...actual, conviteService: { cancelar: jest.fn() } };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const mockedService = conviteService as jest.Mocked<typeof conviteService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };
const params = Promise.resolve({ id: "convite-1" });

describe("DELETE /api/convites/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetTenantContext.mockResolvedValue(ctx);
  });

  it("retorna 404 quando o convite não existe ou é de outro escritório", async () => {
    mockedService.cancelar.mockRejectedValue(new ConviteNaoEncontradoError());

    const response = await DELETE(new Request("http://localhost"), { params });

    expect(response.status).toBe(404);
  });

  it("retorna 403 quando a permissão é negada", async () => {
    mockedService.cancelar.mockRejectedValue(new PermissaoNegadaError());

    const response = await DELETE(new Request("http://localhost"), { params });

    expect(response.status).toBe(403);
  });

  it("retorna 200 ao cancelar com sucesso", async () => {
    mockedService.cancelar.mockResolvedValue(undefined);

    const response = await DELETE(new Request("http://localhost"), { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockedService.cancelar).toHaveBeenCalledWith(ctx, "convite-1");
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedService.cancelar.mockRejectedValue(new Error("boom"));

    const response = await DELETE(new Request("http://localhost"), { params });

    expect(response.status).toBe(500);
  });
});
