/**
 * @jest-environment node
 */
import { cookies } from "next/headers";
import { lerSessaoDoServidor, obterUsuarioDaSessao } from "./sessao-servidor";
import { assinarSessao } from "./sessao-jwt";
import { usuarioService } from "@/services/usuario.service";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/services/usuario.service", () => ({ usuarioService: { obterPerfil: jest.fn() } }));

const mockedCookies = cookies as jest.Mock;
const mockedObterPerfil = usuarioService.obterPerfil as jest.Mock;

function comCookie(valor: string | undefined) {
  mockedCookies.mockResolvedValue({ get: (nome: string) => (nome === "crm_sessao" && valor ? { value: valor } : undefined) });
}

describe("sessao-servidor", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "segredo-de-teste-com-pelo-menos-32-caracteres";
  });
  afterEach(() => jest.clearAllMocks());

  it("lerSessaoDoServidor devolve a sessão do cookie crm_sessao", async () => {
    comCookie(await assinarSessao({ sub: "user-1", escritorioId: "esc-1" }));

    await expect(lerSessaoDoServidor()).resolves.toEqual({ sub: "user-1", escritorioId: "esc-1" });
  });

  it("lerSessaoDoServidor devolve null sem cookie ou com cookie inválido", async () => {
    comCookie(undefined);
    await expect(lerSessaoDoServidor()).resolves.toBeNull();

    comCookie("a.b.c");
    await expect(lerSessaoDoServidor()).resolves.toBeNull();
  });

  it("obterUsuarioDaSessao lê nome/e-mail do banco (o JWT não carrega esses dados)", async () => {
    comCookie(await assinarSessao({ sub: "user-1", escritorioId: "esc-1" }));
    mockedObterPerfil.mockResolvedValue({ id: "user-1", nome: "Fulana", email: "f@t.com", ativo: true });

    await expect(obterUsuarioDaSessao()).resolves.toEqual({ id: "user-1", nome: "Fulana", email: "f@t.com" });
    expect(mockedObterPerfil).toHaveBeenCalledWith("user-1");
  });

  it("obterUsuarioDaSessao devolve null para usuário inativo ou removido", async () => {
    comCookie(await assinarSessao({ sub: "user-1", escritorioId: "esc-1" }));

    mockedObterPerfil.mockResolvedValue({ id: "user-1", nome: "F", email: "f@t.com", ativo: false });
    await expect(obterUsuarioDaSessao()).resolves.toBeNull();

    mockedObterPerfil.mockResolvedValue(null);
    await expect(obterUsuarioDaSessao()).resolves.toBeNull();
  });

  it("obterUsuarioDaSessao não consulta o banco sem sessão", async () => {
    comCookie(undefined);

    await expect(obterUsuarioDaSessao()).resolves.toBeNull();
    expect(mockedObterPerfil).not.toHaveBeenCalled();
  });
});
