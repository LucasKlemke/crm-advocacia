import { renderComQuery, screen } from "@/lib/test-utils";
import userEvent from "@testing-library/user-event";
import { EventoSheet } from "./evento-sheet";
import type { EventoDTO } from "@/types/evento";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const EVENTO: EventoDTO = {
  id: "evento-1",
  escritorioId: "esc-1",
  titulo: "Audiência de instrução",
  descricao: "Levar procuração.",
  inicio: new Date(2026, 8, 10, 14, 0).toISOString(),
  fim: new Date(2026, 8, 10, 15, 30).toISOString(),
  diaInteiro: false,
  modalidade: "presencial",
  local: "Fórum de Joinville, sala 3",
  linkReuniao: null,
  clienteId: null,
  casoId: null,
  criadoPorMembroId: "membro-1",
  createdAt: new Date(2026, 8, 1, 9, 0).toISOString(),
  updatedAt: new Date(2026, 8, 1, 9, 0).toISOString(),
  cliente: null,
  caso: null,
  criadoPor: {
    membroId: "membro-1",
    usuario: { id: "u1", nome: "Dr. Lucas", email: "lucas@teste.com", avatarUrl: null },
  },
  participantes: [
    {
      membroId: "membro-1",
      usuario: { id: "u1", nome: "Dr. Lucas", email: "lucas@teste.com", avatarUrl: null },
    },
    {
      membroId: "membro-2",
      usuario: { id: "u2", nome: "Ana Paralegal", email: "ana@teste.com", avatarUrl: null },
    },
  ],
  podeEditar: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  })) as unknown as typeof fetch;
});

describe("EventoSheet", () => {
  it("mostra horário, local, participantes, notas e quem criou", () => {
    renderComQuery(
      <EventoSheet modo="ver" evento={EVENTO} aberto onOpenChange={jest.fn()} />
    );

    expect(screen.getByText("Audiência de instrução")).toBeInTheDocument();
    expect(screen.getByText("Fórum de Joinville, sala 3")).toBeInTheDocument();
    expect(screen.getByText("Ana Paralegal")).toBeInTheDocument();
    expect(screen.getByText("Levar procuração.")).toBeInTheDocument();
    expect(screen.getByText(/criado por dr\. lucas/i)).toBeInTheDocument();
    expect(screen.getByText("Organizador")).toBeInTheDocument();
  });

  it("mostra o link da reunião quando o evento é online", () => {
    renderComQuery(
      <EventoSheet
        modo="ver"
        evento={{
          ...EVENTO,
          modalidade: "online",
          local: null,
          linkReuniao: "https://meet.example.com/abc",
        }}
        aberto
        onOpenChange={jest.fn()}
      />
    );

    expect(screen.getByRole("link", { name: /entrar na reunião/i })).toHaveAttribute(
      "href",
      "https://meet.example.com/abc"
    );
  });

  it("oferece editar e excluir para quem tem permissão (RN34)", () => {
    renderComQuery(
      <EventoSheet modo="ver" evento={EVENTO} aberto onOpenChange={jest.fn()} />
    );

    expect(screen.getByRole("button", { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /excluir/i })).toBeInTheDocument();
  });

  it("esconde as ações e explica a regra para quem não pode editar (RN34)", () => {
    renderComQuery(
      <EventoSheet
        modo="ver"
        evento={{ ...EVENTO, podeEditar: false }}
        aberto
        onOpenChange={jest.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /excluir/i })).not.toBeInTheDocument();
    expect(screen.getByText(/só quem criou o evento/i)).toBeInTheDocument();
  });

  it("pede confirmação antes de excluir", async () => {
    renderComQuery(
      <EventoSheet modo="ver" evento={EVENTO} aberto onOpenChange={jest.fn()} />
    );

    await userEvent.setup().click(screen.getByRole("button", { name: /excluir/i }));

    expect(await screen.findByText(/excluir este evento\?/i)).toBeInTheDocument();
  });
});
