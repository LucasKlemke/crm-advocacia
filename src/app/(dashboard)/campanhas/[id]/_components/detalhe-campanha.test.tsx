import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderComQuery } from "@/lib/test-utils";
import { DetalheCampanha } from "./detalhe-campanha";
import type { CampanhaDTO, CampanhaItemDTO, MensagemCampanhaDTO } from "@/types/campanha";

const mutateControlar = jest.fn();
const useCampanhaMock = jest.fn();
const useMensagensMock = jest.fn();

jest.mock("@/hooks/use-campanhas", () => ({
  useCampanha: (...args: unknown[]) => useCampanhaMock(...args),
  useMensagensCampanha: (...args: unknown[]) => useMensagensMock(...args),
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

function mockMensagens(
  mensagens: MensagemCampanhaDTO[] = [],
  estado: { isLoading?: boolean; isFetching?: boolean; isError?: boolean } = {}
) {
  useMensagensMock.mockReturnValue({
    data: estado.isError ? undefined : { mensagens, total: mensagens.length },
    isLoading: estado.isLoading ?? false,
    isFetching: estado.isFetching ?? false,
    isError: estado.isError ?? false,
  });
}

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
  mockMensagens();
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

// O status de cada mensagem vem da UAZAPI e é casado com o item do banco pelo número.
describe("DetalheCampanha — status de cada mensagem", () => {
  it("consulta a UAZAPI só depois que o banco respondeu", () => {
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    expect(useMensagensMock).toHaveBeenCalledWith("campanha-1", true);
  });

  it("não consulta enquanto o detalhe não carregou", () => {
    useCampanhaMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    expect(useMensagensMock).toHaveBeenCalledWith("campanha-1", false);
  });

  it("mostra o status da mensagem na linha do destinatário", () => {
    mockMensagens([
      { numero: "5511999998888", status: "enviada", erro: null, enviadaEm: null },
    ]);
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    expect(screen.getByText("Enviada")).toBeInTheDocument();
  });

  it("mostra o motivo da falha embaixo do status", () => {
    mockMensagens([
      { numero: "5511999998888", status: "falha", erro: "número inexistente", enviadaEm: null },
    ]);
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    expect(screen.getByText("Falha")).toBeInTheDocument();
    expect(screen.getByText("número inexistente")).toBeInTheDocument();
  });

  // Número que a UAZAPI não devolveu não pode virar "pendente" — seria inventar estado.
  it("deixa em branco o destinatário sem mensagem correspondente", () => {
    mockMensagens([{ numero: "5511911112222", status: "lida", erro: null, enviadaEm: null }]);
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Lida")).not.toBeInTheDocument();
  });

  it("avisa enquanto está consultando", () => {
    mockMensagens([], { isLoading: true, isFetching: true });
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    expect(screen.getByText(/consultando o status de cada mensagem/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Buscando status")).toBeInTheDocument();
  });

  // A tabela do banco continua na tela: a UAZAPI é enriquecimento, não requisito.
  it("mantém a tabela quando a consulta à UAZAPI falha", () => {
    mockMensagens([], { isError: true });
    renderComQuery(<DetalheCampanha campanhaId="campanha-1" somenteLeitura={false} />);

    expect(screen.getByText(/não foi possível consultar o status das mensagens/i)).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Olá Ana" })).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
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
