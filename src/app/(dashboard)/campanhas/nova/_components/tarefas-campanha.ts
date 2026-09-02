import {
  extrairVariaveis,
  variaveisNaoMapeadas,
  type MapeamentoVariaveis,
} from "@/lib/utils/campanha-mensagem";

export interface TarefaCampanha {
  id: string;
  rotulo: string;
  concluida: boolean;
}

export interface EstadoCampanha {
  nome: string;
  temInstancia: boolean;
  mensagem: string;
  mapeamento: MapeamentoVariaveis;
  temPlanilha: boolean;
  colunaNumero: string;
  numerosInvalidos: number;
  delayMin: number;
  delayMax: number;
  agendar: boolean;
  agendadaPara: string;
}

// Checklist do que falta para criar a campanha — é o que a tooltip do botão desabilitado
// mostra, e a mesma lista decide se o botão pode ser clicado. A ordem repete a validação
// que o service faz no servidor.
//
// Duas naturezas de item convivem aqui: as *etapas* (nome, conexão, mensagem, planilha...),
// que aparecem sempre que fazem sentido e alternam entre concluída e pendente; e os
// *problemas* (número inválido, intervalo invertido), que só entram na lista enquanto
// existem — marcar como "concluído" um problema que nunca houve seria ruído.
export function montarTarefas(estado: EstadoCampanha): TarefaCampanha[] {
  const temVariaveis = extrairVariaveis(estado.mensagem).length > 0;
  const variaveisPendentes = variaveisNaoMapeadas(estado.mensagem, estado.mapeamento);

  return [
    { id: "nome", rotulo: "Dar um nome à campanha", concluida: estado.nome.trim() !== "" },
    {
      id: "conexao",
      rotulo: "Escolher a conexão que vai disparar",
      concluida: estado.temInstancia,
    },
    { id: "mensagem", rotulo: "Escrever a mensagem", concluida: estado.mensagem.trim() !== "" },
    ...(temVariaveis
      ? [
          {
            id: "variaveis",
            rotulo: "Escolher a coluna de cada variável da mensagem",
            concluida: variaveisPendentes.length === 0,
          },
        ]
      : []),
    {
      id: "planilha",
      rotulo: "Fazer upload da planilha de contatos",
      concluida: estado.temPlanilha,
    },
    ...(estado.temPlanilha
      ? [
          {
            id: "coluna_numero",
            rotulo: "Escolher a coluna com os números",
            concluida: estado.colunaNumero !== "",
          },
        ]
      : []),
    ...(estado.numerosInvalidos > 0
      ? [
          {
            id: "numeros",
            rotulo: `Corrigir ${estado.numerosInvalidos} número(s) inválido(s) da planilha`,
            concluida: false,
          },
        ]
      : []),
    ...(estado.delayMax < estado.delayMin
      ? [
          {
            id: "intervalo",
            rotulo: "Deixar o intervalo máximo maior ou igual ao mínimo",
            concluida: false,
          },
        ]
      : []),
    ...(estado.agendar
      ? [
          {
            id: "agendamento",
            rotulo: "Informar a data e hora do agendamento",
            concluida: estado.agendadaPara !== "",
          },
        ]
      : []),
  ];
}
