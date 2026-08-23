// Roda o payload pela mesma serialização que `NextResponse.json` aplicaria (Date vira
// string ISO, Decimal do Prisma vira seu `toJSON`), para o prefetch no servidor entregar
// ao React Query um objeto idêntico ao que a rota HTTP devolveria. Sem isso o cliente
// receberia `Date`/`Decimal` hidratados onde os DTOs prometem `string`/`number`.
export function paraJson<T>(valor: unknown): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}
