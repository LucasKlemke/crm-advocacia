import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { ListaInstancias } from "./lista-instancias";
import type { InstanciaWhatsappDTO } from "@/types/instancia-whatsapp";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

// O componente base (base-ui) só troca pro <img> depois que um `new window.Image()`
// real dispara `onload` — em jsdom isso nunca acontece sozinho (não há rede), então
// simulamos o carregamento pra poder testar o estado "com fotoPerfilUrl" (mesmo padrão
// de avatar-iniciais.test.tsx).
class ImagemFake {
  onload: (() => void) | null = null;
  set src(_valor: string) {
    this.onload?.();
  }
}
const OriginalImage = global.Image;
beforeAll(() => {
  // @ts-expect-error stub simplificado só com o necessário pro loading status
  global.Image = ImagemFake;
});
afterAll(() => {
  global.Image = OriginalImage;
});

const CONECTADA: InstanciaWhatsappDTO = {
  id: "instancia-1",
  escritorioId: "esc-1",
  nome: "Atendimento principal",
  uazapiInstanceId: "uaz-1",
  status: "connected",
  numeroConectado: "5511999999999",
  fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

const DESCONECTADA: InstanciaWhatsappDTO = {
  id: "instancia-2",
  escritorioId: "esc-1",
  nome: "Financeiro",
  uazapiInstanceId: "uaz-2",
  status: "disconnected",
  numeroConectado: null,
  fotoPerfilUrl: null,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

function mockFetch(instancias: InstanciaWhatsappDTO[] = []): typeof fetch {
  return jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/instancias" && (!init || init.method === undefined)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ instancias }),
      } as Response);
    }
    if (url.endsWith("/reconectar")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          instancia: { ...DESCONECTADA, status: "connecting" },
          qrcode: "data:image/png;base64,novo-qr",
          paircode: "5678",
        }),
      } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch();
});

describe("ListaInstancias", () => {
  it("mostra o estado vazio quando não há instâncias", async () => {
    renderComQuery(<ListaInstancias somenteLeitura={false} />);

    expect(
      await screen.findByText("Nenhuma instância de WhatsApp cadastrada ainda.")
    ).toBeInTheDocument();
  });

  it("lista nome, badge de status e número conectado (formatado) de cada instância", async () => {
    global.fetch = mockFetch([CONECTADA]);
    renderComQuery(<ListaInstancias somenteLeitura={false} />);

    expect(await screen.findByText("Atendimento principal")).toBeInTheDocument();
    expect(screen.getByText("Conectado")).toBeInTheDocument();
    expect(screen.getByText("+55 (11) 99999-9999")).toBeInTheDocument();
  });

  it("mostra a foto de perfil quando fotoPerfilUrl está presente", async () => {
    global.fetch = mockFetch([CONECTADA]);
    renderComQuery(<ListaInstancias somenteLeitura={false} />);

    await screen.findByText("Atendimento principal");
    await waitFor(() => {
      const imagem = document.querySelector('[data-slot="avatar-image"]');
      expect(imagem).toHaveAttribute("src", "https://pps.whatsapp.net/foto.jpg");
    });
  });

  it("cai pras iniciais quando fotoPerfilUrl é null", async () => {
    global.fetch = mockFetch([DESCONECTADA]);
    renderComQuery(<ListaInstancias somenteLeitura={false} />);

    await screen.findByText("Financeiro");
    expect(document.querySelector('[data-slot="avatar-image"]')).not.toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
  });

  it("mostra travessão quando numeroConectado é null", async () => {
    global.fetch = mockFetch([DESCONECTADA]);
    renderComQuery(<ListaInstancias somenteLeitura={false} />);

    await screen.findByText("Financeiro");
    expect(screen.getByText("–")).toBeInTheDocument();
  });

  it("mostra ação Reconectar só para instâncias desconectadas/conectando", async () => {
    global.fetch = mockFetch([CONECTADA, DESCONECTADA]);
    renderComQuery(<ListaInstancias somenteLeitura={false} />);

    await screen.findByText("Financeiro");

    expect(
      screen.queryByRole("button", { name: "Reconectar Atendimento principal" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconectar Financeiro" })).toBeInTheDocument();
  });

  it("esconde Nova instância e Reconectar quando somenteLeitura", async () => {
    global.fetch = mockFetch([DESCONECTADA]);
    renderComQuery(<ListaInstancias somenteLeitura />);

    await screen.findByText("Financeiro");

    expect(screen.queryByRole("button", { name: "Nova instância" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reconectar Financeiro" })
    ).not.toBeInTheDocument();
  });

  it("clicar em Reconectar chama a mutation certa e abre o QR code com a imagem retornada", async () => {
    global.fetch = mockFetch([DESCONECTADA]);
    const usuario = userEvent.setup();
    renderComQuery(<ListaInstancias somenteLeitura={false} />);

    await usuario.click(await screen.findByRole("button", { name: "Reconectar Financeiro" }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(([url]: [string]) =>
        String(url).endsWith("/reconectar")
      );
      expect(chamada).toBeDefined();
      expect(chamada[0]).toBe("/api/instancias/instancia-2/reconectar");
      expect(chamada[1].method).toBe("POST");
    });

    const imagem = await screen.findByRole("img", { name: /financeiro/i });
    expect(imagem).toHaveAttribute("src", "data:image/png;base64,novo-qr");
  });

  it("abrir Nova instância, criar e ver o dialog de QR code aparecer", async () => {
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/instancias" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            instancia: DESCONECTADA,
            qrcode: "data:image/png;base64,criado-qr",
            paircode: "9999",
          }),
        } as Response);
      }
      if (url === "/api/instancias") {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ instancias: [] }) } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
    }) as unknown as typeof fetch;

    const usuario = userEvent.setup();
    renderComQuery(<ListaInstancias somenteLeitura={false} />);

    await screen.findByText("Nenhuma instância de WhatsApp cadastrada ainda.");
    await usuario.click(screen.getByRole("button", { name: "Nova instância" }));
    await usuario.type(screen.getByLabelText("Nome"), "Financeiro");
    await usuario.click(screen.getByRole("button", { name: "Criar instância" }));

    const imagem = await screen.findByRole("img", { name: /financeiro/i });
    expect(imagem).toHaveAttribute("src", "data:image/png;base64,criado-qr");
  });
});
