import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FiltroMultiSelect } from "./filtro-multi-select";

jest.mock("@/components/shared/avatar-iniciais", () => ({
  AvatarIniciais: ({ nome, avatarUrl }: { nome: string; avatarUrl?: string | null }) => (
    <div data-testid={`avatar-${nome}`} data-avatar-url={avatarUrl ?? ""} />
  ),
}));

describe("FiltroMultiSelect", () => {
  it("repassa o avatarUrl da opção pro AvatarIniciais quando avatares está ativo", async () => {
    const usuario = userEvent.setup();
    render(
      <FiltroMultiSelect
        label="Responsável"
        opcoes={[{ id: "membro-1", nome: "João Souza", avatarUrl: "https://bucket.s3.amazonaws.com/signed-get" }]}
        selecionados={[]}
        onChange={jest.fn()}
        avatares
      />
    );

    await usuario.click(screen.getByRole("button", { name: "Responsável" }));

    expect(await screen.findByTestId("avatar-João Souza")).toHaveAttribute(
      "data-avatar-url",
      "https://bucket.s3.amazonaws.com/signed-get"
    );
  });

  it("não renderiza avatar quando avatares não está ativo", async () => {
    const usuario = userEvent.setup();
    render(
      <FiltroMultiSelect
        label="Cliente"
        opcoes={[{ id: "cliente-1", nome: "Maria Silva" }]}
        selecionados={[]}
        onChange={jest.fn()}
      />
    );

    await usuario.click(screen.getByRole("button", { name: "Cliente" }));
    await screen.findByText("Maria Silva");

    expect(screen.queryByTestId("avatar-Maria Silva")).not.toBeInTheDocument();
  });

  it("mostra a descrição da opção em tooltip ao passar o mouse sobre o item", async () => {
    const usuario = userEvent.setup();
    render(
      <FiltroMultiSelect
        label="Status"
        opcoes={[
          {
            id: "status-1",
            nome: "Em análise",
            cor: "#f59e0b",
            descricao: "Processo em estudo inicial pelo escritório.",
          },
        ]}
        selecionados={[]}
        onChange={jest.fn()}
      />
    );

    await usuario.click(screen.getByRole("button", { name: "Status" }));
    await usuario.hover(await screen.findByRole("option", { name: /em análise/i }));

    expect(
      await screen.findByText("Processo em estudo inicial pelo escritório.")
    ).toBeInTheDocument();
  });

  it("não quebra a seleção de uma opção que tem descrição", async () => {
    const usuario = userEvent.setup();
    const onChange = jest.fn();
    render(
      <FiltroMultiSelect
        label="Status"
        opcoes={[{ id: "status-1", nome: "Em análise", descricao: "Processo em estudo inicial." }]}
        selecionados={[]}
        onChange={onChange}
      />
    );

    await usuario.click(screen.getByRole("button", { name: "Status" }));
    await usuario.click(await screen.findByRole("option", { name: /em análise/i }));

    expect(onChange).toHaveBeenCalledWith(["status-1"]);
  });
});
