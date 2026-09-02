import { screen } from "@testing-library/react";
import { renderComQuery } from "@/lib/test-utils";
import { PassoInstancia } from "./passo-instancia";
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

describe("PassoInstancia", () => {
  it("mostra nome, número com máscara e iniciais da instância", () => {
    renderComQuery(<PassoInstancia instanciaId="instancia-1" onSelecionar={jest.fn()} />);

    expect(screen.getAllByText("Atendimento").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+55 (11) 99999-8888").length).toBeGreaterThan(0);
    expect(screen.getAllByText("A").length).toBeGreaterThan(0);
  });

  it("avisa quando a instância não tem número identificado", () => {
    useInstanciasMock.mockReturnValue({
      data: { instancias: [instanciaFake({ numeroConectado: null })] },
      isLoading: false,
      isError: false,
    });

    renderComQuery(<PassoInstancia instanciaId="instancia-1" onSelecionar={jest.fn()} />);

    expect(screen.getAllByText(/número não identificado/i).length).toBeGreaterThan(0);
  });

  // Instância desconectada não dispara (o service recusa), então não pode nem aparecer.
  it("esconde instância que não está conectada", () => {
    useInstanciasMock.mockReturnValue({
      data: { instancias: [instanciaFake({ status: "disconnected" })] },
      isLoading: false,
      isError: false,
    });

    renderComQuery(<PassoInstancia instanciaId="" onSelecionar={jest.fn()} />);

    expect(screen.queryByText("Atendimento")).not.toBeInTheDocument();
    expect(screen.getByText(/nenhuma instância conectada/i)).toBeInTheDocument();
  });

  it("mostra erro quando a listagem falha", () => {
    useInstanciasMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    renderComQuery(<PassoInstancia instanciaId="" onSelecionar={jest.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/não foi possível carregar/i);
  });
});
