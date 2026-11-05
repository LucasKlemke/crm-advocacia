// Roda o payload pela mesma serialização que `Response.json` aplicaria (Date vira
// string ISO, Decimal do Prisma vira seu `toJSON`), para o payload entregue pela API ser
// idêntico ao que o cliente recebe pela rede. Sem isso o cliente
// receberia `Date`/`Decimal` hidratados onde os DTOs prometem `string`/`number`.
export function paraJson<T>(valor: unknown): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}
