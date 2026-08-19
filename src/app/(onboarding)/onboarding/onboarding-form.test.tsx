import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { OnboardingForm } from "./onboarding-form";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

const mockedUseRouter = useRouter as jest.Mock;

describe("OnboardingForm", () => {
  const push = jest.fn();
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ push, refresh });
    global.fetch = jest.fn();
  });

  it("cria o escritório e redireciona para a home", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();

    render(<OnboardingForm />);
    await user.type(screen.getByLabelText("Nome do escritório"), "Escritório Teste");
    await user.click(screen.getByRole("button", { name: /criar escritório/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/escritorios",
      expect.objectContaining({ method: "POST" })
    );
    expect(push).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalled();
  });

  it("exibe erro do servidor sem redirecionar", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Não foi possível criar o escritório." }),
    });
    const user = userEvent.setup();

    render(<OnboardingForm />);
    await user.type(screen.getByLabelText("Nome do escritório"), "Escritório Teste");
    await user.click(screen.getByRole("button", { name: /criar escritório/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível/i);
    expect(push).not.toHaveBeenCalled();
  });
});
