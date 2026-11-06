import { z } from "zod";

// Teto de participantes por evento. Existe só para impedir payload adulterado com uma
// lista absurda — está muito acima do tamanho de um escritório real.
const MAX_PARTICIPANTES = 100;

export const tituloEventoSchema = z.string().trim().min(1, "Informe o título do evento.").max(140);
export const descricaoEventoSchema = z.string().trim().max(5000);
export const modalidadeEventoSchema = z.enum(["presencial", "online"], {
  message: "Modalidade inválida.",
});
export const localEventoSchema = z.string().trim().min(1, "Informe o local.").max(255);
export const linkReuniaoSchema = z
  .string()
  .trim()
  .max(500)
  .refine((valor) => /^https?:\/\//i.test(valor) && z.url().safeParse(valor).success, {
    message: "Informe um link de reunião válido (começando com http:// ou https://).",
  });

const dataHoraSchema = z.iso.datetime({ message: "Data e hora inválidas." });

// Campos do evento. Ordem/nomes espelham as colunas de `evento` para o Service poder
// repassar o objeto sem tradução. Nenhum campo tem `.default()` aqui: no PATCH, um
// default sobrevive ao `.partial()` e chega ao Service como se o usuário tivesse enviado
// o valor — um PATCH só de título zeraria a lista de participantes e desligaria o "dia
// inteiro". Os defaults ficam apenas no schema de criação, onde de fato são defaults.
const camposEvento = {
  titulo: tituloEventoSchema,
  descricao: descricaoEventoSchema.nullish(),
  inicio: dataHoraSchema,
  fim: dataHoraSchema,
  diaInteiro: z.boolean(),
  modalidade: modalidadeEventoSchema,
  local: localEventoSchema.nullish(),
  linkReuniao: linkReuniaoSchema.nullish(),
  // `null` é desvincular explicitamente; ausente, no PATCH, é "não mexe no vínculo".
  casoId: z.uuid("Processo inválido.").nullish(),
  clienteId: z.uuid("Cliente inválido.").nullish(),
  participanteMembroIds: z.array(z.uuid("Participante inválido.")).max(MAX_PARTICIPANTES),
};

// RN31: o vínculo é exclusivo — um evento aponta para um processo OU para um cliente,
// nunca para os dois. Checável aqui porque não depende do estado gravado.
function validarVinculoExclusivo(
  dados: { casoId?: string | null; clienteId?: string | null },
  ctx: z.RefinementCtx
): void {
  if (dados.casoId && dados.clienteId) {
    ctx.addIssue({
      code: "custom",
      path: ["clienteId"],
      message: "Vincule o evento a um processo ou a um cliente, não aos dois.",
    });
  }
}

// RN35: `fim` posterior a `inicio`. Evento de dia inteiro é a exceção — o Service
// normaliza a faixa para o dia todo, então início e fim iguais são legítimos.
function validarPeriodo(
  dados: { inicio?: string; fim?: string; diaInteiro?: boolean },
  ctx: z.RefinementCtx
): void {
  if (!dados.inicio || !dados.fim) {
    return;
  }
  const inicio = new Date(dados.inicio).getTime();
  const fim = new Date(dados.fim).getTime();
  const valido = dados.diaInteiro ? fim >= inicio : fim > inicio;
  if (!valido) {
    ctx.addIssue({
      code: "custom",
      path: ["fim"],
      message: "O fim do evento precisa ser depois do início.",
    });
  }
}

// RN32: cada modalidade tem um campo obrigatório diferente.
function validarModalidade(
  dados: { modalidade?: "presencial" | "online"; local?: string | null; linkReuniao?: string | null },
  ctx: z.RefinementCtx
): void {
  if (dados.modalidade === "presencial" && !dados.local) {
    ctx.addIssue({ code: "custom", path: ["local"], message: "Informe o local do evento." });
  }
  if (dados.modalidade === "online" && !dados.linkReuniao) {
    ctx.addIssue({
      code: "custom",
      path: ["linkReuniao"],
      message: "Informe o link da reunião.",
    });
  }
}

export const novoEventoSchema = z
  .object({
    ...camposEvento,
    diaInteiro: camposEvento.diaInteiro.default(false),
    participanteMembroIds: camposEvento.participanteMembroIds.default([]),
  })
  .superRefine((dados, ctx) => {
    validarVinculoExclusivo(dados, ctx);
    validarPeriodo(dados, ctx);
    validarModalidade(dados, ctx);
  });

// No PATCH os pares só podem ser conferidos quando os dois lados vêm no payload — a
// validação contra o valor já gravado (ex.: mudar só a modalidade) é do EventoService,
// que é quem conhece o estado atual do evento.
export const edicaoEventoSchema = z
  .object(camposEvento)
  .partial()
  .superRefine((dados, ctx) => {
    validarVinculoExclusivo(dados, ctx);
    validarPeriodo(dados, ctx);
  });

// Período pedido pela agenda: ?inicio=&fim=. Ambos obrigatórios — sem faixa não há
// consulta possível, e um default silencioso esconderia bug de navegação na UI.
export const filtrosEventosSchema = z
  .object({ inicio: dataHoraSchema, fim: dataHoraSchema })
  .refine((dados) => new Date(dados.fim).getTime() > new Date(dados.inicio).getTime(), {
    message: "O fim do período precisa ser depois do início.",
    path: ["fim"],
  });

export function parseFiltrosEventosDaQuery(searchParams: URLSearchParams) {
  return filtrosEventosSchema.safeParse({
    inicio: searchParams.get("inicio") ?? undefined,
    fim: searchParams.get("fim") ?? undefined,
  });
}
