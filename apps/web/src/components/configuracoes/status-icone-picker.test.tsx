import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusIconePicker } from "./status-icone-picker";

describe("StatusIconePicker", () => {
  it("mostra o placeholder quando nenhum ícone está selecionado", () => {
    render(<StatusIconePicker value={null} onChange={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Selecionar ícone" })).toHaveTextContent(
      "Selecione um ícone"
    );
  });

  it("mostra o nome do ícone selecionado", () => {
    render(<StatusIconePicker value="Search" onChange={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Selecionar ícone" })).toHaveTextContent("Search");
  });

  it("abre a lista e permite buscar/escolher um ícone", async () => {
    const usuario = userEvent.setup();
    const onChange = jest.fn();
    render(<StatusIconePicker value={null} onChange={onChange} />);

    await usuario.click(screen.getByRole("button", { name: "Selecionar ícone" }));
    await usuario.type(screen.getByPlaceholderText("Buscar ícone..."), "Trophy");
    // A lista é uma grade só de ícones: o nome de cada opção vive no aria-label.
    await usuario.click(await screen.findByRole("option", { name: "Trophy" }));

    expect(onChange).toHaveBeenCalledWith("Trophy");
  });

  it("fica desabilitado quando disabled é passado", () => {
    render(<StatusIconePicker value={null} onChange={jest.fn()} disabled />);

    expect(screen.getByRole("button", { name: "Selecionar ícone" })).toBeDisabled();
  });
});
