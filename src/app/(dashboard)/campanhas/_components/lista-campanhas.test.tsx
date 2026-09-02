import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderComQuery } from "@/lib/test-utils";
import { ListaCampanhas } from "./lista-campanhas";
import type { CampanhaDTO } from "@/types/campanha";

const mutateControlar = jest.fn();
const mutateSincronizar = jest.fn();
const useCampanhasMock = jest.fn();

jest.mock("@/hooks/use-campanhas", () => ({
  useCampanhas: () => useCampanhasMock(),
  useSincronizarCampanha: () => ({
    mutateAsync: mutateSincronizar,
    isPending: false,
    variables: undefined,
  }),
  useControlarCampanha: () => ({
    mutateAsync: mutateControlar,
    isPending: false,
    variables: undefined,
  }),
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
    mapeamentoVariaveis: { nome: "Nome" },
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

beforeEach(() => {
  jest.clearAllMocks();
  useCampanhasMock.mockReturnValue({
    data: { campanhas: [campanhaFake()] },
    isLoading: false,
    isError: false,
  });
});

describe("ListaCampanhas", () => {
  it("mostra nome, instância e contadores da campanha", () => {
    renderComQuery(<ListaCampanhas somenteLeitura={false} />);

    expect(screen.getByRole("link", { name: "Retomada de contato" })).toBeInTheDocument();
    expect(screen.getByText(/Atendimento · 12 destinatário/)).toBeInTheDocument();
    expect(screen.getByText(/8 enviada\(s\) · 1 falha\(s\)/)).toBeInTheDocument();
  });

  it("oferece pausar para campanha em envio, e não retomar", () => {
    renderComQuery(<ListaCampanhas somenteLeitura={false} />);

    expect(screen.getByRole("button", { name: /pausar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retomar/i })).not.toBeInTheDocument();
  });

  it("oferece retomar para campanha pausada, e não pausar", () => {
    useCampanhasMock.mockReturnValue({
      data: { campanhas: [campanhaFake({ status: "pausada" })] },
      isLoading: false,
      isError: false,
    });

    renderComQuery(<ListaCampanhas somenteLeitura={false} />);

    expect(screen.getByRole("button", { name: /retomar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pausar/i })).not.toBeInTheDocument();
  });

  it("não oferece nenhuma das duas para campanha concluída", () => {
    useCampanhasMock.mockReturnValue({
      data: { campanhas: [campanhaFake({ status: "concluida" })] },
      isLoading: false,
      isError: false,
    });

    renderComQuery(<ListaCampanhas somenteLeitura={false} />);

    expect(screen.queryByRole("button", { name: /pausar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retomar/i })).not.toBeInTheDocument();
  });

  it("envia a ação stop ao pausar", async () => {
    mutateControlar.mockResolvedValue({ campanha: campanhaFake({ status: "pausada" }) });
    renderComQuery(<ListaCampanhas somenteLeitura={false} />);

    await userEvent.click(screen.getByRole("button", { name: /pausar/i }));

    await waitFor(() =>
      expect(mutateControlar).toHaveBeenCalledWith({ id: "campanha-1", acao: "stop" })
    );
  });

  it("sincroniza a campanha da linha", async () => {
    mutateSincronizar.mockResolvedValue({ campanha: campanhaFake() });
    renderComQuery(<ListaCampanhas somenteLeitura={false} />);

    await userEvent.click(screen.getByRole("button", { name: /sincronizar/i }));

    await waitFor(() => expect(mutateSincronizar).toHaveBeenCalledWith("campanha-1"));
  });

  // Excluir cancela mensagens que ainda não saíram: nunca sem confirmação.
  it("só exclui depois de confirmar no diálogo", async () => {
    mutateControlar.mockResolvedValue({ campanha: null });
    renderComQuery(<ListaCampanhas somenteLeitura={false} />);

    await userEvent.click(screen.getByRole("button", { name: /excluir retomada de contato/i }));
    expect(mutateControlar).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /excluir campanha/i }));

    await waitFor(() =>
      expect(mutateControlar).toHaveBeenCalledWith({ id: "campanha-1", acao: "delete" })
    );
  });

  it("esconde as ações de escrita para quem só tem leitura", () => {
    renderComQuery(<ListaCampanhas somenteLeitura />);

    expect(screen.queryByRole("link", { name: /nova campanha/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pausar/i })).not.toBeInTheDocument();
    // Sincronizar é leitura de estado: continua disponível.
    expect(screen.getByRole("button", { name: /sincronizar/i })).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há campanhas", () => {
    useCampanhasMock.mockReturnValue({
      data: { campanhas: [] },
      isLoading: false,
      isError: false,
    });

    renderComQuery(<ListaCampanhas somenteLeitura={false} />);

    expect(screen.getByText(/nenhuma campanha ainda/i)).toBeInTheDocument();
  });

  it("mostra erro quando a listagem falha", () => {
    useCampanhasMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    renderComQuery(<ListaCampanhas somenteLeitura={false} />);

    expect(screen.getByText(/não foi possível carregar as campanhas/i)).toBeInTheDocument();
  });
});
