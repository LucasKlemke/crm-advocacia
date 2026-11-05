import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { LayoutConfiguracoes } from "./layout-configuracoes";

jest.mock("@/components/configuracoes/configuracoes-nav", () => ({
  ConfiguracoesNav: () => <nav aria-label="configurações" />,
}));

it("mostra a navegação de configurações ao lado da subpágina", () => {
  render(
    <MemoryRouter initialEntries={["/configuracoes/status"]}>
      <Routes>
        <Route path="/configuracoes" element={<LayoutConfiguracoes />}>
          <Route path="status" element={<p>status</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByRole("navigation", { name: "configurações" })).toBeInTheDocument();
  expect(screen.getByText("status")).toBeInTheDocument();
});
