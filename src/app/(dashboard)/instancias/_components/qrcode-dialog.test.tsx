import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { QrcodeDialog, type QrcodeDialogState } from "./qrcode-dialog";
import type { InstanciaWhatsappDTO } from "@/types/instancia-whatsapp";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const ESTADO: QrcodeDialogState = {
  instanciaId: "instancia-1",
  nome: "Atendimento",
  qrcode: "data:image/png;base64,abc123",
  paircode: "1234",
};

function instancia(status: InstanciaWhatsappDTO["status"]): InstanciaWhatsappDTO {
  return {
    id: "instancia-1",
    escritorioId: "esc-1",
    nome: "Atendimento",
    uazapiInstanceId: "uaz-1",
    status,
    numeroConectado: status === "connected" ? "5511999999999" : null,
    fotoPerfilUrl: null,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("QrcodeDialog", () => {
  it("não renderiza conteúdo quando o estado é nulo", () => {
    renderComQuery(<QrcodeDialog state={null} onOpenChange={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Verificar conexão" })).not.toBeInTheDocument();
  });

  it("mostra a imagem do QR code a partir do data URL", () => {
    renderComQuery(<QrcodeDialog state={ESTADO} onOpenChange={jest.fn()} />);

    const imagem = screen.getByRole("img", { name: /atendimento/i });
    expect(imagem).toHaveAttribute("src", "data:image/png;base64,abc123");
  });

  it("verifica a conexão e fecha o dialog quando o status vira connected", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ instancia: instancia("connected") }),
    } as unknown as Response);

    const usuario = userEvent.setup();
    const onOpenChange = jest.fn();
    renderComQuery(<QrcodeDialog state={ESTADO} onOpenChange={onOpenChange} />);

    await usuario.click(screen.getByRole("button", { name: "Verificar conexão" }));

    await waitFor(() => {
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe("/api/instancias/instancia-1/status");
    });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("mostra mensagem e mantém aberto quando ainda não conectou", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ instancia: instancia("connecting") }),
    } as unknown as Response);

    const usuario = userEvent.setup();
    const onOpenChange = jest.fn();
    renderComQuery(<QrcodeDialog state={ESTADO} onOpenChange={onOpenChange} />);

    await usuario.click(screen.getByRole("button", { name: "Verificar conexão" }));

    expect(
      await screen.findByText("Ainda não conectado. Escaneie o QR Code e tente novamente.")
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
