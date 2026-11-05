// CJS de propósito: o pacote é "type": "module" e o Jest 29 roda em CommonJS.
// O compartilhado é puro (sem I/O), então os testes rodam em ambiente node.
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      { jsc: { parser: { syntax: "typescript" } }, module: { type: "commonjs" } },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  // tipos/ só tem interfaces (sem código executável) e enums.ts é coberto pelo próprio teste.
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts", "!src/tipos/**"],
  coverageReporters: ["text-summary", "lcov", "json-summary"],
  // Grupo "backend" do piso institucional (validação usada pela API): mesma meta
  // interna dos Services, porque tudo aqui é função pura.
  coverageThreshold: {
    global: { branches: 85, functions: 90, lines: 90, statements: 90 },
  },
};
