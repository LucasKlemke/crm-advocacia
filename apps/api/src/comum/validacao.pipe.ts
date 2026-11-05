import type { PipeTransform } from "@nestjs/common";
import type { ZodError, ZodType } from "zod";

// Erro de forma do payload. O ErrosHttpFilter converte para o mesmo corpo que as rotas
// Next devolvem: { error: "Dados inválidos", detalhes: { campo: [mensagens] } }.
export class DadosInvalidosError extends Error {
  constructor(readonly zodError?: ZodError) {
    super("Dados inválidos");
    this.name = "DadosInvalidosError";
  }
}

// Reaproveita os schemas Zod de dominio/lib/api/schemas-*.ts — a validação continua sendo
// definida num lugar só, compartilhado com o front.
export class ValidacaoZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(valor: unknown): T {
    const parsed = this.schema.safeParse(valor);
    if (!parsed.success) {
      throw new DadosInvalidosError(parsed.error);
    }
    return parsed.data;
  }
}
