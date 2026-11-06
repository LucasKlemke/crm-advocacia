import { render, screen } from "@testing-library/react";
import Image from "./next-image";

describe("Image (compat de Image do Next)", () => {
  it("renderiza <img> com src, alt e dimensões, com carregamento lazy por padrão", () => {
    render(
      <Image src="/images/justica-estatua.webp" alt="Estátua" width={320} height={320} className="size-40" />
    );

    const imagem = screen.getByRole("img", { name: "Estátua" });
    expect(imagem).toHaveAttribute("src", "/images/justica-estatua.webp");
    expect(imagem).toHaveAttribute("width", "320");
    expect(imagem).toHaveAttribute("loading", "lazy");
    expect(imagem).toHaveClass("size-40");
  });

  it("fill cobre o container posicionado, como no Next", () => {
    render(<Image src="/images/auth-background.webp" alt="Fundo" fill sizes="50vw" />);

    const imagem = screen.getByRole("img", { name: "Fundo" });
    expect(imagem).toHaveStyle({ position: "absolute", width: "100%", height: "100%" });
    expect(imagem).toHaveAttribute("sizes", "50vw");
  });

  it("priority carrega de imediato e com prioridade alta", () => {
    render(<Image src="/images/justica-estatua.webp" alt="Destaque" fill priority />);

    const imagem = screen.getByRole("img", { name: "Destaque" });
    expect(imagem).toHaveAttribute("loading", "eager");
    expect(imagem).toHaveAttribute("fetchpriority", "high");
  });
});
