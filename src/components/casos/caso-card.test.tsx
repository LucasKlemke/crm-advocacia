import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { CasoCard } from "./caso-card";
import type { CasoDTO } from "@/types/caso";

jest.mock("@/components/shared/avatar-iniciais", () => ({
  AvatarIniciais: ({ nome, avatarUrl }: { nome: string; avatarUrl?: string | null }) => (
    <div data-testid={`avatar-${nome}`} data-avatar-url={avatarUrl ?? ""} />
  ),
}));

function casoFake(over: Partial<CasoDTO> = {}): CasoDTO {
  return {
    id: "caso-1",
    escritorioId: "esc-1",
    clienteId: "cli-1",
    statusId: "status-1",
    responsavelMembroId: null,
    titulo: "Ação de cobrança",
    numeroProcesso: null,
    descricao: null,
    valor: "1500.00",
    arquivado: false,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-02T12:00:00.000Z",
    cliente: {
      id: "cli-1",
      nome: "Maria Silva",
      cpf: "52998224725",
      email: null,
      telefone: null,
      endereco: null,
      softDeletedAt: null,
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-01T12:00:00.000Z",
    },
    status: {
      id: "status-1",
      escritorioId: "esc-1",
      tipoStatusId: "tipo-1",
      nome: "Em análise",
      icone: "Search",
      cor: "#f59e0b",
      descricao: null,
      ordem: 1,
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-01T12:00:00.000Z",
    },
    responsavel: null,
    ...over,
  };
}

function renderCard(caso: CasoDTO, onClick = jest.fn()) {
  return render(
    <DndContext>
      <CasoCard caso={caso} onClick={onClick} />
    </DndContext>
  );
}

describe("CasoCard", () => {
  it("mostra título, cliente, valor e data de atualização", () => {
    renderCard(casoFake());

    expect(screen.getByText("Ação de cobrança")).toBeInTheDocument();
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.500,00")).toBeInTheDocument();
  });

  it("mostra o CPF do cliente formatado", () => {
    renderCard(casoFake());

    expect(screen.getByText("529.982.247-25")).toBeInTheDocument();
  });

  it("mostra o número do processo quando informado", () => {
    renderCard(casoFake({ numeroProcesso: "0001234-56.2026.8.24.0001" }));

    expect(screen.getByText("0001234-56.2026.8.24.0001")).toBeInTheDocument();
  });

  it("mostra 'Sem responsável' quando não há responsável", () => {
    renderCard(casoFake());

    expect(screen.getByText("Sem responsável")).toBeInTheDocument();
  });

  it("mostra o nome do responsável quando há um", () => {
    renderCard(
      casoFake({
        responsavelMembroId: "membro-1",
        responsavel: {
          id: "membro-1",
          usuario: { id: "user-1", nome: "Ana Advogada", email: "ana@ex.com", avatarUrl: null },
        },
      })
    );

    expect(screen.getByText("Ana Advogada")).toBeInTheDocument();
  });

  it("repassa o avatarUrl do responsável pro AvatarIniciais", () => {
    renderCard(
      casoFake({
        responsavelMembroId: "membro-1",
        responsavel: {
          id: "membro-1",
          usuario: {
            id: "user-1",
            nome: "Ana Advogada",
            email: "ana@ex.com",
            avatarUrl: "https://bucket.s3.amazonaws.com/signed-get",
          },
        },
      })
    );

    expect(screen.getByTestId("avatar-Ana Advogada")).toHaveAttribute(
      "data-avatar-url",
      "https://bucket.s3.amazonaws.com/signed-get"
    );
  });

  it("chama onClick ao clicar no card", () => {
    const onClick = jest.fn();
    renderCard(casoFake(), onClick);

    fireEvent.click(screen.getByRole("button", { name: "Abrir processo Ação de cobrança" }));

    expect(onClick).toHaveBeenCalled();
  });

  it("não mostra o valor quando ele é nulo", () => {
    renderCard(casoFake({ valor: null }));

    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });
});
