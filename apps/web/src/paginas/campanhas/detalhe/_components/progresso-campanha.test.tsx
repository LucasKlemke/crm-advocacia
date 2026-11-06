import { render, screen } from "@testing-library/react";
import { ProgressoCampanha } from "./progresso-campanha";

describe("ProgressoCampanha", () => {
  it("mostra processadas (enviadas + falhas) sobre o total de destinatários", () => {
    render(<ProgressoCampanha enviadas={3} falhas={1} total={8} />);

    const barra = screen.getByRole("progressbar", { name: "Progresso do disparo" });
    expect(barra).toHaveAttribute("aria-valuenow", "50");
    expect(barra).toHaveAttribute("aria-valuemin", "0");
    expect(barra).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("4 de 8 processadas · 50%")).toBeInTheDocument();
  });

  it("nunca passa de 100% (retentativas podem somar mais que o total)", () => {
    render(<ProgressoCampanha enviadas={9} falhas={2} total={8} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("8 de 8 processadas · 100%")).toBeInTheDocument();
  });

  it("campanha sem destinatários fica em 0% sem dividir por zero", () => {
    render(<ProgressoCampanha enviadas={0} falhas={0} total={0} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0 de 0 processadas · 0%")).toBeInTheDocument();
  });

  it("arredonda para baixo: 1 de 3 é 33%, e só chega a 100% quando todas terminaram", () => {
    const { rerender } = render(<ProgressoCampanha enviadas={1} falhas={0} total={3} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");

    rerender(<ProgressoCampanha enviadas={199} falhas={0} total={200} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "99");
  });
});
