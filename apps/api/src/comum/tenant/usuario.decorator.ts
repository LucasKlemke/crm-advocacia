import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestComUsuario } from "./usuario.guard";

// Só é válido em handlers protegidos por UsuarioGuard — sem ele, falha alto em vez de
// devolver undefined e deixar o service operar sobre "usuário nenhum".
export const UsuarioId = createParamDecorator((_dado: unknown, context: ExecutionContext): string => {
  const usuarioId = context.switchToHttp().getRequest<RequestComUsuario>().usuarioId;
  if (!usuarioId) {
    throw new Error("@UsuarioId() usado sem UsuarioGuard.");
  }
  return usuarioId;
});
