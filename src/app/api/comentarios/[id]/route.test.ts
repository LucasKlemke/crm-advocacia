/**
 * @jest-environment node
 */
import { DELETE, PATCH } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { comentarioService } from "@/services/comentario.service";

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
jest.mock("@/services/comentario.service", () => {
  class ComentarioNaoEncontradoError extends Error {}
  class PermissaoComentarioError extends Error {}
  class ConteudoVazioError extends Error {}
  return {
    comentarioService: { atualizar: jest.fn(), excluir: jest.fn() },
    ComentarioNaoEncontradoError,
    PermissaoComentarioError,
    ConteudoVazioError,
  };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = comentarioService as jest.Mocked<typeof comentarioService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };
const params = Promise.resolve({ id: "com-1" });

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/comentarios/com-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params }
  );
}

function del() {
  return DELETE(new Request("http://localhost/api/comentarios/com-1", { method: "DELETE" }), {
    params,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("PATCH /api/comentarios/[id]", () => {
  it("edita o conteúdo", async () => {
    service.atualizar.mockResolvedValue({ id: "com-1" } as never);

    const response = await patch({ conteudo: "Texto novo" });

    expect(response.status).toBe(200);
    expect(service.atualizar).toHaveBeenCalledWith(ctx, "com-1", "Texto novo");
  });

  it("recusa conteúdo vazio", async () => {
    const response = await patch({ conteudo: "  " });
    expect(response.status).toBe(400);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("responde 403 quando quem edita não é o autor", async () => {
    const { PermissaoComentarioError } = jest.requireMock("@/services/comentario.service");
    service.atualizar.mockRejectedValue(new PermissaoComentarioError());

    const response = await patch({ conteudo: "Texto novo" });
    expect(response.status).toBe(403);
  });

  it("responde 404 para comentário de outro escritório", async () => {
    const { ComentarioNaoEncontradoError } = jest.requireMock("@/services/comentario.service");
    service.atualizar.mockRejectedValue(new ComentarioNaoEncontradoError());

    const response = await patch({ conteudo: "Texto novo" });
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/comentarios/[id]", () => {
  it("exclui (soft) o comentário", async () => {
    service.excluir.mockResolvedValue(undefined);

    const response = await del();

    expect(response.status).toBe(200);
    expect(service.excluir).toHaveBeenCalledWith(ctx, "com-1");
  });

  it("responde 403 quando não há permissão de moderar", async () => {
    const { PermissaoComentarioError } = jest.requireMock("@/services/comentario.service");
    service.excluir.mockRejectedValue(new PermissaoComentarioError());

    const response = await del();
    expect(response.status).toBe(403);
  });

  it("responde 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await del();
    expect(response.status).toBe(401);
  });
});
