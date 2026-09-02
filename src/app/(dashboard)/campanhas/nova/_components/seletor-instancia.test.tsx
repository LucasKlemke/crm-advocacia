import { screen } from "@testing-library/react";
import { renderComQuery } from "@/lib/test-utils";
import { SeletorInstancia } from "./seletor-instancia";
import type { InstanciaWhatsappDTO } from "@/types/instancia-whatsapp";

const useInstanciasMock = jest.fn();
jest.mock("@/hooks/use-instancias-whatsapp", () => ({
  useInstanciasWhatsapp: () => useInstanciasMock(),
}));

function instanciaFake(over: Partial<InstanciaWhatsappDTO> = {}): InstanciaWhatsappDTO {
  return {
    id: "instancia-1",
    escritorioId: "esc-1",
    nome: "Atendimento",
    uazapiInstanceId: "uazapi-1",
    status: "connected",
    numeroConectado: "5511999998888",
    fotoPerfilUrl: null,
    softDeletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useInstanciasMock.mockReturnValue({
    data: { instancias: [instanciaFake()] },
    isLoading: false,
    isError: false,
  });
});

describe("SeletorInstancia", () => {
  it("mostra nome, número com máscara e iniciais da instância", () => {
    renderComQuery(<SeletorInstancia instanciaId="instancia-1" onSelecionar={jest.fn()} />);

    expect(screen.getAllByText("Atendimento").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+55 (11) 99999-8888").length).toBeGreaterThan(0);
    expect(screen.getAllByText("A").length).toBeGreaterThan(0);
  });

  // Regressão: o conteúdo ficava dentro de um SelectValue, e o `line-clamp-1` que o
  // SelectTrigger aplica nesse slot virava `display:-webkit-box` e desmontava as duas linhas.
  it("mostra nome e número dentro do próprio gatilho do select", () => {
    renderComQuery(<SeletorInstancia instanciaId="instancia-1" onSelecionar={jest.fn()} />);

    const gatilho = screen.getByRole("combobox");
    expect(gatilho).toHaveTextContent("Atendimento");
    expect(gatilho).toHaveTextContent("+55 (11) 99999-8888");
    expect(gatilho.querySelector("[data-slot='select-value']")).toBeNull();
  });

  it("mostra o texto de escolha enquanto nenhuma instância está selecionada", () => {
    renderComQuery(<SeletorInstancia instanciaId="" onSelecionar={jest.fn()} />);

    expect(screen.getByRole("combobox")).toHaveTextContent(/selecionar conexão/i);
  });

  // Regressão: o `owner` da UAZAPI costuma vir sem o 9º dígito, e nesse caso o número
  // aparecia cru ("554797355799") no select.
  it("mascara também o número sem o nono dígito", () => {
    useInstanciasMock.mockReturnValue({
      data: { instancias: [instanciaFake({ numeroConectado: "554797355799" })] },
      isLoading: false,
      isError: false,
    });

    renderComQuery(<SeletorInstancia instanciaId="instancia-1" onSelecionar={jest.fn()} />);

    expect(screen.getAllByText("+55 (47) 9735-5799").length).toBeGreaterThan(0);
    expect(screen.queryByText("554797355799")).not.toBeInTheDocument();
  });

  it("avisa quando a instância não tem número identificado", () => {
    useInstanciasMock.mockReturnValue({
      data: { instancias: [instanciaFake({ numeroConectado: null })] },
      isLoading: false,
      isError: false,
    });

    renderComQuery(<SeletorInstancia instanciaId="instancia-1" onSelecionar={jest.fn()} />);

    expect(screen.getAllByText(/número não identificado/i).length).toBeGreaterThan(0);
  });

  // Instância desconectada não dispara (o service recusa), então não pode nem aparecer.
  it("esconde instância que não está conectada", () => {
    useInstanciasMock.mockReturnValue({
      data: { instancias: [instanciaFake({ status: "disconnected" })] },
      isLoading: false,
      isError: false,
    });

    renderComQuery(<SeletorInstancia instanciaId="" onSelecionar={jest.fn()} />);

    expect(screen.queryByText("Atendimento")).not.toBeInTheDocument();
    // Sem número conectado não há select: a pílula vira um atalho para conectar um.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /conectar um número/i })).toHaveAttribute(
      "href",
      "/instancias"
    );
  });

  it("mostra erro quando a listagem falha", () => {
    useInstanciasMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    renderComQuery(<SeletorInstancia instanciaId="" onSelecionar={jest.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/falha ao carregar/i);
  });
});
