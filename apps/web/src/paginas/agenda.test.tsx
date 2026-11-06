import { screen } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina } from "@/lib/test-paginas";
import { PaginaAgenda } from "./agenda";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("./agenda/_components/agenda-view", () => ({ AgendaView: () => <div data-testid="agenda-view" /> }));

it("mostra o cabeçalho da agenda e a visão do calendário", () => {
  renderPagina(<PaginaAgenda />, { rota: "/agenda?visao=semana", caminho: "/agenda" });

  expect(useTituloPagina).toHaveBeenCalledWith("Agenda");
  expect(screen.getByRole("heading", { name: "Agenda" })).toBeInTheDocument();
  expect(screen.getByTestId("agenda-view")).toBeInTheDocument();
});
