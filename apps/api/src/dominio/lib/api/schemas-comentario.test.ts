import {
  filtroComentariosSchema,
  novoComentarioSchema,
  edicaoComentarioSchema,
} from "./schemas-comentario";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("schemas de comentário", () => {
  it("aceita escopo cliente/caso com uuid", () => {
    expect(filtroComentariosSchema.safeParse({ escopo: "caso", escopoId: UUID }).success).toBe(true);
  });

  it("recusa escopo desconhecido e escopoId ausente (null vindo da query)", () => {
    expect(filtroComentariosSchema.safeParse({ escopo: "processo", escopoId: UUID }).success).toBe(false);
    expect(filtroComentariosSchema.safeParse({ escopo: "cliente", escopoId: null }).success).toBe(false);
  });

  it("apara o conteúdo e recusa comentário só com espaços", () => {
    expect(novoComentarioSchema.parse({ escopo: "cliente", escopoId: UUID, conteudo: "  oi  " }).conteudo).toBe("oi");
    const vazio = novoComentarioSchema.safeParse({ escopo: "cliente", escopoId: UUID, conteudo: "   " });
    expect(vazio.success).toBe(false);
    expect(vazio.error?.flatten().fieldErrors.conteudo).toEqual(["Escreva algo antes de comentar."]);
  });

  it("limita o conteúdo a 5000 caracteres na edição", () => {
    expect(edicaoComentarioSchema.safeParse({ conteudo: "a".repeat(5001) }).success).toBe(false);
    expect(edicaoComentarioSchema.safeParse({ conteudo: "  " }).error?.flatten().fieldErrors.conteudo).toEqual([
      "Escreva algo antes de salvar.",
    ]);
  });
});
