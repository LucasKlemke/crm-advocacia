import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { Request, Response as ExpressResponse } from "express";
import { tratarErroDeContexto, respostaDadosInvalidos } from "@dominio/lib/api/erros";
import { DadosInvalidosError } from "./validacao.pipe";

// Os mapeadores de erro de domínio (dominio/lib/api/erros-*.ts) devolvem um Response
// padrão da Web API; o filtro o repassa ao Express. Manter o mapeamento num só lugar,
// independente do framework HTTP, é a decisão atual.
export type TradutorDeErro = (error: unknown) => Response | null;

const MENSAGEM_ERRO_INESPERADO = "Não foi possível concluir a operação.";

const MENSAGEM_CORPO_GRANDE_DEMAIS = "O conteúdo enviado é maior que o permitido.";

// O body-parser lança um http-error com type "entity.too.large" quando o corpo passa do
// limite. O Nest 12 o converte em HttpException 413 (mantendo a mensagem do http-error);
// 413 com mensagem própria de outro módulo não entra aqui.
function corpoGrandeDemais(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ((error as { type?: unknown }).type === "entity.too.large") return true;
  return (
    error instanceof HttpException &&
    error.getStatus() === 413 &&
    error.message === "request entity too large"
  );
}

@Catch()
export class ErrosHttpFilter implements ExceptionFilter {
  // Tradutores são por controller, nunca globais: services diferentes têm classes de
  // erro homônimas (ex.: ClienteNaoEncontradoError) com códigos HTTP diferentes.
  constructor(private readonly tradutores: TradutorDeErro[] = []) {}

  async catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const res = http.getResponse<ExpressResponse>();
    const req = http.getRequest<Request>();

    const traduzida = this.traduzir(error);
    if (traduzida) {
      res.status(traduzida.status).json(await traduzida.json());
      return;
    }

    if (error instanceof HttpException) {
      res.status(error.getStatus()).json({ error: error.message });
      return;
    }

    // Log estruturado no servidor; para o usuário, mensagem sem detalhe técnico.
    console.error(`[api] erro em ${req.method} ${req.originalUrl}`, error);
    res.status(500).json({ error: MENSAGEM_ERRO_INESPERADO });
  }

  private traduzir(error: unknown): Response | null {
    if (corpoGrandeDemais(error)) {
      return Response.json({ error: MENSAGEM_CORPO_GRANDE_DEMAIS }, { status: 413 });
    }
    if (error instanceof DadosInvalidosError) {
      return respostaDadosInvalidos(error.zodError);
    }
    // O body parser do Nest transforma JSON malformado em BadRequestException.
    if (error instanceof HttpException && error.getStatus() === 400) {
      return respostaDadosInvalidos();
    }
    for (const tradutor of [tratarErroDeContexto, ...this.tradutores]) {
      const resposta = tradutor(error);
      if (resposta) return resposta;
    }
    return null;
  }
}
