/**
 * @jest-environment node
 */
import { Decimal } from "@prisma/client/runtime/library";
import { paraJson } from "./json";

describe("paraJson", () => {
  it("converte Date para string ISO, como NextResponse.json faria", () => {
    const resultado = paraJson<{ createdAt: string }>({ createdAt: new Date("2026-08-22T12:00:00Z") });

    expect(resultado.createdAt).toBe("2026-08-22T12:00:00.000Z");
  });

  it("converte Decimal do Prisma para o mesmo valor serializado pela rota", () => {
    const resultado = paraJson<{ valor: string | number }>({ valor: new Decimal("1500.5") });

    expect(typeof resultado.valor).not.toBe("object");
    expect(Number(resultado.valor)).toBe(1500.5);
  });

  it("preserva null e estruturas aninhadas", () => {
    const entrada = { a: null, b: [{ c: new Date("2026-01-01T00:00:00Z") }] };

    expect(paraJson(entrada)).toEqual({ a: null, b: [{ c: "2026-01-01T00:00:00.000Z" }] });
  });
});
