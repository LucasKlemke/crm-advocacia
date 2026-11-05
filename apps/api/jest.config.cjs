// CJS de propósito: o pacote é "type": "module", e o Jest 29 roda em CommonJS.
// O @swc/jest transpila o próprio código, o domínio em ../../src e os pacotes ESM
// (Nest 12, jose e o archiver com suas deps ESM) para CJS.
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.(t|j|mj)s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@nestjs|jose|archiver|zip-stream|compress-commons|crc32-stream|is-stream)/)",
  ],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/../../src/$1" },
  moduleFileExtensions: ["ts", "js", "mjs", "json"],
};
