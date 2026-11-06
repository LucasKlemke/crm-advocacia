import { render, screen } from "@testing-library/react";
import { EmConstrucao } from "./em-construcao";

describe("EmConstrucao", () => {
  it("exibe o título e a descrição informados", () => {
    render(<EmConstrucao titulo="Instâncias" descricao="Conecte seu WhatsApp." />);

    expect(screen.getByRole("heading", { name: "Instâncias" })).toBeInTheDocument();
    expect(screen.getByText("Conecte seu WhatsApp.")).toBeInTheDocument();
  });

  it("usa a mesma imagem da estátua da Justiça das telas de login/cadastro", () => {
    render(<EmConstrucao titulo="Instâncias" />);

    const imagem = screen.getByRole("img", { name: /estátua da justiça/i });

    expect(imagem).toHaveAttribute("src", expect.stringContaining("justica-estatua"));
  });

  it("marca a seção como em construção para quem usa leitor de tela", () => {
    render(<EmConstrucao titulo="Instâncias" />);

    expect(screen.getByText("Em construção")).toBeInTheDocument();
  });
});
