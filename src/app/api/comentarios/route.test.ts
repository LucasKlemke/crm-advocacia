/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
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
    comentarioService: { listar: jest.fn(), criar: jest.fn() },
    ComentarioNaoEncontradoError,
    PermissaoComentarioError,
    ConteudoVazioError,
  };
});
jest.mock("@/services/cliente.service", () => {
  class ClienteNaoEncontradoError extends Error {}
  class CpfInvalidoError extends Error {}
  class CpfDuplicadoError extends Error {}
  class TelefoneInvalidoError extends Error {}
  class EmailInvalidoError extends Error {}
  return {
    ClienteNaoEncontradoError,
    CpfInvalidoError,
    CpfDuplicadoError,
    TelefoneInvalidoError,
    EmailInvalidoError,
  };
});
jest.mock("@/services/usuario.service", () => ({
  usuarioService: { assinarUrlAvatar: jest.fn() },
}));

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = comentarioService as jest.Mocked<typeof comentarioService>;
const { usuarioService } = jest.requireMock("@/services/usuario.service");

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };
const CLIENTE_ID = "11111111-1111-4111-8111-111111111111";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/comentarios", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/comentarios", () => {
  it("lista os comentários do escopo pedido", async () => {
    service.listar.mockResolvedValue([]);

    const response = await GET(
      new Request(`http://localhost/api/comentarios?escopo=cliente&escopoId=${CLIENTE_ID}`)
    );

    expect(response.status).toBe(200);
    expect(service.listar).toHaveBeenCalledWith(ctx, "cliente", CLIENTE_ID);
  });

  it("assina o avatarUrl do autor de cada comentário", async () => {
    usuarioService.assinarUrlAvatar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");
    service.listar.mockResolvedValue([
      {
        id: "com-1",
        conteudo: "Olá",
        autor: { id: "user-1", nome: "Fulano", email: "fulano@teste.com", avatarUrl: "development/avatares/user-1/foto.png" },
      },
    ] as never);

    const response = await GET(
      new Request(`http://localhost/api/comentarios?escopo=cliente&escopoId=${CLIENTE_ID}`)
    );
    const corpo = await response.json();

    expect(usuarioService.assinarUrlAvatar).toHaveBeenCalledWith("development/avatares/user-1/foto.png");
    expect(corpo.comentarios[0].autor.avatarUrl).toBe("https://bucket.s3.amazonaws.com/signed-get");
  });

  it("recusa escopo desconhecido", async () => {
    const response = await GET(
      new Request(`http://localhost/api/comentarios?escopo=processo&escopoId=${CLIENTE_ID}`)
    );
    expect(response.status).toBe(400);
    expect(service.listar).not.toHaveBeenCalled();
  });

  it("recusa requisição sem escopoId", async () => {
    const response = await GET(new Request("http://localhost/api/comentarios?escopo=cliente"));
    expect(response.status).toBe(400);
  });

  // O alvo é validado pelo Service; a rota traduz para 404.
  it("responde 404 quando o cliente alvo não é do escritório", async () => {
    const { ClienteNaoEncontradoError } = jest.requireMock("@/services/cliente.service");
    service.listar.mockRejectedValue(new ClienteNaoEncontradoError());

    const response = await GET(
      new Request(`http://localhost/api/comentarios?escopo=cliente&escopoId=${CLIENTE_ID}`)
    );
    expect(response.status).toBe(404);
  });
});

describe("GET /api/comentarios — erros de comentário", () => {
  it("responde 404 quando o Service não encontra o comentário", async () => {
    const { ComentarioNaoEncontradoError } = jest.requireMock("@/services/comentario.service");
    service.listar.mockRejectedValue(new ComentarioNaoEncontradoError());

    const response = await GET(
      new Request(`http://localhost/api/comentarios?escopo=cliente&escopoId=${CLIENTE_ID}`)
    );
    expect(response.status).toBe(404);
  });
});

describe("POST /api/comentarios", () => {
  it("responde 400 quando o body não é JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/comentarios", { method: "POST", body: "nao-e-json" })
    );
    expect(response.status).toBe(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 404 quando o cliente alvo não é do escritório", async () => {
    const { ClienteNaoEncontradoError } = jest.requireMock("@/services/cliente.service");
    service.criar.mockRejectedValue(new ClienteNaoEncontradoError());

    const response = await post({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "oi" });
    expect(response.status).toBe(404);
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.criar.mockRejectedValue(new Error("connection reset by peer"));

    const response = await post({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "oi" });
    const corpo = await response.json();

    expect(response.status).toBe(500);
    expect(corpo.error).not.toMatch(/connection reset/);
  });

  it("cria o comentário e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "com-1" } as never);

    const response = await post({
      escopo: "cliente",
      escopoId: CLIENTE_ID,
      conteudo: "Primeiro contato feito.",
    });

    expect(response.status).toBe(201);
    expect(service.criar).toHaveBeenCalledWith(
      ctx,
      "cliente",
      CLIENTE_ID,
      "Primeiro contato feito."
    );
  });

  it("recusa comentário vazio", async () => {
    const response = await post({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "   " });
    expect(response.status).toBe(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await post({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "oi" });
    expect(response.status).toBe(401);
  });
});
