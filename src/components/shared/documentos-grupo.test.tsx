import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { DocumentosGrupo } from "./documentos-grupo";
import type { DocumentoDTO } from "@/types/documento";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

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

function respostaLista(documentos: DocumentoDTO[]) {
  return { ok: true, status: 200, json: async () => ({ documentos }) } as Response;
}

function renderGrupo(onVisualizar: (documento: DocumentoDTO) => void = jest.fn()) {
  return renderComQuery(
    <DocumentosGrupo
      escopo="caso"
      escopoId="caso-1"
      titulo="Documentos do processo"
      hrefBaixarTodos="/api/casos/caso-1/documentos/download-todos"
      onVisualizar={onVisualizar}
    />
  );
}

async function selecionarArquivo(user: ReturnType<typeof userEvent.setup>, arquivo: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, arquivo);
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue(respostaLista([]));
  window.open = jest.fn();
});

describe("DocumentosGrupo", () => {
  it("mostra mensagem de lista vazia e não mostra 'baixar todos'", async () => {
    renderGrupo();

    expect(await screen.findByText(/nenhum documento/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /baixar todos/i })).not.toBeInTheDocument();
  });

  it("lista documentos existentes com nome e tamanho, e mostra 'baixar todos'", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(respostaLista([documentoFake({ tamanhoKb: 1536 })]));
    renderGrupo();

    expect(await screen.findByText("contrato.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.5 MB")).toBeInTheDocument();

    const link = screen.getByRole("button", { name: /baixar todos/i });
    expect(link).toHaveAttribute("href", "/api/casos/caso-1/documentos/download-todos");
  });

  it("mostra o tipo de cada documento com ícone e selo diferentes por categoria", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respostaLista([
        documentoFake({ id: "doc-1", nomeOriginal: "contrato.pdf", tipoArquivo: "pdf" }),
        documentoFake({ id: "doc-2", nomeOriginal: "foto.jpg", tipoArquivo: "jpg" }),
        documentoFake({ id: "doc-3", nomeOriginal: "peticao.docx", tipoArquivo: "docx" }),
      ])
    );
    renderGrupo();

    await screen.findByText("contrato.pdf");

    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("JPG")).toBeInTheDocument();
    expect(screen.getByText("DOCX")).toBeInTheDocument();
  });

  it("mostra erro quando a listagem falha", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderGrupo();

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível carregar/i);
  });

  it("recusa arquivo de tipo não suportado sem chamar a API", async () => {
    const user = userEvent.setup();
    renderGrupo();
    await screen.findByText(/nenhum documento/i);

    const arquivo = new File(["conteudo"], "virus.exe", { type: "application/octet-stream" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [arquivo] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/formato/i);
    expect(global.fetch).toHaveBeenCalledTimes(1); // só a listagem inicial
  });

  it("recusa arquivo maior que 10MB sem chamar a API", async () => {
    renderGrupo();
    await screen.findByText(/nenhum documento/i);

    const arquivo = new File(["conteudo"], "grande.pdf", { type: "application/pdf" });
    Object.defineProperty(arquivo, "size", { value: 11 * 1024 * 1024 });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [arquivo] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/10mb/i);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("envia um documento válido pelo fluxo upload-url -> S3 -> confirmar", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(respostaLista([]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          documentoId: "doc-2",
          uploadUrl: "https://s3.example.com/upload",
          storageKey: "key",
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ documento: documentoFake({ id: "doc-2" }) }),
      })
      .mockResolvedValueOnce(respostaLista([documentoFake({ id: "doc-2" })]));

    const user = userEvent.setup();
    renderGrupo();
    await screen.findByText(/nenhum documento/i);

    await selecionarArquivo(user, new File(["conteudo"], "contrato.pdf", { type: "application/pdf" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Documento enviado."));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/documentos/upload-url", expect.anything());
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://s3.example.com/upload", expect.anything());
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/documentos/doc-2/confirmar", expect.anything());
  });

  it("baixa um documento individual abrindo a URL assinada em nova aba", async () => {
    global.fetch = jest.fn().mockImplementation((caminho: string) => {
      if (caminho.includes("download-url")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ downloadUrl: "https://s3.example.com/get" }),
        });
      }
      return Promise.resolve(respostaLista([documentoFake()]));
    });

    const user = userEvent.setup();
    renderGrupo();
    await screen.findByText("contrato.pdf");

    await user.click(screen.getByRole("button", { name: /baixar contrato\.pdf/i }));

    await waitFor(() =>
      expect(window.open).toHaveBeenCalledWith(
        "https://s3.example.com/get",
        "_blank",
        "noopener,noreferrer"
      )
    );
  });

  // A visualização em si (loading, iframe/img, "Voltar") virou responsabilidade da
  // drawer (DocumentoViewer, testado em documento-viewer.test.tsx) — este grupo só
  // precisa avisar qual documento foi clicado.
  it("chama onVisualizar com o documento ao clicar no card (sem baixar)", async () => {
    global.fetch = jest.fn().mockResolvedValue(respostaLista([documentoFake()]));
    const onVisualizar = jest.fn();

    const user = userEvent.setup();
    renderGrupo(onVisualizar);
    await screen.findByText("contrato.pdf");

    await user.click(screen.getByRole("button", { name: /^contrato\.pdf/i }));

    expect(window.open).not.toHaveBeenCalled();
    expect(onVisualizar).toHaveBeenCalledWith(documentoFake());
  });

  it("exclui um documento após confirmação", async () => {
    const fetchMock = jest.fn().mockImplementation((caminho: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
      }
      return Promise.resolve(respostaLista([documentoFake()]));
    });
    global.fetch = fetchMock;

    const user = userEvent.setup();
    renderGrupo();
    await screen.findByText("contrato.pdf");

    await user.click(screen.getByRole("button", { name: /excluir contrato\.pdf/i }));
    await user.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Documento excluído."));
    expect(fetchMock).toHaveBeenCalledWith("/api/documentos/doc-1", expect.objectContaining({ method: "DELETE" }));
  });

  it("renomeia um documento preservando a extensão", async () => {
    const fetchMock = jest.fn().mockImplementation((caminho: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ documento: documentoFake({ nomeOriginal: "novo-nome.pdf" }) }),
        });
      }
      return Promise.resolve(respostaLista([documentoFake()]));
    });
    global.fetch = fetchMock;

    const user = userEvent.setup();
    renderGrupo();
    await screen.findByText("contrato.pdf");

    await user.click(screen.getByRole("button", { name: /renomear contrato\.pdf/i }));

    const campoNome = await screen.findByLabelText("Nome");
    expect(campoNome).toHaveValue("contrato");
    expect(screen.getByText(".pdf")).toBeInTheDocument();

    await user.clear(campoNome);
    await user.type(campoNome, "novo-nome");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Documento renomeado."));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documentos/doc-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ nomeArquivo: "novo-nome.pdf" }) })
    );
  });
});
