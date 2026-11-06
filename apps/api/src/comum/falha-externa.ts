import { HttpException } from "@nestjs/common";
import type { TradutorDeErro } from "./erros-http.filter";

// Rotas que dependem do storage (URL assinada do S3) respondem 502 — não 500 — quando o
// provedor externo falha, com a mensagem própria da rota. Este tradutor é sempre o
// ÚLTIMO da lista de um @UseFilters por método: o ErrosHttpFilter já tratou antes
// DadosInvalidosError, JSON malformado e erros de tenant, e os tradutores de domínio
// anteriores pegam os erros de regra. O que sobra é falha de infraestrutura.
export function falhaExterna(mensagem: string): TradutorDeErro {
  return (error) => {
    if (error instanceof HttpException) {
      return null;
    }
    console.error(`[api] falha em serviço externo: ${mensagem}`, error);
    return Response.json({ error: mensagem }, { status: 502 });
  };
}
