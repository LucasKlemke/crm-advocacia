import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { Request, Response as ExpressResponse } from "express";
import { tratarErroDeContexto, respostaDadosInvalidos } from "@/lib/api/erros";
import { DadosInvalidosError } from "./validacao.pipe";

// Os mapeadores de erro de domínio em src/lib/api/erros-*.ts devolvem um Response
// (NextResponse estende Response). Reaproveitá-los aqui mantém um mapeamento só
// enquanto Next e Nest convivem; na Fase 5 eles viram tradutores nativos do Nest.
export type TradutorDeErro = (error: unknown) => Response | null;

const MENSAGEM_ERRO_INESPERADO = "Não foi possível concluir a operação.";

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
