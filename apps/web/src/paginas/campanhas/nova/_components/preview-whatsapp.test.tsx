import { render, screen } from "@testing-library/react";
import { PreviewWhatsapp } from "./preview-whatsapp";

describe("PreviewWhatsapp", () => {
  it("mostra o remetente e o texto da mensagem", () => {
    render(<PreviewWhatsapp mensagem="Olá Ana, tudo bem?" remetenteNome="Atendimento" />);

    expect(screen.getByText("Atendimento")).toBeInTheDocument();
    expect(screen.getByText("Olá Ana, tudo bem?")).toBeInTheDocument();
  });

  it("mostra o horário no formato de relógio", () => {
    render(<PreviewWhatsapp mensagem="Oi" remetenteNome="Atendimento" />);

    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  // O texto sai com os asteriscos e é o WhatsApp que os aplica no aparelho do cliente —
  // a prévia mostra o resultado, não a marcação crua.
  it("aplica a formatação do WhatsApp no texto", () => {
    render(<PreviewWhatsapp mensagem="Olá *Ana*!" remetenteNome="Atendimento" />);

    expect(screen.getByText("Ana")).toHaveClass("font-semibold");
    expect(screen.queryByText("Olá *Ana*!")).not.toBeInTheDocument();
  });

  // Regressão: o rabinho já foi triângulo de borda CSS e renderizava como um bloco
  // branco ao lado da bolha. Agora é SVG, e a cor vem da bolha via currentColor.
  it("desenha o rabinho da bolha como SVG na cor da bolha", () => {
    const { container } = render(
      <PreviewWhatsapp mensagem="Oi" remetenteNome="Atendimento" />
    );

    const rabinho = container.querySelector("svg[fill='currentColor']");
    expect(rabinho).not.toBeNull();
    expect(rabinho).toHaveClass("text-zap-bolha-recebida");
    expect(rabinho?.querySelector("path")).not.toBeNull();
  });

  it("usa as iniciais do remetente quando não há foto", () => {
    render(<PreviewWhatsapp mensagem="Oi" remetenteNome="Atendimento Comercial" />);

    expect(screen.getByText("AC")).toBeInTheDocument();
  });
});
