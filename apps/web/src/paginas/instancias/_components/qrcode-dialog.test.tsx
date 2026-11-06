import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { act, renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { chaveInstanciasWhatsapp } from "@/hooks/use-instancias-whatsapp";
import { QrcodeDialog, type QrcodeDialogState } from "./qrcode-dialog";
import type {
  InstanciaWhatsappDTO,
  ListaInstanciasWhatsapp,
} from "@crm/compartilhado/tipos/instancia-whatsapp";

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
    softDeletedAt: null,
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

  describe("tempo real: a lista de instâncias em cache é atualizada pelo WebSocket", () => {
    // O TanStack Query notifica os observers num setTimeout(0): espera a entrega para que
    // atualizações seguidas cheguem ao componente uma a uma, como chegam pelo WebSocket.
    async function definirLista(
      queryClient: ReturnType<typeof renderComQuery>["queryClient"],
      ...instancias: InstanciaWhatsappDTO[]
    ) {
      await act(async () => {
        queryClient.setQueryData<ListaInstanciasWhatsapp>(chaveInstanciasWhatsapp(), { instancias });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    it("fecha sozinho e avisa quando a instância em cache vira connected", async () => {
      global.fetch = jest.fn();
      const onOpenChange = jest.fn();
      const { queryClient } = renderComQuery(
        <QrcodeDialog state={ESTADO} onOpenChange={onOpenChange} />
      );
      await definirLista(queryClient, instancia("connecting"));
      expect(onOpenChange).not.toHaveBeenCalled();

      await definirLista(queryClient, instancia("connected"));

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(toast.success).toHaveBeenCalledWith("WhatsApp conectado.");
      // Só lê o cache: quem busca a lista é a tela; o diálogo não dispara requisição.
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("instância nova, ainda fora do cache, fecha quando aparece já conectada", async () => {
      const onOpenChange = jest.fn();
      const { queryClient } = renderComQuery(
        <QrcodeDialog state={ESTADO} onOpenChange={onOpenChange} />
      );

      await definirLista(queryClient, instancia("connected"));

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it("não fecha na abertura se o cache já dizia connected (estado antigo) nem por outra instância", async () => {
      const onOpenChange = jest.fn();
      const { queryClient, rerender } = renderComQuery(
        <QrcodeDialog state={null} onOpenChange={onOpenChange} />
      );
      await definirLista(queryClient, instancia("connected"));

      rerender(<QrcodeDialog state={ESTADO} onOpenChange={onOpenChange} />);
      await definirLista(queryClient, instancia("connected"), { ...instancia("connected"), id: "outra" });

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("estado antigo connected que passa por connecting e volta a connected fecha", async () => {
      const onOpenChange = jest.fn();
      const { queryClient, rerender } = renderComQuery(
        <QrcodeDialog state={null} onOpenChange={onOpenChange} />
      );
      await definirLista(queryClient, instancia("connected"));
      rerender(<QrcodeDialog state={ESTADO} onOpenChange={onOpenChange} />);
      expect(onOpenChange).not.toHaveBeenCalled();

      await definirLista(queryClient, instancia("connecting"));
      await definirLista(queryClient, instancia("connected"));

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });
  });
});
