import {
  NIVEL_ROLE,
  podeGerenciarMembro,
  podeAtribuirRole,
  violaUltimoOwner,
  ehAutoAlvo,
  podeEditarComentario,
  podeModerarComentario,
  podeModerarDocumento,
} from "./permissoes";

describe("permissoes", () => {
  describe("podeGerenciarMembro", () => {
    it.each([
      ["owner", "admin", true],
      ["owner", "padrao", true],
      ["admin", "padrao", true],
      ["admin", "owner", false],
      ["padrao", "admin", false],
      ["owner", "owner", true],
      ["admin", "admin", false],
      ["padrao", "padrao", false],
    ] as const)("ator=%s alvo=%s -> %s", (ator, alvo, esperado) => {
      expect(podeGerenciarMembro(ator, alvo)).toBe(esperado);
    });
  });

  describe("podeAtribuirRole", () => {
    it("apenas owner pode promover a owner", () => {
      expect(podeAtribuirRole("owner", "owner")).toBe(true);
      expect(podeAtribuirRole("admin", "owner")).toBe(false);
      expect(podeAtribuirRole("padrao", "owner")).toBe(false);
    });

    it("owner e admin podem atribuir admin ou padrao", () => {
      expect(podeAtribuirRole("owner", "admin")).toBe(true);
      expect(podeAtribuirRole("admin", "admin")).toBe(true);
      expect(podeAtribuirRole("owner", "padrao")).toBe(true);
      expect(podeAtribuirRole("admin", "padrao")).toBe(true);
    });

    it("padrao nunca atribui nenhum role", () => {
      expect(podeAtribuirRole("padrao", "admin")).toBe(false);
      expect(podeAtribuirRole("padrao", "padrao")).toBe(false);
      expect(podeAtribuirRole("padrao", "owner")).toBe(false);
    });
  });

  describe("violaUltimoOwner", () => {
    it("bloqueia quando alvo é owner e é o único owner", () => {
      expect(violaUltimoOwner("owner", 1)).toBe(true);
    });

    it("permite quando alvo é owner mas há outros owners", () => {
      expect(violaUltimoOwner("owner", 2)).toBe(false);
    });

    it("permite quando alvo não é owner", () => {
      expect(violaUltimoOwner("admin", 1)).toBe(false);
      expect(violaUltimoOwner("padrao", 0)).toBe(false);
    });
  });

  describe("ehAutoAlvo", () => {
    it("true quando ator e alvo são o mesmo usuário", () => {
      expect(ehAutoAlvo("user-1", "user-1")).toBe(true);
    });

    it("false quando são usuários diferentes", () => {
      expect(ehAutoAlvo("user-1", "user-2")).toBe(false);
    });
  });

  describe("podeEditarComentario", () => {
    it("só o autor edita o próprio comentário", () => {
      expect(podeEditarComentario(true)).toBe(true);
      expect(podeEditarComentario(false)).toBe(false);
    });
  });

  describe("podeModerarComentario", () => {
    it("o autor pode excluir o próprio comentário, seja qual for o papel", () => {
      expect(podeModerarComentario("padrao", true)).toBe(true);
    });

    it("owner e admin podem excluir comentário de terceiros", () => {
      expect(podeModerarComentario("owner", false)).toBe(true);
      expect(podeModerarComentario("admin", false)).toBe(true);
    });

    it("padrao não pode excluir comentário de terceiros", () => {
      expect(podeModerarComentario("padrao", false)).toBe(false);
    });
  });

  it("mantém a hierarquia owner > admin > padrao", () => {
    expect(NIVEL_ROLE.owner).toBeGreaterThan(NIVEL_ROLE.admin);
    expect(NIVEL_ROLE.admin).toBeGreaterThan(NIVEL_ROLE.padrao);
  });

  describe("podeModerarDocumento", () => {
    it("o autor do upload pode excluir o próprio documento", () => {
      expect(podeModerarDocumento("padrao", true)).toBe(true);
    });

    it("owner exclui documento de qualquer membro", () => {
      expect(podeModerarDocumento("owner", false)).toBe(true);
    });

    it("admin exclui documento de qualquer membro", () => {
      expect(podeModerarDocumento("admin", false)).toBe(true);
    });

    it("membro padrão não exclui documento alheio", () => {
      expect(podeModerarDocumento("padrao", false)).toBe(false);
    });
  });
});
