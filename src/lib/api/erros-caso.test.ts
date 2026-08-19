/**
 * @jest-environment node
 */
import { tratarErroDeCaso } from "./erros-caso";
import { CasoNaoEncontradoError, ClienteInativoError, ResponsavelInvalidoError } from "@/services/caso.service";
import { ClienteNaoEncontradoError } from "@/services/cliente.service";
import { StatusNaoEncontradoError } from "@/services/status.service";

async function status(error: unknown) {
  const resposta = tratarErroDeCaso(error);
  return resposta?.status;
}

describe("tratarErroDeCaso", () => {
  it("mapeia CasoNaoEncontradoError para 404", async () => {
    expect(await status(new CasoNaoEncontradoError())).toBe(404);
  });

  it("mapeia ClienteNaoEncontradoError (reusado de clienteService) para 404", async () => {
    expect(await status(new ClienteNaoEncontradoError())).toBe(404);
  });

  it("mapeia StatusNaoEncontradoError (reusado de statusService) para 404", async () => {
    expect(await status(new StatusNaoEncontradoError())).toBe(404);
  });

  it("mapeia ClienteInativoError para 400", async () => {
    expect(await status(new ClienteInativoError())).toBe(400);
  });

  it("mapeia ResponsavelInvalidoError para 400", async () => {
    expect(await status(new ResponsavelInvalidoError())).toBe(400);
  });

  it("devolve null para erro desconhecido", () => {
    expect(tratarErroDeCaso(new Error("outro"))).toBeNull();
  });
});
