import { render, screen } from "@testing-library/react";
import { StatusBadgeMensagem } from "./status-badge-mensagem";
import type { StatusMensagem } from "@/lib/utils/campanha-status-mensagem";

describe("StatusBadgeMensagem", () => {
  it.each<[StatusMensagem, string]>([
    ["pendente", "Pendente"],
    ["enviada", "Enviada"],
    ["entregue", "Entregue"],
    ["lida", "Lida"],
    ["falha", "Falha"],
    ["desconhecido", "Desconhecido"],
  ])("rotula %s como %s", (status, rotulo) => {
    render(<StatusBadgeMensagem status={status} />);

    expect(screen.getByText(rotulo)).toBeInTheDocument();
  });
});
