import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname, useRouter } from "next/navigation";
import { AuthTabs } from "./auth-tabs";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

const mockedUsePathname = usePathname as jest.Mock;
const mockedUseRouter = useRouter as jest.Mock;

describe("AuthTabs", () => {
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ push });
  });

  it("marca 'Entrar' como aba ativa em /login", () => {
    mockedUsePathname.mockReturnValue("/login");

    render(<AuthTabs />);

    expect(screen.getByRole("tab", { name: "Entrar" })).toHaveAttribute("aria-selected", "true");
  });

  it("marca 'Cadastrar' como aba ativa em /cadastro", () => {
    mockedUsePathname.mockReturnValue("/cadastro");

    render(<AuthTabs />);

    expect(screen.getByRole("tab", { name: "Cadastrar" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("navega para /cadastro ao clicar na aba Cadastrar", async () => {
    mockedUsePathname.mockReturnValue("/login");
    const user = userEvent.setup();

    render(<AuthTabs />);
    await user.click(screen.getByRole("tab", { name: "Cadastrar" }));

    expect(push).toHaveBeenCalledWith("/cadastro");
  });

  it("navega para /login ao clicar na aba Entrar", async () => {
    mockedUsePathname.mockReturnValue("/cadastro");
    const user = userEvent.setup();

    render(<AuthTabs />);
    await user.click(screen.getByRole("tab", { name: "Entrar" }));

    expect(push).toHaveBeenCalledWith("/login");
  });
});
