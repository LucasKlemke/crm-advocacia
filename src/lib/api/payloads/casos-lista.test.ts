/**
 * @jest-environment node
 */
import { montarListaCasos, POR_PAGINA } from "./casos-lista";
import { casoService } from "@/services/caso.service";

jest.mock("@/services/caso.service", () => ({
  casoService: { listar: jest.fn() },
}));
jest.mock("@/lib/api/serializa-caso", () => ({
  serializarCasos: jest.fn(async (casos: unknown[]) =>
    casos.map((c) => ({ ...(c as object), serializado: true }))
  ),
}));

const service = casoService as jest.Mocked<typeof casoService>;
const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };

beforeEach(() => jest.clearAllMocks());

describe("montarListaCasos", () => {
  it("devolve os casos serializados com os metadados de paginação", async () => {
    service.listar.mockResolvedValue({ casos: [{ id: "caso-1" }], total: 1 } as never);

    const payload = await montarListaCasos(ctx, {}, 1);

    expect(payload).toEqual({
      casos: [{ id: "caso-1", serializado: true }],
      total: 1,
      pagina: 1,
      porPagina: POR_PAGINA,
    });
  });

  it("traduz a página em skip/take e repassa os filtros ao Service", async () => {
    service.listar.mockResolvedValue({ casos: [], total: 0 } as never);

    await montarListaCasos(ctx, { busca: "silva", arquivado: true }, 3);

    expect(service.listar).toHaveBeenCalledWith(ctx, {
      busca: "silva",
      arquivado: true,
      skip: 2 * POR_PAGINA,
      take: POR_PAGINA,
    });
  });
});
