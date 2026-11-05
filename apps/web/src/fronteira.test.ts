import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { extrairEspecificadores } from "../scripts/transformar-imports";

// Regra de fronteira (docs/app/estrutura-codigo.md) aplicada ao front Vite: o web não
// conhece o Next nem a camada de dados. Do domínio, só alcança código puro — tipos,
// utils e a hierarquia de papéis — via @dominio/ até a Fase 5.

const RAIZ_WEB = join(__dirname, "..");

function arquivosDoWeb(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivosDoWeb(caminho);
    return /\.(ts|tsx)$/.test(entrada.name) ? [caminho] : [];
  });
}

const DOMINIO_PERMITIDO = [
  /^@dominio\/types\//,
  /^@dominio\/lib\/utils\//,
  /^@dominio\/lib\/auth\/permissoes$/,
];

function motivoDaViolacao(especificador: string): string | null {
  if (/^next(\/|$)/.test(especificador) || especificador.startsWith("next-auth")) {
    return "import do Next — use @/compat/*";
  }
  if (
    especificador.startsWith("@dominio/") &&
    !DOMINIO_PERMITIDO.some((padrao) => padrao.test(especificador))
  ) {
    return "o front só alcança tipos, utils puros e permissões do domínio";
  }
  if (
    /^@\/(types|services|repositories)\//.test(especificador) ||
    /^@\/lib\/(auth|api|external|documentos)\//.test(especificador) ||
    especificador === "@/lib/prisma"
  ) {
    return "módulo de domínio importado como se fosse do web — use @dominio/ (ou uma rota da API)";
  }
  return null;
}

// extrairEspecificadores (codemod) não enxerga require("..."): a guarda soma os dois.
function especificadoresDe(codigo: string): string[] {
  const requires = [...codigo.matchAll(/\brequire\s*\(\s*(["'])([^"'\n]+)\1/g)].map((c) => c[2]);
  return [...extrairEspecificadores(codigo), ...requires];
}

function violacoesDoCodigo(codigo: string): string[] {
  return especificadoresDe(codigo).flatMap((especificador) => {
    const motivo = motivoDaViolacao(especificador);
    return motivo ? [`"${especificador}" — ${motivo}`] : [];
  });
}

function prismaComoValor(codigo: string): boolean {
  return (
    /^\s*import\s+(?!type\b)[^;]*?from\s+["']@prisma\/client["']/m.test(codigo) ||
    /\brequire\s*\(\s*["']@prisma\/client["']/.test(codigo)
  );
}

describe("fronteira do apps/web", () => {
  // Este arquivo traz os módulos proibidos como fixtures de texto; não se auto-audita.
  const arquivos = arquivosDoWeb(join(RAIZ_WEB, "src")).filter(
    (arquivo) => !arquivo.endsWith("fronteira.test.ts")
  );

  it("nenhum arquivo importa o Next ou alcança o domínio fora do permitido", () => {
    const problemas = arquivos.flatMap((arquivo) =>
      violacoesDoCodigo(readFileSync(arquivo, "utf8")).map(
        (violacao) => `${relative(RAIZ_WEB, arquivo)}: ${violacao}`
      )
    );

    expect(problemas).toEqual([]);
  });

  it("@prisma/client só entra como tipo (nunca vai para o bundle)", () => {
    const problemas = arquivos
      .filter((arquivo) => prismaComoValor(readFileSync(arquivo, "utf8")))
      .map((arquivo) => relative(RAIZ_WEB, arquivo));

    expect(problemas).toEqual([]);
  });

  describe("detecção", () => {
    it("barra require() de módulo proibido", () => {
      expect(violacoesDoCodigo('const l = require("next/link");')).toHaveLength(1);
      expect(violacoesDoCodigo("const s = require('@/services/cliente-service');")).toHaveLength(1);
    });

    it("barra require(\"@prisma/client\") de valor", () => {
      expect(prismaComoValor('const { PrismaClient } = require("@prisma/client");')).toBe(true);
    });

    it("barra import de valor de @prisma/client e aceita import type", () => {
      expect(prismaComoValor('import { Role } from "@prisma/client";')).toBe(true);
      expect(prismaComoValor('import type { RoleMembro } from "@prisma/client";')).toBe(false);
    });

    it("não acusa strings comuns nem requires permitidos", () => {
      expect(violacoesDoCodigo('const t = "next/link";')).toEqual([]);
      expect(violacoesDoCodigo('const u = require("@dominio/lib/utils/cpf");')).toEqual([]);
    });
  });
});
