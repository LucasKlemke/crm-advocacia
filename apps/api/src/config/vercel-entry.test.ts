import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// A CLI da Vercel (>= 65) exige que o `entrypoint` do service exista ANTES do build
// (ENTRYPOINT_NOT_FOUND). O dist/main.mjs só nasce no build, então o entrypoint é um
// shim versionado que importa o bundle do tsup.
const raizApi = resolve(__dirname, "../..");
const vercelJson = JSON.parse(readFileSync(resolve(raizApi, "../../vercel.json"), "utf8")) as {
  services: { api: { root: string; entrypoint: string } };
};

describe("entrypoint do service api na Vercel (deploy Supabase)", () => {
  const { root, entrypoint } = vercelJson.services.api;

  it("aponta para um arquivo versionado, não para o build", () => {
    expect(root).toBe("apps/api");
    expect(entrypoint).not.toMatch(/^dist\//);
    expect(existsSync(resolve(raizApi, entrypoint))).toBe(true);
  });

  it("o shim só carrega o bundle de produção dist/main.mjs", () => {
    const codigo = readFileSync(resolve(raizApi, entrypoint), "utf8");
    expect(codigo).toMatch(/^import "\.\/dist\/main\.mjs";$/m);
  });
});
