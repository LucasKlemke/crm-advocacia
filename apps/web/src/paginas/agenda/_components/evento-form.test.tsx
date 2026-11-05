import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import userEvent from "@testing-library/user-event";
import { EventoForm } from "./evento-form";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const OPCOES = {
  clientes: [{ id: "cliente-1", nome: "Maria Souza", cpf: "12345678901" }],
  membros: [
    { id: "membro-1", nome: "Dr. Lucas", avatarUrl: null },
    { id: "membro-2", nome: "Ana Paralegal", avatarUrl: null },
  ],
  status: [],
  tipos: [],
  tiposProcesso: [],
};

function mockarFetch() {
  const criados: unknown[] = [];
  global.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const caminho = String(url);
    if (caminho.startsWith("/api/casos/filtros")) {
      return { ok: true, status: 200, json: async () => OPCOES } as Response;
    }
    if (caminho.startsWith("/api/casos")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ casos: [], total: 0, pagina: 1, porPagina: 20 }),
      } as Response;
    }
    if (caminho.startsWith("/api/clientes")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ clientes: OPCOES.clientes, total: 1, pagina: 1, porPagina: 20 }),
      } as Response;
    }
    if (caminho.startsWith("/api/eventos")) {
      criados.push(JSON.parse(String(init?.body)));
      return {
        ok: true,
        status: 201,
        json: async () => ({ evento: { id: "evento-1" } }),
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
  return criados;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("EventoForm", () => {
  it("cobra o título antes de enviar", async () => {
    mockarFetch();
    renderComQuery(<EventoForm onSucesso={jest.fn()} />);

    await userEvent.setup().click(screen.getByRole("button", { name: /criar evento/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/informe o título/i);
  });

  it("alterna local e link conforme a modalidade (RN32)", async () => {
    mockarFetch();
    const usuario = userEvent.setup();
    renderComQuery(<EventoForm onSucesso={jest.fn()} />);

    expect(screen.getByLabelText("Local")).toBeInTheDocument();
    expect(screen.queryByLabelText(/link da reunião/i)).not.toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Online" }));

    expect(await screen.findByLabelText(/link da reunião/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Local")).not.toBeInTheDocument();
  });

  it("exige o local no presencial (RN32)", async () => {
    mockarFetch();
    const usuario = userEvent.setup();
    renderComQuery(<EventoForm onSucesso={jest.fn()} />);

    await usuario.type(screen.getByLabelText("Título"), "Audiência");
    await usuario.click(screen.getByRole("button", { name: /criar evento/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/informe o local/i);
  });

  it("recusa fim anterior ao início (RN35)", async () => {
    mockarFetch();
    const usuario = userEvent.setup();
    renderComQuery(
      <EventoForm
        onSucesso={jest.fn()}
        inicioSugerido={new Date(2026, 8, 10, 14, 0)}
        fimSugerido={new Date(2026, 8, 10, 15, 0)}
      />
    );

    await usuario.type(screen.getByLabelText("Título"), "Audiência");
    await usuario.type(screen.getByLabelText("Local"), "Fórum");
    await usuario.clear(screen.getByLabelText("Fim"));
    await usuario.type(screen.getByLabelText("Fim"), "2026-09-10T13:00");
    await usuario.click(screen.getByRole("button", { name: /criar evento/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/depois do início/i);
  });

  it("envia o evento com hora local convertida para ISO e o campo da outra modalidade nulo", async () => {
    const criados = mockarFetch();
    const usuario = userEvent.setup();
    const onSucesso = jest.fn();
    renderComQuery(
      <EventoForm
        onSucesso={onSucesso}
        inicioSugerido={new Date(2026, 8, 10, 14, 0)}
        fimSugerido={new Date(2026, 8, 10, 15, 30)}
      />
    );

    await usuario.type(screen.getByLabelText("Título"), "Audiência de instrução");
    await usuario.type(screen.getByLabelText("Local"), "Fórum de Joinville");
    await usuario.click(screen.getByRole("button", { name: /criar evento/i }));

    await waitFor(() => expect(onSucesso).toHaveBeenCalled());

    const enviado = criados[0] as Record<string, unknown>;
    expect(enviado.titulo).toBe("Audiência de instrução");
    expect(enviado.local).toBe("Fórum de Joinville");
    expect(enviado.linkReuniao).toBeNull();
    expect(enviado.diaInteiro).toBe(false);
    // O <input datetime-local> é hora local; o payload precisa ser o mesmo instante em UTC.
    expect(new Date(enviado.inicio as string).getTime()).toBe(
      new Date(2026, 8, 10, 14, 0).getTime()
    );
  });

  it("envia o vínculo de cliente escolhido no seletor (RN31)", async () => {
    const criados = mockarFetch();
    const usuario = userEvent.setup();
    const onSucesso = jest.fn();
    renderComQuery(<EventoForm onSucesso={onSucesso} />);

    await usuario.type(screen.getByLabelText("Título"), "Reunião inicial");
    await usuario.type(screen.getByLabelText("Local"), "Escritório");

    await usuario.click(screen.getByRole("button", { name: /vínculo do evento/i }));
    await usuario.click(await screen.findByText("Maria Souza"));
    await usuario.click(screen.getByRole("button", { name: /criar evento/i }));

    await waitFor(() => expect(onSucesso).toHaveBeenCalled());

    const enviado = criados[0] as Record<string, unknown>;
    expect(enviado.clienteId).toBe("cliente-1");
    expect(enviado.casoId).toBeNull();
  });
});
