import userEvent from "@testing-library/user-event";
import { render, screen } from "@/lib/test-utils";
import { DocumentoViewer } from "./documento-viewer";
import type { DocumentoDTO } from "@/types/documento";

function documentoFake(over: Partial<DocumentoDTO> = {}): DocumentoDTO {
  return {
    id: "doc-1",
    escopo: "caso",
    escopoId: "caso-1",
    nomeOriginal: "contrato.pdf",
    tipoArquivo: "pdf",
    tamanhoKb: 512,
    createdAt: "2026-08-01T12:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  window.open = jest.fn();
});

describe("DocumentoViewer", () => {
  it("busca a URL inline ao montar e exibe o pdf num iframe", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ downloadUrl: "https://s3.example.com/get-inline" }),
    });
    const onVoltar = jest.fn();

    render(<DocumentoViewer documento={documentoFake()} onVoltar={onVoltar} />);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/documentos/doc-1/download-url?modo=inline",
      expect.anything()
    );
    const iframe = await screen.findByTitle("contrato.pdf");
    expect(iframe).toHaveAttribute("src", "https://s3.example.com/get-inline");
    expect(screen.getByText("contrato.pdf")).toBeInTheDocument();
  });

  it("exibe imagens num <img>", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ downloadUrl: "https://s3.example.com/get-inline" }),
    });

    render(
      <DocumentoViewer
        documento={documentoFake({ nomeOriginal: "foto.jpg", tipoArquivo: "jpg" })}
        onVoltar={jest.fn()}
      />
    );

    const img = await screen.findByAltText("foto.jpg");
    expect(img).toHaveAttribute("src", "https://s3.example.com/get-inline");
  });

  it("mostra mensagem de indisponível para docx", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ downloadUrl: "https://s3.example.com/get-inline" }),
    });

    render(
      <DocumentoViewer
        documento={documentoFake({ nomeOriginal: "peticao.docx", tipoArquivo: "docx" })}
        onVoltar={jest.fn()}
      />
    );

    expect(await screen.findByText(/pré-visualização não disponível/i)).toBeInTheDocument();
  });

  it("mostra erro quando a URL de visualização falha", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    render(<DocumentoViewer documento={documentoFake()} onVoltar={jest.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível carregar/i);
  });

  it("chama onVoltar ao clicar em Voltar", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ downloadUrl: "https://s3.example.com/get-inline" }),
    });
    const onVoltar = jest.fn();
    const user = userEvent.setup();

    render(<DocumentoViewer documento={documentoFake()} onVoltar={onVoltar} />);
    await screen.findByTitle("contrato.pdf");

    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onVoltar).toHaveBeenCalled();
  });

  // A visualização é só leitura embutida na drawer: baixar já existe como ação própria
  // na lista (fora do viewer), então a barra aqui tem só "Voltar".
  it("mostra apenas o botão Voltar na barra (sem Baixar)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ downloadUrl: "https://s3.example.com/get-inline" }),
    });

    render(<DocumentoViewer documento={documentoFake()} onVoltar={jest.fn()} />);
    await screen.findByTitle("contrato.pdf");

    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Baixar" })).not.toBeInTheDocument();
  });
});
