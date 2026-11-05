import { screen } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { mockApi, renderPagina, SESSAO_OWNER, SESSAO_PADRAO } from "@/lib/test-paginas";
import type { InstanciaWhatsappDTO } from "@dominio/types/instancia-whatsapp";
import { PaginaInstancias } from "./instancias";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));

const INSTANCIA: InstanciaWhatsappDTO = {
  id: "instancia-1",
  escritorioId: "esc-1",
  nome: "Atendimento principal",
  uazapiInstanceId: "uaz-1",
  status: "connected",
  numeroConectado: "5511999999999",
  fotoPerfilUrl: null,
  softDeletedAt: null,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

const ACOES = [
  "Reconectar Atendimento principal",
  "Desconectar Atendimento principal",
  "Excluir Atendimento principal",
];

describe("PaginaInstancias", () => {
  beforeEach(() => mockApi({ "/api/instancias": { instancias: [INSTANCIA] } }));

  it("owner vê Nova instância e as ações por instância", async () => {
    renderPagina(<PaginaInstancias />, { rota: "/instancias", caminho: "/instancias", sessao: SESSAO_OWNER });

    expect(useTituloPagina).toHaveBeenCalledWith("Instâncias");
    await screen.findByText("Atendimento principal");
    expect(screen.getByRole("button", { name: /Nova instância/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desconectar Atendimento principal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir Atendimento principal" })).toBeInTheDocument();
  });

  it("padrao só lê: não cria, não reconecta, não desconecta e não exclui", async () => {
    renderPagina(<PaginaInstancias />, { rota: "/instancias", caminho: "/instancias", sessao: SESSAO_PADRAO });

    await screen.findByText("Atendimento principal");
    expect(screen.queryByRole("button", { name: /Nova instância/ })).not.toBeInTheDocument();
    for (const nome of ACOES) {
      expect(screen.queryByRole("button", { name: nome })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /Verificar status/ })).not.toBeInTheDocument();
  });
});
