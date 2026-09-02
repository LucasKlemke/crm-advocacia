import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { NovaInstanciaDialog } from "./nova-instancia-dialog";
import type { InstanciaWhatsappDTO } from "@/types/instancia-whatsapp";

const INSTANCIA: InstanciaWhatsappDTO = {
  id: "instancia-1",
  escritorioId: "esc-1",
  nome: "Atendimento",
  uazapiInstanceId: "uaz-1",
  status: "connecting",
  numeroConectado: null,
  fotoPerfilUrl: null,
  softDeletedAt: null,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({
      instancia: INSTANCIA,
      qrcode: "data:image/png;base64,abc123",
      paircode: "1234",
    }),
  } as unknown as Response);
});

describe("NovaInstanciaDialog", () => {
  it("não renderiza conteúdo quando fechado", () => {
    renderComQuery(
      <NovaInstanciaDialog open={false} onOpenChange={jest.fn()} onCriada={jest.fn()} />
    );

    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
  });

  it("exige o nome antes de enviar", async () => {
    const usuario = userEvent.setup();
    renderComQuery(
      <NovaInstanciaDialog open onOpenChange={jest.fn()} onCriada={jest.fn()} />
    );

    await usuario.click(screen.getByRole("button", { name: "Criar instância" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome da instância."
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("cria a instância e chama onCriada com o QR code retornado", async () => {
    const usuario = userEvent.setup();
    const onCriada = jest.fn();
    renderComQuery(
      <NovaInstanciaDialog open onOpenChange={jest.fn()} onCriada={onCriada} />
    );

    await usuario.type(screen.getByLabelText("Nome"), "Atendimento");
    await usuario.click(screen.getByRole("button", { name: "Criar instância" }));

    await waitFor(() => {
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe("/api/instancias");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({ nome: "Atendimento" });
    });

    await waitFor(() =>
      expect(onCriada).toHaveBeenCalledWith(
        {
          instancia: INSTANCIA,
          qrcode: "data:image/png;base64,abc123",
          paircode: "1234",
        },
        "Atendimento"
      )
    );
  });

  it("mostra a mensagem do servidor quando o nome já existe", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: "Já existe uma instância de WhatsApp com este nome neste escritório.",
      }),
    } as unknown as Response);

    const usuario = userEvent.setup();
    renderComQuery(
      <NovaInstanciaDialog open onOpenChange={jest.fn()} onCriada={jest.fn()} />
    );

    await usuario.type(screen.getByLabelText("Nome"), "Atendimento");
    await usuario.click(screen.getByRole("button", { name: "Criar instância" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe uma instância de WhatsApp com este nome neste escritório."
    );
  });
});
