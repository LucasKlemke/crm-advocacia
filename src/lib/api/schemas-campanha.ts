import { z } from "zod";
import { nomeArquivoSchema } from "@/lib/api/schemas-comuns";
import { TRATAMENTOS_DISPONIVEIS, type Tratamento } from "@/lib/utils/campanha-tratamentos";

// Teto de destinatários por campanha. Segura o tamanho do body (o CSV inteiro trafega
// como JSON) e o tempo da transação que grava os itens; está na mesma ordem de grandeza
// do volume por escritório previsto nos requisitos não funcionais.
export const MAX_DESTINATARIOS = 5000;

// Delay entre mensagens, em segundos — a UAZAPI usa isso para espaçar o envio e reduzir
// o risco de bloqueio do número.
const delaySchema = z.number().int().min(1).max(600);

const linhaCsvSchema = z.record(z.string(), z.string());

// Deriva do catálogo em vez de repetir a lista: um tratamento novo passa a ser aceito
// pela API no mesmo commit em que aparece na UI, sem chance de as duas divergirem.
const tratamentoSchema = z.enum(
  TRATAMENTOS_DISPONIVEIS.map((t) => t.id) as [Tratamento, ...Tratamento[]],
  { message: "Tratamento de variável inválido." }
);

// Como cada {{variavel}} é preenchida. O teto de tratamentos é generoso de propósito:
// existe só para impedir cadeia absurda vinda de payload adulterado.
const configVariavelSchema = z.object({
  coluna: z.string().trim().min(1, "Escolha a coluna da variável.").max(120),
  tratamentos: z.array(tratamentoSchema).max(8).default([]),
  padrao: z.string().trim().max(120).optional(),
});

export const novaCampanhaSchema = z
  .object({
    nome: z.string().trim().min(1, "Informe o nome da campanha.").max(120),
    instanciaId: z.uuid("Selecione a instância que vai disparar."),
    mensagemTemplate: z.string().trim().min(1, "Escreva a mensagem da campanha.").max(4096),
    colunaNumero: z.string().trim().min(1, "Escolha a coluna com os números.").max(120),
    // {{variavel}} -> nome da coluna do CSV. Quais variáveis precisam estar aqui depende
    // do texto da mensagem, então a checagem de completude fica no Service.
    mapeamentoVariaveis: z.record(z.string(), configVariavelSchema).default({}),
    delayMin: delaySchema,
    delayMax: delaySchema,
    // Ausente = a UAZAPI enfileira para envio imediato.
    agendadaPara: z.iso.datetime({ message: "Data de agendamento inválida." }).optional(),
    arquivoCsvNome: nomeArquivoSchema.optional(),
    linhas: z
      .array(linhaCsvSchema)
      .min(1, "A planilha precisa ter pelo menos um destinatário.")
      .max(MAX_DESTINATARIOS, `Máximo de ${MAX_DESTINATARIOS} destinatários por campanha.`),
  })
  .refine((dados) => dados.delayMax >= dados.delayMin, {
    message: "O delay máximo precisa ser maior ou igual ao mínimo.",
    path: ["delayMax"],
  });

export const acaoCampanhaSchema = z.object({
  acao: z.enum(["stop", "continue", "delete"], { message: "Ação inválida." }),
});

// ?pagina=2 na listagem de itens da campanha.
export const paginaCampanhaSchema = z.coerce.number().int().min(1).catch(1);
