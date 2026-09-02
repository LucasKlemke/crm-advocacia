import { montarTarefas, type EstadoCampanha } from "./tarefas-campanha";

function estado(over: Partial<EstadoCampanha> = {}): EstadoCampanha {
  return {
    nome: "Retomada",
    temInstancia: true,
    mensagem: "Olá {{nome}}",
    mapeamento: { nome: { coluna: "Nome", tratamentos: [] } },
    temPlanilha: true,
    colunaNumero: "numero",
    numerosInvalidos: 0,
    delayMin: 3,
    delayMax: 6,
    agendar: false,
    agendadaPara: "",
    ...over,
  };
}

function pendentes(over: Partial<EstadoCampanha> = {}): string[] {
  return montarTarefas(estado(over))
    .filter((tarefa) => !tarefa.concluida)
    .map((tarefa) => tarefa.id);
}

describe("montarTarefas", () => {
  it("não deixa nenhuma pendência quando tudo está preenchido", () => {
    expect(pendentes()).toEqual([]);
  });

  it("marca como concluída cada etapa já preenchida", () => {
    const tarefas = montarTarefas(estado({ nome: "" }));

    expect(tarefas.find((tarefa) => tarefa.id === "nome")?.concluida).toBe(false);
    expect(tarefas.find((tarefa) => tarefa.id === "conexao")?.concluida).toBe(true);
    expect(tarefas.find((tarefa) => tarefa.id === "mensagem")?.concluida).toBe(true);
  });

  it("cobra nome, conexão, mensagem e planilha num formulário vazio", () => {
    expect(
      pendentes({
        nome: "",
        temInstancia: false,
        mensagem: "",
        mapeamento: {},
        temPlanilha: false,
        colunaNumero: "",
      })
    ).toEqual(["nome", "conexao", "mensagem", "planilha"]);
  });

  it("cobra a coluna da variável que ficou sem mapeamento", () => {
    expect(pendentes({ mensagem: "Olá {{apelido}}", mapeamento: { apelido: null } })).toEqual([
      "variaveis",
    ]);
  });

  // Sem variável no texto não existe coluna para escolher — a tarefa nem aparece.
  it("não lista a tarefa de variáveis quando a mensagem não tem nenhuma", () => {
    const ids = montarTarefas(estado({ mensagem: "Texto fixo", mapeamento: {} })).map((t) => t.id);

    expect(ids).not.toContain("variaveis");
  });

  it("só cobra a coluna do número depois que existe planilha", () => {
    const semPlanilha = montarTarefas(estado({ temPlanilha: false, colunaNumero: "" }));
    expect(semPlanilha.map((tarefa) => tarefa.id)).not.toContain("coluna_numero");

    expect(pendentes({ colunaNumero: "" })).toEqual(["coluna_numero"]);
  });

  it("aparece só quando existe problema: números inválidos, intervalo e agendamento", () => {
    const semProblema = montarTarefas(estado()).map((tarefa) => tarefa.id);
    expect(semProblema).not.toContain("numeros");
    expect(semProblema).not.toContain("intervalo");
    expect(semProblema).not.toContain("agendamento");

    expect(pendentes({ numerosInvalidos: 3 })).toEqual(["numeros"]);
    expect(pendentes({ delayMin: 10, delayMax: 4 })).toEqual(["intervalo"]);
    expect(pendentes({ agendar: true, agendadaPara: "" })).toEqual(["agendamento"]);
  });

  it("conclui o agendamento quando a data foi informada", () => {
    expect(pendentes({ agendar: true, agendadaPara: "2026-09-10T09:00" })).toEqual([]);
  });

  it("diz quantos números estão inválidos", () => {
    const tarefa = montarTarefas(estado({ numerosInvalidos: 3 })).find((t) => t.id === "numeros");

    expect(tarefa?.rotulo).toMatch(/3 número\(s\) inválido\(s\)/i);
  });
});
