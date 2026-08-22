import { tipoStatusService } from "./tipo-status.service";
import { tipoStatusRepository } from "@/repositories/tipo-status.repository";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { TipoStatus } from "@prisma/client";

jest.mock("@/repositories/tipo-status.repository");

const repo = tipoStatusRepository as jest.Mocked<typeof tipoStatusRepository>;

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

function tipoFake(over: Partial<TipoStatus> = {}): TipoStatus {
  return {
    id: "tipo-1",
    chave: "lead",
    nome: "Nova conversa",
    icone: "MessageCircle",
    cor: "#64748b",
    descricao: null,
    ordem: 1,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("tipoStatusService.listar", () => {
  it("delega ao repositório, sem exigir papel específico", async () => {
    repo.listar.mockResolvedValue([tipoFake()]);

    const tipos = await tipoStatusService.listar(ctx);

    expect(repo.listar).toHaveBeenCalledTimes(1);
    expect(tipos).toEqual([tipoFake()]);
  });
});
