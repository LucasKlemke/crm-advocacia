/**
 * @jest-environment node
 */
import { tratarErroDeDocumento } from "./erros-documento";
import {
  DocumentoNaoEncontradoError,
  PermissaoDocumentoError,
  TamanhoInvalidoError,
} from "@/services/documento.service";

describe("tratarErroDeDocumento", () => {
  it("mapeia DocumentoNaoEncontradoError para 404", () => {
    const resposta = tratarErroDeDocumento(new DocumentoNaoEncontradoError());
    expect(resposta?.status).toBe(404);
  });

  it("mapeia PermissaoDocumentoError para 403", () => {
    const resposta = tratarErroDeDocumento(new PermissaoDocumentoError());
    expect(resposta?.status).toBe(403);
  });

  it("mapeia TamanhoInvalidoError para 400", () => {
    const resposta = tratarErroDeDocumento(new TamanhoInvalidoError());
    expect(resposta?.status).toBe(400);
  });

  it("devolve null para erro desconhecido", () => {
    expect(tratarErroDeDocumento(new Error("outra coisa"))).toBeNull();
  });
});
