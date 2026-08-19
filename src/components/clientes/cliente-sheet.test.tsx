import type { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";
import { renderComQuery, screen } from "@/lib/test-utils";
import { ClienteSheet } from "./cliente-sheet";
import type { ClienteDTO } from "@/types/cliente";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const CLIENTE: ClienteDTO = {
  id: "cli-1",
  nome: "Maria Silva",
  cpf: "52998224725",
  email: "maria@ex.com",
  telefone: "5548999990000",
  endereco: null,
  softDeletedAt: null,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

function renderSheet(props: Partial<ComponentProps<typeof ClienteSheet>> = {}) {
  return renderComQuery(
    <ClienteSheet
      modo="ver"
      cliente={CLIENTE}
      aberto
      onOpenChange={jest.fn()}
      atorUsuarioId="user-1"
      atorRole="owner"
      {...props}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ comentarios: [] }),
  } as Response);
});

describe("ClienteSheet", () => {
  it("mostra os dados do cliente em modo leitura", async () => {
    renderSheet();

    expect(await screen.findByText("529.982.247-25")).toBeInTheDocument();
    expect(screen.getByText("maria@ex.com")).toBeInTheDocument();
  });

  it("mostra travessão nos campos opcionais em branco", async () => {
    renderSheet();
    await screen.findByText("529.982.247-25");

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it('"Editar dados" troca a leitura pelo formulário', async () => {
    const usuario = userEvent.setup();
    renderSheet();

    await usuario.click(await screen.findByRole("button", { name: "Editar dados" }));

    expect(screen.getByLabelText(/Nome completo/)).toHaveValue("Maria Silva");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
  });

  it("a aba Comentários carrega a timeline do cliente", async () => {
    const usuario = userEvent.setup();
    renderSheet();

    await usuario.click(await screen.findByRole("tab", { name: "Comentários" }));

    expect(await screen.findByRole("textbox", { name: "Novo comentário" })).toBeInTheDocument();
  });

  it("sinaliza visualmente um cliente excluído", async () => {
    renderSheet({ cliente: { ...CLIENTE, softDeletedAt: "2026-08-10T12:00:00.000Z" } });

    expect(await screen.findByText("Excluído")).toBeInTheDocument();
  });

  // No modo criar não há cliente ainda: comentários não teriam onde ser ancorados.
  it("no modo criar mostra só o formulário, sem abas", async () => {
    renderSheet({ modo: "criar", cliente: null });

    expect(await screen.findByRole("button", { name: "Criar cliente" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Comentários" })).not.toBeInTheDocument();
  });
});
