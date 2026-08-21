import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AvatarUpload } from "./avatar-upload";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedUseRouter = useRouter as jest.Mock;

function arquivoPng(nomeArquivo = "foto.png", tamanhoBytes = 200 * 1024) {
  const arquivo = new File(["conteudo"], nomeArquivo, { type: "image/png" });
  Object.defineProperty(arquivo, "size", { value: tamanhoBytes });
  return arquivo;
}

async function selecionarArquivo(user: ReturnType<typeof userEvent.setup>, arquivo: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, arquivo);
}

describe("AvatarUpload", () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh });
    global.fetch = jest.fn();
  });

  it("mostra as iniciais quando o usuário não tem avatar", () => {
    render(<AvatarUpload usuario={{ nome: "Fulano de Tal" }} temAvatarInicial={false} />);

    expect(screen.getByText("FD")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("busca a URL de download quando o usuário já tem avatar", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ downloadUrl: "https://bucket.s3.amazonaws.com/signed-get" }),
    });

    render(<AvatarUpload usuario={{ nome: "Fulano de Tal" }} temAvatarInicial />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/perfil/avatar/download-url")
    );
  });

  it("envia o arquivo escolhido, confirma e atualiza a página", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: "https://bucket.s3.amazonaws.com/signed-put",
          storageKey: "development/avatares/user-1/123-foto.png",
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ downloadUrl: "https://bucket.s3.amazonaws.com/signed-get-nova" }),
      });

    const user = userEvent.setup();
    render(<AvatarUpload usuario={{ nome: "Fulano de Tal" }} temAvatarInicial={false} />);

    await selecionarArquivo(user, arquivoPng());

    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/perfil/avatar/upload-url",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ nomeArquivo: "foto.png", tipoArquivo: "png", tamanhoBytes: 200 * 1024 }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://bucket.s3.amazonaws.com/signed-put",
      expect.objectContaining({ method: "PUT" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/perfil/avatar/confirmar",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ storageKey: "development/avatares/user-1/123-foto.png" }),
      })
    );
    expect(refresh).toHaveBeenCalled();
  });

  // Bug: Content-Length é um header assinado pelo S3. Se o cliente mandasse um tamanho
  // arredondado (KB) em vez do tamanho exato do arquivo, o PUT real (que sempre carrega
  // o Content-Length exato) divergiria da assinatura e o S3 devolveria 403.
  it("envia o tamanho exato em bytes, mesmo quando não é múltiplo de 1024", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: "https://bucket.s3.amazonaws.com/signed-put",
          storageKey: "development/avatares/user-1/123-foto.png",
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloadUrl: null }) });

    const user = userEvent.setup();
    render(<AvatarUpload usuario={{ nome: "Fulano de Tal" }} temAvatarInicial={false} />);

    await selecionarArquivo(user, arquivoPng("foto.png", 1_687_900));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/perfil/avatar/upload-url",
      expect.objectContaining({
        body: JSON.stringify({ nomeArquivo: "foto.png", tipoArquivo: "png", tamanhoBytes: 1_687_900 }),
      })
    );
  });

  it("recusa arquivo maior que 5MB sem chamar o servidor", async () => {
    const user = userEvent.setup();
    render(<AvatarUpload usuario={{ nome: "Fulano de Tal" }} temAvatarInicial={false} />);

    await selecionarArquivo(user, arquivoPng("grande.png", 6 * 1024 * 1024));

    expect(await screen.findByRole("alert")).toHaveTextContent(/5\s?mb/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("recusa tipo de arquivo não suportado sem chamar o servidor", async () => {
    render(<AvatarUpload usuario={{ nome: "Fulano de Tal" }} temAvatarInicial={false} />);

    // fireEvent em vez de userEvent.upload: o accept do input já filtra isso no picker
    // real do navegador, mas a validação em código é a defesa contra um arquivo trocado
    // (ex.: extensão renomeada) chegando de outra forma até o input.
    const pdf = new File(["conteudo"], "documento.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pdf] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/formato/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("exibe erro quando o envio ao S3 falha", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: "https://bucket.s3.amazonaws.com/signed-put",
          storageKey: "development/avatares/user-1/123-foto.png",
        }),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const user = userEvent.setup();
    render(<AvatarUpload usuario={{ nome: "Fulano de Tal" }} temAvatarInicial={false} />);

    await selecionarArquivo(user, arquivoPng());

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível enviar/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("exibe o erro do servidor quando o upload é recusado", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "A imagem deve ter no máximo 5120KB." }),
    });

    const user = userEvent.setup();
    render(<AvatarUpload usuario={{ nome: "Fulano de Tal" }} temAvatarInicial={false} />);

    await selecionarArquivo(user, arquivoPng());

    expect(await screen.findByRole("alert")).toHaveTextContent(/5120KB/i);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("exibe o erro do servidor quando a confirmação é recusada", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: "https://bucket.s3.amazonaws.com/signed-put",
          storageKey: "development/avatares/user-1/123-foto.png",
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Storage key inválida." }),
      });

    const user = userEvent.setup();
    render(<AvatarUpload usuario={{ nome: "Fulano de Tal" }} temAvatarInicial={false} />);

    await selecionarArquivo(user, arquivoPng());

    expect(await screen.findByRole("alert")).toHaveTextContent(/storage key inválida/i);
    expect(refresh).not.toHaveBeenCalled();
  });
});
