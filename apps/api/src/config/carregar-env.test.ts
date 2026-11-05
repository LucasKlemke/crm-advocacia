import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carregarEnvLocal } from "./carregar-env";

describe("carregarEnvLocal", () => {
  const original = { ...process.env };
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "crm-env-"));
    delete process.env.VERCEL;
    delete process.env.CRM_TESTE_A;
    delete process.env.CRM_TESTE_B;
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it("lê .env.local com prioridade sobre .env", () => {
    writeFileSync(join(dir, ".env"), "CRM_TESTE_A=do-env\nCRM_TESTE_B=so-no-env\n");
    writeFileSync(join(dir, ".env.local"), "CRM_TESTE_A=do-local\n");

    carregarEnvLocal(dir);

    expect(process.env.CRM_TESTE_A).toBe("do-local");
    expect(process.env.CRM_TESTE_B).toBe("so-no-env");
  });

  it("não sobrescreve variável já definida no ambiente", () => {
    process.env.CRM_TESTE_A = "do-ambiente";
    writeFileSync(join(dir, ".env"), "CRM_TESTE_A=do-arquivo\n");

    carregarEnvLocal(dir);

    expect(process.env.CRM_TESTE_A).toBe("do-ambiente");
  });

  it("não lê arquivo nenhum na Vercel", () => {
    process.env.VERCEL = "1";
    writeFileSync(join(dir, ".env"), "CRM_TESTE_A=do-arquivo\n");

    carregarEnvLocal(dir);

    expect(process.env.CRM_TESTE_A).toBeUndefined();
  });
});
