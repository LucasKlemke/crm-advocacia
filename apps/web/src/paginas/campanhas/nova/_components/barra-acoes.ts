// Classe única de todo controle da barra de ações (nome, conexão, mensagem, contatos,
// intervalo, agendamento, criar). Vive num módulo próprio porque quatro componentes
// diferentes da barra precisam dela — importar do formulário criaria ciclo de import.
//
// `h-10` é acima da escala do design system (o maior botão é `h-9`) porque esta barra é o
// controle principal da página, e não um controle denso de tabela.
export const CLASSE_ITEM_BARRA = "h-10 px-3";
