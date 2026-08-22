import { render, screen } from "@testing-library/react";
import { BadgeStatus } from "./badge-status";

describe("BadgeStatus", () => {
  it("mostra o nome e tinge borda, texto e fundo com a cor recebida", () => {
    render(<BadgeStatus nome="Negociação" cor="#f59e0b" />);

    const badge = screen.getByText("Negociação");

    expect(badge).toHaveStyle({
      borderColor: "color-mix(in oklch, #f59e0b, transparent 50%)",
      color: "#f59e0b",
      backgroundColor: "color-mix(in oklch, #f59e0b, transparent 92%)",
    });
  });
});
