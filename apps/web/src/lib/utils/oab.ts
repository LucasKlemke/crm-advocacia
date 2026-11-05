// Máscara progressiva do campo de OAB: o prefixo "OAB/" fica fixo fora do input
// (ver InputGroupAddon em NovoEscritorioForm); o usuário digita só a UF (2 letras)
// e o número de registro, formatado em milhar (ex.: "SC 71.025").
export function mascararOab(valor: string): string {
  const limpo = valor.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const partes = limpo.match(/^([A-Z]{0,2})(\d{0,6})/);
  const uf = partes?.[1] ?? "";
  const numero = partes?.[2] ?? "";

  if (!uf && !numero) return "";

  const numeroFormatado = numero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return numero ? `${uf} ${numeroFormatado}` : uf;
}
