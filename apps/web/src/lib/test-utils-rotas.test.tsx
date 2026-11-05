import { screen } from "@testing-library/react";
import { useParams } from "@/compat/next-navigation";
import { renderComRotas } from "./test-utils-rotas";

function DetalheCampanha() {
  const { id } = useParams<{ id: string }>();
  return <p>campanha {id}</p>;
}

describe("renderComRotas", () => {
  it("monta a árvore com router, rota inicial e params", () => {
    const { queryClient } = renderComRotas(<DetalheCampanha />, {
      rota: "/campanhas/7",
      padrao: "/campanhas/:id",
    });

    expect(screen.getByText("campanha 7")).toBeInTheDocument();
    expect(queryClient).toBeDefined();
  });
});
