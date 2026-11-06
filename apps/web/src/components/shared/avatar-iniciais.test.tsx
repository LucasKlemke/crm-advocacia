import { render, screen, waitFor } from "@testing-library/react";
import { AvatarIniciais } from "./avatar-iniciais";

// O componente base (base-ui) só troca pro <img> depois que um `new window.Image()`
// real dispara `onload` — em jsdom isso nunca acontece sozinho (não há rede), então
// simulamos o carregamento pra poder testar o estado "com avatarUrl".
class ImagemFake {
  onload: (() => void) | null = null;
  set src(_valor: string) {
    this.onload?.();
  }
}

describe("AvatarIniciais", () => {
  const OriginalImage = global.Image;

  beforeAll(() => {
    // @ts-expect-error stub simplificado só com o necessário pro loading status
    global.Image = ImagemFake;
  });

  afterAll(() => {
    global.Image = OriginalImage;
  });

  it("mostra as iniciais quando não há avatarUrl", () => {
    render(<AvatarIniciais nome="Fulano de Tal" />);

    expect(screen.getByText("FD")).toBeInTheDocument();
  });

  it("mostra as iniciais quando avatarUrl é null", () => {
    render(<AvatarIniciais nome="Fulano de Tal" avatarUrl={null} />);

    expect(screen.getByText("FD")).toBeInTheDocument();
  });

  it("renderiza a imagem do avatar quando avatarUrl é informado", async () => {
    render(<AvatarIniciais nome="Fulano de Tal" avatarUrl="https://bucket.s3.amazonaws.com/signed-get" />);

    await waitFor(() => {
      const imagem = document.querySelector('[data-slot="avatar-image"]');
      expect(imagem).toHaveAttribute("src", "https://bucket.s3.amazonaws.com/signed-get");
    });
  });
});
