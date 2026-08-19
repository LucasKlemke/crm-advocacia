import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { ComentariosPanel } from "./comentarios-panel";
import type { ComentarioDTO } from "@/types/cliente";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

function comentarioFake(over: Partial<ComentarioDTO> = {}): ComentarioDTO {
  return {
    id: "com-1",
    conteudo: "Primeiro contato feito.",
    autorUsuarioId: "user-1",
    editadoEm: null,
    createdAt: "2026-08-01T12:00:00.000Z",
    autor: { id: "user-1", nome: "Ana Advogada", email: "ana@ex.com" },
    ...over,
  };
}

function respostaLista(comentarios: ComentarioDTO[]) {
  return { ok: true, status: 200, json: async () => ({ comentarios }) } as Response;
}

function renderPanel(props: { atorUsuarioId?: string; atorRole?: "owner" | "padrao" } = {}) {
  return renderComQuery(
    <ComentariosPanel
      clienteId="cli-1"
      atorUsuarioId={props.atorUsuarioId ?? "user-1"}
      atorRole={props.atorRole ?? "padrao"}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue(respostaLista([comentarioFake()]));
});

describe("ComentariosPanel", () => {
  it("mostra conteúdo, autor e data de cada comentário", async () => {
    renderPanel();

    expect(await screen.findByText("Primeiro contato feito.")).toBeInTheDocument();
    expect(screen.getByText("Ana Advogada")).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("marca comentários que foram editados", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaLista([comentarioFake({ editadoEm: "2026-08-02T12:00:00.000Z" })])
    );
    renderPanel();

    expect(await screen.findByText("(editado)")).toBeInTheDocument();
  });

  it("envia um novo comentário e limpa o campo", async () => {
    const usuario = userEvent.setup();
    renderPanel();
    await screen.findByText("Primeiro contato feito.");

    const campo = screen.getByRole("textbox", { name: "Novo comentário" });
    await usuario.type(campo, "Cliente retornou a ligação.");

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ comentario: comentarioFake({ id: "com-2" }) }),
    } as Response);
    await usuario.click(screen.getByRole("button", { name: "Comentar" }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/comentarios" && init?.method === "POST"
      );
      expect(JSON.parse(chamada[1].body)).toEqual({
        escopo: "cliente",
        escopoId: "cli-1",
        conteudo: "Cliente retornou a ligação.",
      });
    });
    await waitFor(() => expect(campo).toHaveValue(""));
  });

  it("mantém o botão Comentar desabilitado enquanto o campo está vazio", async () => {
    renderPanel();
    await screen.findByText("Primeiro contato feito.");

    expect(screen.getByRole("button", { name: "Comentar" })).toBeDisabled();
  });

  it("oferece o menu de ações ao autor do comentário", async () => {
    const usuario = userEvent.setup();
    renderPanel({ atorUsuarioId: "user-1" });
    await screen.findByText("Primeiro contato feito.");

    await usuario.click(
      screen.getByRole("button", { name: "Ações do comentário de Ana Advogada" })
    );

    expect(await screen.findByRole("menuitem", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toBeInTheDocument();
  });

  // Editar texto alheio é vedado; membro padrão também não modera.
  it("não oferece ações a um membro padrão sobre comentário de terceiro", async () => {
    renderPanel({ atorUsuarioId: "user-2", atorRole: "padrao" });
    await screen.findByText("Primeiro contato feito.");

    expect(
      screen.queryByRole("button", { name: "Ações do comentário de Ana Advogada" })
    ).not.toBeInTheDocument();
  });

  it("owner pode moderar comentário de terceiro, mas só com a opção Excluir", async () => {
    const usuario = userEvent.setup();
    renderPanel({ atorUsuarioId: "user-2", atorRole: "owner" });
    await screen.findByText("Primeiro contato feito.");

    await usuario.click(
      screen.getByRole("button", { name: "Ações do comentário de Ana Advogada" })
    );

    expect(await screen.findByRole("menuitem", { name: "Excluir" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("edita o próprio comentário via PATCH", async () => {
    const usuario = userEvent.setup();
    renderPanel();
    await screen.findByText("Primeiro contato feito.");

    await usuario.click(
      screen.getByRole("button", { name: "Ações do comentário de Ana Advogada" })
    );
    await usuario.click(await screen.findByRole("menuitem", { name: "Editar" }));

    const campo = screen.getByRole("textbox", { name: "Editar comentário" });
    await usuario.clear(campo);
    await usuario.type(campo, "Contato reagendado.");

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ comentario: comentarioFake({ conteudo: "Contato reagendado." }) }),
    } as Response);
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/comentarios/com-1" && init?.method === "PATCH"
      );
      expect(JSON.parse(chamada[1].body)).toEqual({ conteudo: "Contato reagendado." });
    });
  });

  it("mostra estado vazio quando o cliente ainda não tem comentários", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaLista([]));
    renderPanel();

    expect(await screen.findByText(/Nenhum comentário ainda/)).toBeInTheDocument();
  });
});
