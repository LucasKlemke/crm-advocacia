import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Regra de fronteira (docs/app/estrutura-codigo.md) aplicada ao front Vite: o web não
// conhece o Next, a API nem a camada de dados. O código puro que divide com a API (tipos,
// schemas, utils, permissões e enums) vem de @crm/compartilhado.

const RAIZ_WEB = join(__dirname, "..");

function arquivosDoWeb(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivosDoWeb(caminho);
    return /\.(ts|tsx)$/.test(entrada.name) ? [caminho] : [];
  });
}

function motivoDaViolacao(especificador: string): string | null {
  if (/^next(\/|$)/.test(especificador) || especificador.startsWith("next-auth")) {
    return "import do Next — o front é Vite, sem Next";
  }
  if (especificador.startsWith("@dominio/")) {
    return "o domínio mora em apps/api — use @crm/compartilhado (ou uma rota da API)";
  }
  if (especificador === "@prisma/client" || especificador.startsWith("@prisma/")) {
    return "o web não depende do Prisma — use @crm/compartilhado/enums";
  }
  if (especificador.startsWith("@crm/api") || /(^|\/)api\/src\//.test(especificador)) {
    return "o web não importa a API — use uma rota HTTP";
  }
  if (
    /^@\/(types|services|repositories)\//.test(especificador) ||
    /^@\/lib\/(auth|api|external|documentos)\//.test(especificador) ||
    especificador === "@/lib/prisma"
  ) {
    return "módulo de domínio importado como se fosse do web — use @crm/compartilhado (ou uma rota da API)";
  }
  return null;
}

// Só considera string em posição de módulo: `from "x"`, `import "x"`, `import("x")`,
// `jest.mock("x")` e `require("x")`. Uma string comum com o mesmo texto não conta.
function especificadoresDe(codigo: string): string[] {
  const padrao =
    /(?:\bfrom\s+|\bimport\s+|\bimport\s*\(\s*|\bjest\.(?:mock|doMock|unmock|requireActual|requireMock)\(\s*|\brequire\s*\(\s*)(["'])([^"'\n]+)\1/g;
  return [...codigo.matchAll(padrao)].map((casamento) => casamento[2]);
}

function violacoesDoCodigo(codigo: string): string[] {
  return especificadoresDe(codigo).flatMap((especificador) => {
    const motivo = motivoDaViolacao(especificador);
    return motivo ? [`"${especificador}" — ${motivo}`] : [];
  });
}

describe("fronteira do apps/web", () => {
  // Este arquivo traz os módulos proibidos como fixtures de texto; não se auto-audita.
  const arquivos = arquivosDoWeb(join(RAIZ_WEB, "src")).filter(
    (arquivo) => resolve(arquivo) !== __filename
  );

  it("nenhum arquivo importa o Next, o Prisma, a API ou o domínio", () => {
    const problemas = arquivos.flatMap((arquivo) =>
      violacoesDoCodigo(readFileSync(arquivo, "utf8")).map(
        (violacao) => `${relative(RAIZ_WEB, arquivo)}: ${violacao}`
      )
    );

    expect(problemas).toEqual([]);
  });

  describe("detecção", () => {
    it("barra require() de módulo proibido", () => {
      expect(violacoesDoCodigo('const l = require("next-auth");')).toHaveLength(1);
      expect(violacoesDoCodigo("const s = require('@/services/cliente-service');")).toHaveLength(1);
    });

    it("barra o import do próprio Next (especificador montado em runtime)", () => {
      const especificador = "next" + "/link";
      expect(violacoesDoCodigo(`import Link from "${especificador}";`)).toHaveLength(1);
    });

    it("barra import() dinâmico de módulo proibido", () => {
      expect(violacoesDoCodigo('await import("@/services/x")')).toHaveLength(1);
    });

    it("barra o Prisma inteiro, inclusive import type", () => {
      expect(violacoesDoCodigo('import type { RoleMembro } from "@prisma/client";')).toHaveLength(1);
      expect(violacoesDoCodigo('const { PrismaClient } = require("@prisma/client");')).toHaveLength(1);
    });

    it("barra o alias @dominio/ e imports da API", () => {
      expect(violacoesDoCodigo('import { cpfValido } from "@dominio/lib/utils/cpf";')).toHaveLength(1);
      expect(violacoesDoCodigo('import { x } from "../../../api/src/dominio/services/x";')).toHaveLength(1);
      expect(violacoesDoCodigo('import { y } from "@crm/api/criar-app";')).toHaveLength(1);
    });

    it("não acusa strings comuns nem requires permitidos", () => {
      expect(violacoesDoCodigo('const t = "next-auth";')).toEqual([]);
      expect(violacoesDoCodigo('const u = require("@crm/compartilhado/utils/cpf");')).toEqual([]);
    });
  });
});
