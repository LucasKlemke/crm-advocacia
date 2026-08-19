// CPF é armazenado sem máscara (11 dígitos) e formatado só na apresentação —
// assim a unicidade por escritório (RN05) não depende de como o usuário digitou.
export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function formatarCpf(valor: string): string {
  const digitos = normalizarCpf(valor);
  if (digitos.length !== 11) return valor;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

function digitoVerificador(digitos: string, pesoInicial: number): number {
  const soma = digitos
    .split("")
    .reduce((acc, digito, indice) => acc + Number(digito) * (pesoInicial - indice), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function cpfValido(valor: string): boolean {
  const digitos = normalizarCpf(valor);
  if (digitos.length !== 11) return false;
  // Sequências como 111.111.111-11 satisfazem o cálculo, mas não existem na Receita.
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  return (
    digitoVerificador(digitos.slice(0, 9), 10) === Number(digitos[9]) &&
    digitoVerificador(digitos.slice(0, 10), 11) === Number(digitos[10])
  );
}
