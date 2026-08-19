/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { clienteService } from "@/services/cliente.service";

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
jest.mock("@/services/cliente.service", () => {
  class ClienteNaoEncontradoError extends Error {}
  class CpfInvalidoError extends Error {}
  class CpfDuplicadoError extends Error {}
  class TelefoneInvalidoError extends Error {}
  class EmailInvalidoError extends Error {}
  return {
    clienteService: { listar: jest.fn(), criar: jest.fn() },
    ClienteNaoEncontradoError,
    CpfInvalidoError,
    CpfDuplicadoError,
    TelefoneInvalidoError,
    EmailInvalidoError,
  };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = clienteService as jest.Mocked<typeof clienteService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };
const CPF = "529.982.247-25";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/clientes", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/clientes", () => {
  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await GET(new Request("http://localhost/api/clientes"));
    expect(response.status).toBe(401);
  });

  it("retorna 409 sem escritório ativo", async () => {
    const { SemEscritorioAtivoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new SemEscritorioAtivoError());

    const response = await GET(new Request("http://localhost/api/clientes"));
    expect(response.status).toBe(409);
  });

  it("repassa busca e paginação ao Service", async () => {
    service.listar.mockResolvedValue({ clientes: [], total: 0 });

    const response = await GET(
      new Request("http://localhost/api/clientes?busca=maria&pagina=3&incluirExcluidos=true")
    );

    expect(response.status).toBe(200);
    expect(service.listar).toHaveBeenCalledWith(ctx, {
      busca: "maria",
      incluirExcluidos: true,
      skip: 40,
      take: 20,
    });
  });

  // Página inválida vinda da URL não pode virar skip negativo no banco.
  it("normaliza página inválida para a primeira", async () => {
    service.listar.mockResolvedValue({ clientes: [], total: 0 });

    await GET(new Request("http://localhost/api/clientes?pagina=-5"));

    expect(service.listar).toHaveBeenCalledWith(ctx, expect.objectContaining({ skip: 0 }));
  });
});

describe("POST /api/clientes", () => {
  it("cria o cliente e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "cli-1" } as never);

    const response = await post({ nome: "Maria Silva", cpf: CPF });

    expect(response.status).toBe(201);
    expect(service.criar).toHaveBeenCalledWith(ctx, expect.objectContaining({ nome: "Maria Silva" }));
  });

  it("retorna 400 com detalhes de campo quando o payload é inválido", async () => {
    const response = await post({ nome: "Ma", cpf: CPF });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.detalhes.nome).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  // A validação de forma acontece no zod para que o erro volte por campo e o
  // formulário destaque o input certo, em vez de um toast genérico.
  it("retorna 400 com detalhes quando o CPF não passa nos dígitos verificadores", async () => {
    const response = await post({ nome: "Maria Silva", cpf: "083688379" });

    expect(response.status).toBe(400);
    expect((await response.json()).detalhes.cpf).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("retorna 400 com detalhes quando o telefone está incompleto", async () => {
    const response = await post({ nome: "Maria Silva", cpf: CPF, telefone: "47996589979" });

    expect(response.status).toBe(400);
    expect((await response.json()).detalhes.telefone).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("retorna 400 com detalhes quando o e-mail é malformado", async () => {
    const response = await post({ nome: "Maria Silva", cpf: CPF, email: "lucasklemketeste" });

    expect(response.status).toBe(400);
    expect((await response.json()).detalhes.email).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("aceita telefone e e-mail válidos", async () => {
    service.criar.mockResolvedValue({ id: "cli-1" } as never);

    const response = await post({
      nome: "Maria Silva",
      cpf: CPF,
      telefone: "+55 (47) 99658-9979",
      email: "lucas.klemke84@gmail.com",
    });

    expect(response.status).toBe(201);
  });

  it("retorna 400 quando o body não é JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/clientes", { method: "POST", body: "nao-e-json" })
    );
    expect(response.status).toBe(400);
  });

  it("retorna 409 quando o CPF já existe no escritório", async () => {
    const { CpfDuplicadoError } = jest.requireMock("@/services/cliente.service");
    service.criar.mockRejectedValue(new CpfDuplicadoError("duplicado"));

    const response = await post({ nome: "Maria Silva", cpf: CPF });
    expect(response.status).toBe(409);
  });

  it("retorna 400 quando o CPF é inválido", async () => {
    const { CpfInvalidoError } = jest.requireMock("@/services/cliente.service");
    service.criar.mockRejectedValue(new CpfInvalidoError("invalido"));

    const response = await post({ nome: "Maria Silva", cpf: CPF });
    expect(response.status).toBe(400);
  });

  it("retorna 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.criar.mockRejectedValue(new Error("connection reset by peer"));

    const response = await post({ nome: "Maria Silva", cpf: CPF });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).not.toMatch(/connection reset/);
  });
});
