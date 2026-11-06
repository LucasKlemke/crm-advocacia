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

// Formato antigo, sem o 9º dígito: 55 + DDD + 8 dígitos. Não serve para disparo (RN13),
// mas é o que a UAZAPI devolve como `owner` de muitas instâncias conectadas — sem
// reconhecer aqui, o número da instância aparecia cru na tela.
const FIXO_OU_CELULAR_ANTIGO_BR = /^55([1-9]\d)(\d{4})(\d{4})$/;

// Só apresentação: mascarar não diz nada sobre poder receber disparo, quem decide isso é
// telefoneValido.
export function formatarTelefone(valor: string): string {
  const digitos = normalizarTelefone(valor);

  if (CELULAR_BR.test(digitos)) {
    return `+55 (${digitos.slice(2, 4)}) ${digitos.slice(4, 9)}-${digitos.slice(9)}`;
  }

  const antigo = FIXO_OU_CELULAR_ANTIGO_BR.exec(digitos);
  if (antigo) {
    const [, ddd, inicio, fim] = antigo;
    return `+55 (${ddd}) ${inicio}-${fim}`;
  }

  return valor;
}

// Tenta transformar um número inválido em válido cobrindo os dois erros mais comuns de
// planilha exportada fora do padrão: faltar o DDI (55) e/ou faltar o 9º dígito do celular.
// Só devolve um número diferente quando o resultado passa em telefoneValido — nunca
// adivinha um DDD ou trunca dígitos a mais, porque aí a correção erraria o destinatário.
export function corrigirTelefone(valor: string): string {
  const digitos = normalizarTelefone(valor);
  if (telefoneValido(digitos)) return digitos;

  const comDdi = digitos.startsWith("55") ? digitos : `55${digitos}`;
  if (telefoneValido(comDdi)) return comDdi;

  const semNono = FIXO_OU_CELULAR_ANTIGO_BR.exec(comDdi);
  if (semNono) {
    const [, ddd, inicio, fim] = semNono;
    const comNono = `55${ddd}9${inicio}${fim}`;
    if (telefoneValido(comNono)) return comNono;
  }

  return digitos;
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
