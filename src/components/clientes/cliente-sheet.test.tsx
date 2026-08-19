import type { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
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
      atorNome="Ana Titular"
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

  // Sem abas: os comentários ficam no cabeçalho e os dados logo abaixo, tudo à vista.
  it("mostra os comentários no cabeçalho, sem abas", async () => {
    renderSheet();

    expect(await screen.findByRole("textbox", { name: "Novo comentário" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("clicar em um dado abre aquele campo para edição", async () => {
    const usuario = userEvent.setup();
    renderSheet();

    await usuario.click(await screen.findByRole("button", { name: "Editar Nome completo" }));

    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria Silva");
  });

  it("sinaliza visualmente um cliente excluído", async () => {
    renderSheet({ cliente: { ...CLIENTE, softDeletedAt: "2026-08-10T12:00:00.000Z" } });

    expect(await screen.findByText("Excluído")).toBeInTheDocument();
  });

  // No modo criar não há cliente ainda: comentários não teriam onde ser ancorados,
  // e desativar um cadastro que não existe também não faz sentido.
  it("no modo criar mostra só o formulário", async () => {
    renderSheet({ modo: "criar", cliente: null });

    expect(await screen.findByRole("button", { name: "Criar cliente" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Novo comentário" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desativar cliente" })).not.toBeInTheDocument();
  });

  // A ação individual saiu da tabela: quem abre o cadastro é quem decide desativá-lo.
  it("desativa o cliente pelo próprio drawer", async () => {
    const usuario = userEvent.setup();
    const onOpenChange = jest.fn();
    renderSheet({ onOpenChange });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ desativados: 1, ignorados: 0 }),
    } as Response);
    await usuario.click(await screen.findByRole("button", { name: "Desativar cliente" }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url]) => url === "/api/clientes/lote"
      );
      expect(JSON.parse(chamada[1].body)).toEqual({ ids: ["cli-1"], acao: "desativar" });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("oferece restaurar quando o cliente está excluído", async () => {
    renderSheet({ cliente: { ...CLIENTE, softDeletedAt: "2026-08-10T12:00:00.000Z" } });

    expect(await screen.findByRole("button", { name: "Restaurar cliente" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desativar cliente" })).not.toBeInTheDocument();
  });
});
