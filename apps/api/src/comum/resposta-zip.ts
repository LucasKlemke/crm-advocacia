import { pipeline, type Readable } from "node:stream";
import type { Response as ExpressResponse } from "express";
import type { TradutorDeErro } from "./erros-http.filter";

// Resposta não-JSON: o handler usa @Res() e o Nest não serializa nada. Os headers são
// os mesmos das rotas Next (Content-Disposition com o nome cru entre aspas). O
// res.attachment() do Express não é usado porque trocaria o header por filename*.
//
// Quando o stream começa, o 200 já foi enviado: erro no meio do archiver não vira mais
// status HTTP. O pipeline registra o erro no log e destrói a resposta, então o browser
// vê um download interrompido em vez de um zip truncado "com sucesso".
export function responderZip(res: ExpressResponse, zip: Readable, nomeArquivo: string): void {
  res.status(200);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
  pipeline(zip, res, (erro) => {
    if (erro) console.error("Erro ao montar zip de documentos", erro);
  });
}

// Último tradutor das rotas de zip: o que não foi mapeado antes (tenant, 404 do
// cliente/caso) vira 502, igual às rotas Next. Fica só nessas rotas, nunca no filtro
// global, para não mudar o 500 genérico das demais.
export const erroAoGerarZip: TradutorDeErro = (error) => {
  console.error("Erro ao montar zip de documentos", error);
  return Response.json({ error: "Não foi possível gerar o arquivo zip." }, { status: 502 });
};
