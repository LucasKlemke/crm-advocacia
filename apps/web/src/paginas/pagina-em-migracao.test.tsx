import { render, screen } from "@testing-library/react";
import { PaginaEmMigracao } from "./pagina-em-migracao";

describe("PaginaEmMigracao", () => {
  it("identifica a página do Next que ainda não foi portada", () => {
    render(<PaginaEmMigracao caminhoNext="src/app/(dashboard)/clientes/page.tsx" />);

    expect(screen.getByRole("heading", { name: "Página em migração" })).toBeInTheDocument();
    expect(screen.getByText("src/app/(dashboard)/clientes/page.tsx")).toBeInTheDocument();
  });
});
