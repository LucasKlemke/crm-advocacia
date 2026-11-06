import { render, screen } from "@testing-library/react";
import { calcularForcaSenha, PasswordStrengthMeter } from "./password-strength-meter";

describe("calcularForcaSenha", () => {
  it("retorna score 0 para senha vazia", () => {
    expect(calcularForcaSenha("")).toEqual({ score: 0, label: "", className: "" });
  });

  it("classifica como Fraca quando atende no máximo 1 critério", () => {
    expect(calcularForcaSenha("abcdefg").label).toBe("Fraca");
    expect(calcularForcaSenha("abcdefgh").score).toBe(1);
  });

  it("classifica como Média quando atende 2 ou 3 critérios", () => {
    expect(calcularForcaSenha("abcdefgh1").label).toBe("Média");
    expect(calcularForcaSenha("Abcdefgh1").label).toBe("Média");
  });

  it("classifica como Forte quando atende todos os critérios", () => {
    const resultado = calcularForcaSenha("Abcdefgh1!");
    expect(resultado.score).toBe(4);
    expect(resultado.label).toBe("Forte");
  });
});

describe("PasswordStrengthMeter", () => {
  it("não renderiza nada quando a senha está vazia", () => {
    const { container } = render(<PasswordStrengthMeter senha="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o rótulo da força correspondente à senha digitada", () => {
    render(<PasswordStrengthMeter senha="Abcdefgh1!" />);
    expect(screen.getByText(/força da senha: forte/i)).toBeInTheDocument();
  });
});
