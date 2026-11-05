// Validação de forma, não de existência: exige usuário, arroba, domínio e TLD,
// sem espaços. Confirmar que a caixa existe é problema do envio, não do cadastro.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function normalizarEmail(valor: string): string {
  return valor.trim().toLowerCase();
}

export function emailValido(valor: string): boolean {
  return EMAIL.test(normalizarEmail(valor));
}
