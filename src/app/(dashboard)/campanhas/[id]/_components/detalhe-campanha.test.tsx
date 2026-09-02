import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderComQuery } from "@/lib/test-utils";
import { DetalheCampanha } from "./detalhe-campanha";
import type { CampanhaDTO, CampanhaItemDTO } from "@/types/campanha";

const mutateControlar = jest.fn();
const useCampanhaMock = jest.fn();

jest.mock("@/hooks/use-campanhas", () => ({
  useCampanha: (...args: unknown[]) => useCampanhaMock(...args),
  useControlarCampanha: () => ({ mutateAsync: mutateControlar, isPending: false }),
}));

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

function campanhaFake(over: Partial<CampanhaDTO> = {}): CampanhaDTO {
  return {
    id: "campanha-1",
    escritorioId: "esc-1",
    instanciaWhatsappId: "instancia-1",
    criadoPorId: "user-1",
    nome: "Retomada de contato",
    mensagemTemplate: "Olá {{nome}}",
    mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: ["primeiro_nome"] } },
    colunaNumero: "numero",
    arquivoCsvNome: "lista.csv",
    delayMin: 3,
    delayMax: 6,
    agendadaPara: null,
    status: "enviando",
    uazapiFolderId: "folder-1",
    totalDestinatarios: 12,
    logTotal: 12,
    logSucesso: 8,
    logFalha: 1,
    logEntregue: 7,
    logLido: 4,
    logReproduzido: 0,
    sincronizadoEm: null,
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-01T10:00:00.000Z",
    instancia: { id: "instancia-1", nome: "Atendimento", status: "connected" },
    ...over,
  };
}

const ITEM: CampanhaItemDTO = {
  id: "item-1",
  campanhaId: "campanha-1",
  linha: 1,
  numero: "5511999998888",
  mensagem: "Olá Ana",
  variaveis: { nome: "Ana Maria" },
  createdAt: "2026-02-01T10:00:00.000Z",
};

function mockCampanha(over: Partial<CampanhaDTO> = {}) {
  useCampanhaMock.mockReturnValue({
    data: { campanha: campanhaFake(over), itens: [ITEM], total: 1, porPagina: 20 },
    isLoading: false,
    isError: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCampanha();
});

describe("DetalheCampanha", () => {
  it("mostra nome, contadores e destinatários", () => {
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    expect(screen.getByRole("heading", { name: /retomada de contato/i })).toBeInTheDocument();
    expect(screen.getByText(/intervalo de 3s a 6s/i)).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Olá Ana" })).toBeInTheDocument();
  });

  it("descreve a coluna e os tratamentos de cada variável", () => {
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    expect(screen.getByText(/coluna "Nome" \(Só o primeiro nome\)/i)).toBeInTheDocument();
  });

  it("avisa quando a campanha não carrega", () => {
    useCampanhaMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    expect(screen.getByText(/não foi possível carregar a campanha/i)).toBeInTheDocument();
  });
});

// As mesmas ações da listagem, agora na tela onde o andamento é acompanhado.
describe("DetalheCampanha — pausar e retomar", () => {
  it("pausa a campanha em andamento", async () => {
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    await userEvent.click(screen.getByRole("button", { name: /pausar/i }));

    await waitFor(() =>
      expect(mutateControlar).toHaveBeenCalledWith({ id: "campanha-1", acao: "stop" })
    );
    expect(screen.queryByRole("button", { name: /retomar/i })).not.toBeInTheDocument();
  });

  it("retoma a campanha pausada", async () => {
    mockCampanha({ status: "pausada" });
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    await userEvent.click(screen.getByRole("button", { name: /retomar/i }));

    await waitFor(() =>
      expect(mutateControlar).toHaveBeenCalledWith({ id: "campanha-1", acao: "continue" })
    );
    expect(screen.queryByRole("button", { name: /pausar/i })).not.toBeInTheDocument();
  });

  it("não oferece nenhuma das duas numa campanha concluída", () => {
    mockCampanha({ status: "concluida" });
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    expect(screen.queryByRole("button", { name: /pausar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retomar/i })).not.toBeInTheDocument();
  });

  it("esconde as ações de quem só tem leitura", () => {
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura />);

    expect(screen.queryByRole("button", { name: /pausar/i })).not.toBeInTheDocument();
  });
});
