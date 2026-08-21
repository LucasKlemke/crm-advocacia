import { render, screen } from "@testing-library/react";
import { getTenantContextOuRedirect } from "../../_lib/tenant-context-pagina";
import { membroService } from "@/services/membro.service";
import { conviteService } from "@/services/convite.service";
import { usuarioService } from "@/services/usuario.service";
import ConfiguracoesMembrosPage from "./page";

jest.mock("../../_lib/tenant-context-pagina", () => ({ getTenantContextOuRedirect: jest.fn() }));
jest.mock("@/services/membro.service", () => ({ membroService: { listarMembros: jest.fn() } }));
jest.mock("@/services/convite.service", () => ({ conviteService: { listarPendentes: jest.fn() } }));
jest.mock("@/services/usuario.service", () => ({ usuarioService: { assinarUrlAvatar: jest.fn() } }));
jest.mock("@/components/configuracoes/membros-table", () => ({
  MembrosTable: ({ membros }: { membros: { usuario: { nome: string; avatarUrl?: string | null } }[] }) => (
    <div data-testid="membros-table">
      {membros.map((m) => (
        <span key={m.usuario.nome} data-avatar-url={m.usuario.avatarUrl ?? ""}>
          {m.usuario.nome}
        </span>
      ))}
    </div>
  ),
}));
jest.mock("@/components/configuracoes/convites-table", () => ({ ConvitesTable: () => <div /> }));
jest.mock("@/components/configuracoes/novo-membro-drawer", () => ({ NovoMembroDrawer: () => <div /> }));

const mockedGetTenantContext = getTenantContextOuRedirect as jest.Mock;
const mockedListarMembros = membroService.listarMembros as jest.Mock;
const mockedListarPendentes = conviteService.listarPendentes as jest.Mock;
const mockedAssinar = usuarioService.assinarUrlAvatar as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue({ usuarioId: "user-1", escritorioId: "esc-1", role: "owner" });
  mockedListarPendentes.mockResolvedValue([]);
});

describe("ConfiguracoesMembrosPage", () => {
  it("assina o avatarUrl de cada membro antes de passar pra tabela", async () => {
    mockedListarMembros.mockResolvedValue([
      {
        id: "membro-1",
        role: "owner",
        usuario: {
          id: "user-1",
          nome: "Dona Owner",
          email: "owner@teste.com",
          telefone: null,
          avatarUrl: "development/avatares/user-1/foto.png",
        },
      },
    ]);
    mockedAssinar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");

    render(await ConfiguracoesMembrosPage());

    expect(mockedAssinar).toHaveBeenCalledWith("development/avatares/user-1/foto.png");
    expect(screen.getByText("Dona Owner")).toHaveAttribute(
      "data-avatar-url",
      "https://bucket.s3.amazonaws.com/signed-get"
    );
  });
});
