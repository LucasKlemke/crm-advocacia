import { render, screen } from "@testing-library/react";
import { PageContainer } from "./page-container";

describe("PageContainer", () => {
  it("renderiza o conteúdo recebido", () => {
    render(
      <PageContainer>
        <p>Conteúdo da página</p>
      </PageContainer>
    );

    expect(screen.getByText("Conteúdo da página")).toBeInTheDocument();
  });

  // O className extra precisa somar às classes base, não substituí-las.
  it("mescla a className recebida com a largura de leitura padrão", () => {
    render(
      <PageContainer className="gap-6">
        <p>Conteúdo</p>
      </PageContainer>
    );

    const container = screen.getByText("Conteúdo").parentElement;
    expect(container).toHaveClass("max-w-lg");
    expect(container).toHaveClass("gap-6");
  });
});
