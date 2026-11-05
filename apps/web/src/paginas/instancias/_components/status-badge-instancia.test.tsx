import { render, screen } from "@testing-library/react";
import { StatusBadgeInstancia } from "./status-badge-instancia";

describe("StatusBadgeInstancia", () => {
  it("mostra o rótulo em português para cada status", () => {
    const { rerender } = render(<StatusBadgeInstancia status="disconnected" />);
    expect(screen.getByText("Desconectado")).toBeInTheDocument();

    rerender(<StatusBadgeInstancia status="connecting" />);
    expect(screen.getByText("Conectando")).toBeInTheDocument();

    rerender(<StatusBadgeInstancia status="connected" />);
    expect(screen.getByText("Conectado")).toBeInTheDocument();

    rerender(<StatusBadgeInstancia status="hibernated" />);
    expect(screen.getByText("Hibernado")).toBeInTheDocument();
  });
});
