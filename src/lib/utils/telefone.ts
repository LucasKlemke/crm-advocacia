// Telefone é armazenado só com dígitos, no formato internacional completo
// (55 + DDD + 9 dígitos), porque é assim que a Uazapi identifica o destinatário
// no disparo de WhatsApp (RN13). A máscara existe só na apresentação.
const CELULAR_BR = /^55([1-9]\d)9\d{8}$/;

export function normalizarTelefone(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function telefoneValido(valor: string): boolean {
  return CELULAR_BR.test(normalizarTelefone(valor));
}

export function formatarTelefone(valor: string): string {
  const digitos = normalizarTelefone(valor);
  if (!CELULAR_BR.test(digitos)) return valor;
  return `+55 (${digitos.slice(2, 4)}) ${digitos.slice(4, 9)}-${digitos.slice(9)}`;
}

// Máscara progressiva do campo de digitação. Enquanto o número não começa com 55
// não dá para saber onde termina o DDD, então mostramos os dígitos crus e deixamos
// a mensagem de validação apontar o que falta.
export function mascararTelefone(valor: string): string {
  const digitos = normalizarTelefone(valor).slice(0, 13);
  if (!digitos.startsWith("55")) return digitos;

  const partes = [`+${digitos.slice(0, 2)}`];
  if (digitos.length > 2) partes.push(`(${digitos.slice(2, 4)})`);
  if (digitos.length > 4) partes.push(digitos.slice(4, 9));
  if (digitos.length > 9) partes[partes.length - 1] += `-${digitos.slice(9)}`;
  return partes.join(" ");
}
