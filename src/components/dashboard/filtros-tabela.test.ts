import { filtrosTabelaDashboard } from "./filtros-tabela";
import { filtrosCasosPadrao } from "@/types/caso";
import { filtrosDashboardPadrao } from "@/types/dashboard";

describe("filtrosTabelaDashboard", () => {
  it("sem filtro nem seleção, equivale aos filtros padrão de casos", () => {
    // É o que garante que o prefetch do servidor acerte a mesma query key do cliente.
    expect(filtrosTabelaDashboard(filtrosDashboardPadrao, [])).toEqual(filtrosCasosPadrao);
  });

  it("leva cliente, responsável e período do header para a tabela", () => {
    const filtros = filtrosTabelaDashboard(
      {
        clienteIds: ["cli-1"],
        responsavelIds: ["membro-1"],
        dataInicio: "2026-01-01",
        dataFim: "2026-08-01",
      },
      []
    );

    expect(filtros).toMatchObject({
      clienteIds: ["cli-1"],
      responsavelIds: ["membro-1"],
      dataInicio: "2026-01-01",
      dataFim: "2026-08-01",
    });
  });

  it("usa os cards de status selecionados como tipoStatusIds", () => {
    expect(filtrosTabelaDashboard(filtrosDashboardPadrao, ["tipo-1", "tipo-2"])).toMatchObject({
      tipoStatusIds: ["tipo-1", "tipo-2"],
    });
  });
});
