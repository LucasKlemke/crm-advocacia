import {
  UTILS_DO_DOMINIO,
  extrairEspecificadores,
  transformarImports,
  trocarEspecificador,
} from "./transformar-imports";

describe("trocarEspecificador", () => {
  it.each([
    ["next/navigation", "@/compat/next-navigation"],
    ["next/link", "@/compat/next-link"],
    ["next/image", "@/compat/next-image"],
    ["@/lib/auth/cliente-sessao", "@/lib/sessao"],
    ["@/lib/auth/permissoes", "@dominio/lib/auth/permissoes"],
    ["@/lib/utils/cpf", "@dominio/lib/utils/cpf"],
    ["@/types/caso", "@dominio/types/caso"],
  ])("%s → %s", (de, para) => {
    expect(trocarEspecificador(de)).toBe(para);
  });

  it.each(["@/lib/utils", "@/lib/utils/data", "@/components/ui/button", "react", "./local"])(
    "mantém %s",
    (especificador) => {
      expect(trocarEspecificador(especificador)).toBe(especificador);
    }
  );
});

describe("transformarImports", () => {
  it("reescreve imports, re-exports e mocks do Jest", () => {
    const antes = [
      'import { useRouter } from "next/navigation";',
      "import Link from 'next/link';",
      'import type { CasoDTO } from "@/types/caso";',
      'export type { ComentarioDTO } from "@/types/comentario";',
      'jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));',
      'const real = jest.requireActual("next/navigation");',
    ].join("\n");

    expect(transformarImports(antes)).toBe(
      [
        'import { useRouter } from "@/compat/next-navigation";',
        "import Link from '@/compat/next-link';",
        'import type { CasoDTO } from "@dominio/types/caso";',
        'export type { ComentarioDTO } from "@dominio/types/comentario";',
        'jest.mock("@/compat/next-navigation", () => ({ useRouter: jest.fn() }));',
        'const real = jest.requireActual("@/compat/next-navigation");',
      ].join("\n")
    );
  });

  it("não mexe em strings fora de posição de import", () => {
    const codigo = 'const rota = "next/link";\nconst tipo = "@/types/caso";';

    expect(transformarImports(codigo)).toBe(codigo);
  });

  it("é idempotente", () => {
    const codigo = 'import Image from "next/image";\nimport { formatarCpf } from "@/lib/utils/cpf";';
    const umaVez = transformarImports(codigo);

    expect(transformarImports(umaVez)).toBe(umaVez);
  });
});

describe("extrairEspecificadores", () => {
  it("lista os módulos importados, inclusive side-effect e import dinâmico", () => {
    const codigo = [
      'import "./estilo.css";',
      'import type { RoleMembro } from "@prisma/client";',
      'const modulo = await import("./preguicoso");',
    ].join("\n");

    expect(extrairEspecificadores(codigo)).toEqual(["./estilo.css", "@prisma/client", "./preguicoso"]);
  });
});

it("UTILS_DO_DOMINIO são exatamente os utils usados pelo front e pela API", () => {
  expect([...UTILS_DO_DOMINIO].sort()).toEqual([
    "campanha-mensagem",
    "campanha-status-mensagem",
    "campanha-tratamentos",
    "cores-status",
    "cpf",
    "email",
    "icones-status",
    "telefone",
  ]);
});
