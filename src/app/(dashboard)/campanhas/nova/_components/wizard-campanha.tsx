"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useCriarCampanha } from "@/hooks/use-campanhas";
import { Button } from "@/components/ui/button";
import {
  extrairVariaveis,
  sugerirMapeamento,
  variaveisNaoMapeadas,
  type ConfigVariavel,
  type MapeamentoVariaveis,
} from "@/lib/utils/campanha-mensagem";
import { PassoCsv, contarNumerosInvalidos, type PlanilhaSelecionada } from "./passo-csv";
import { PassoInstancia } from "./passo-instancia";
import { PassoMensagem } from "./passo-mensagem";
import { PassoRevisao, type DadosRevisao } from "./passo-revisao";

const PASSOS = ["Planilha", "Instância", "Mensagem", "Revisão"] as const;

export function WizardCampanha() {
  const router = useRouter();
  const criar = useCriarCampanha();

  const [passo, setPasso] = useState(0);
  const [planilha, setPlanilha] = useState<PlanilhaSelecionada | null>(null);
  const [colunaNumero, setColunaNumero] = useState("");
  const [instanciaId, setInstanciaId] = useState("");
  const [nomeInstancia, setNomeInstancia] = useState("");
  const [fotoInstancia, setFotoInstancia] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [mapeamento, setMapeamento] = useState<MapeamentoVariaveis>({});
  const [revisao, setRevisao] = useState<DadosRevisao>({
    nome: "",
    delayMin: 3,
    delayMax: 6,
    quandoEnviar: "agora",
    agendadaPara: "",
  });

  const colunas = planilha?.colunas ?? [];
  const linhas = planilha?.linhas ?? [];

  // Trocar de planilha invalida o mapeamento anterior: as colunas mudaram, então tudo é
  // recasado contra o cabeçalho novo.
  function handlePlanilha(nova: PlanilhaSelecionada, colunaSugerida: string | null) {
    setPlanilha(nova);
    setColunaNumero(colunaSugerida ?? "");
    setMapeamento(sugerirMapeamento(extrairVariaveis(mensagem), nova.colunas));
  }

  // O casamento automático roda a cada digitação, mas só preenche variável ainda sem
  // escolha: uma coluna que o usuário selecionou à mão nunca é sobrescrita pela sugestão.
  function handleMensagem(texto: string) {
    setMensagem(texto);
    setMapeamento((atual) => {
      const sugerido = sugerirMapeamento(extrairVariaveis(texto), colunas);
      return Object.fromEntries(
        Object.entries(sugerido).map(([variavel, coluna]) => [
          variavel,
          atual[variavel] ?? coluna,
        ])
      );
    });
  }

  function handleConfigurar(variavel: string, config: ConfigVariavel | null) {
    setMapeamento((atual) => ({ ...atual, [variavel]: config }));
  }

  function handleRevisao<C extends keyof DadosRevisao>(campo: C, valor: DadosRevisao[C]) {
    setRevisao((atual) => ({ ...atual, [campo]: valor }));
  }

  const numerosInvalidos = contarNumerosInvalidos(linhas, colunaNumero);
  const pendentes = variaveisNaoMapeadas(mensagem, mapeamento);

  // Cada passo só libera o próximo quando o que ele coleta está íntegro — a mesma
  // validação que o service repete no servidor.
  const podeAvancar = [
    planilha !== null && colunaNumero !== "" && numerosInvalidos.length === 0,
    instanciaId !== "",
    mensagem.trim() !== "" && pendentes.length === 0,
    revisao.nome.trim() !== "" &&
      revisao.delayMax >= revisao.delayMin &&
      revisao.delayMin >= 1 &&
      (revisao.quandoEnviar === "agora" || revisao.agendadaPara !== ""),
  ][passo];

  async function handleCriar() {
    if (!planilha) return;
    try {
      const { campanha } = await criar.mutateAsync({
        nome: revisao.nome.trim(),
        instanciaId,
        mensagemTemplate: mensagem.trim(),
        colunaNumero,
        // `pendentes` está vazio aqui, então toda config restante tem coluna real.
        mapeamentoVariaveis: Object.fromEntries(
          Object.entries(mapeamento).filter(([, config]) => Boolean(config?.coluna))
        ) as Record<string, ConfigVariavel>,
        delayMin: revisao.delayMin,
        delayMax: revisao.delayMax,
        // O input datetime-local devolve hora local sem fuso; o Date converte para o
        // instante correto antes de virar ISO.
        ...(revisao.quandoEnviar === "agendar"
          ? { agendadaPara: new Date(revisao.agendadaPara).toISOString() }
          : {}),
        arquivoCsvNome: planilha.nomeArquivo,
        linhas: planilha.linhas,
      });

      toast.success(`Campanha criada com ${campanha.totalDestinatarios} destinatário(s).`);
      router.push(`/campanhas/${campanha.id}`);
    } catch (erro) {
      toast.error(erro instanceof ApiError ? erro.message : "Não foi possível criar a campanha.");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Nova campanha</h1>
        <p className="text-sm text-muted-foreground">
          Passo {passo + 1} de {PASSOS.length} — {PASSOS[passo]}
        </p>
      </div>

      <ol className="flex flex-wrap gap-2" aria-label="Etapas da campanha">
        {PASSOS.map((rotulo, indice) => (
          <li
            key={rotulo}
            aria-current={indice === passo ? "step" : undefined}
            className={
              indice === passo
                ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                : "rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
            }
          >
            {indice + 1}. {rotulo}
          </li>
        ))}
      </ol>

      {passo === 0 ? (
        <PassoCsv
          planilha={planilha}
          colunaNumero={colunaNumero}
          onPlanilha={handlePlanilha}
          onColunaNumero={setColunaNumero}
        />
      ) : null}

      {passo === 1 ? (
        <PassoInstancia
          instanciaId={instanciaId}
          onSelecionar={(instancia) => {
            setInstanciaId(instancia.id);
            setNomeInstancia(instancia.nome);
            setFotoInstancia(instancia.fotoPerfilUrl);
          }}
        />
      ) : null}

      {passo === 2 ? (
        <PassoMensagem
          mensagem={mensagem}
          colunas={colunas}
          primeiraLinha={linhas[0]}
          mapeamento={mapeamento}
          remetenteNome={nomeInstancia}
          remetenteFoto={fotoInstancia}
          onMensagem={handleMensagem}
          onConfigurar={handleConfigurar}
        />
      ) : null}

      {passo === 3 ? (
        <PassoRevisao
          dados={revisao}
          totalDestinatarios={linhas.length}
          nomeInstancia={nomeInstancia}
          onMudar={handleRevisao}
        />
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          type="button"
          disabled={passo === 0 || criar.isPending}
          onClick={() => setPasso((atual) => atual - 1)}
        >
          <ArrowLeft />
          Voltar
        </Button>

        {passo < PASSOS.length - 1 ? (
          <Button
            type="button"
            disabled={!podeAvancar}
            onClick={() => setPasso((atual) => atual + 1)}
          >
            Continuar
            <ArrowRight />
          </Button>
        ) : (
          <Button type="button" disabled={!podeAvancar || criar.isPending} onClick={handleCriar}>
            <Send />
            {criar.isPending ? "Criando..." : "Criar campanha"}
          </Button>
        )}
      </div>
    </div>
  );
}
