import { render, screen } from "@testing-library/react";
import { BadgeValor } from "./badge-valor";

describe("BadgeValor", () => {
  it("formata o valor em BRL dentro de um pill com as cores de valor", () => {
    render(<BadgeValor valor={4500} />);

    const pill = screen.getByText("R$ 4.500,00");

    expect(pill).toHaveClass("bg-valor-muted", "text-valor", "rounded-full");
  });
})
