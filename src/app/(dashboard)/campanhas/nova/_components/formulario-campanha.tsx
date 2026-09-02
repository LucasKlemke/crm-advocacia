"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, Send, Upload } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useCriarCampanha } from "@/hooks/use-campanhas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  extrairVariaveis,
  sugerirMapeamento,
  variaveisNaoMapeadas,
  type ConfigVariavel,
  type MapeamentoVariaveis,
} from "@/lib/utils/campanha-mensagem";
import { CsvInvalidoError, lerPlanilha, sugerirColunaNumero } from "@/lib/utils/csv-campanha";
import { SeletorInstancia, type InstanciaEscolhida } from "./seletor-instancia";
import { SecaoMensagem, ID_CAMPO_MENSAGEM } from "./secao-mensagem";
import { SecaoContatos, contarNumerosInvalidos, type PlanilhaSelecionada } from "./secao-contatos";
import { PopoverAgendamento, PopoverIntervalo, type ConfigEnvio } from "./popover-envio";

export function FormularioCampanha() {
  const router = useRouter();
  const criar = useCriarCampanha();

  const inputArquivo = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState("");
  const [instancia, setInstancia] = useState<InstanciaEscolhida | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [mapeamento, setMapeamento] = useState<MapeamentoVariaveis>({});
  const [planilha, setPlanilha] = useState<PlanilhaSelecionada | null>(null);
  const [colunaNumero, setColunaNumero] = useState("");
  const [lendo, setLendo] = useState(false);
  const [erroPlanilha, setErroPlanilha] = useState<string | null>(null);
  const [envio, setEnvio] = useState<ConfigEnvio>({
    delayMin: 3,
    delayMax: 6,
    quandoEnviar: "agora",
    agendadaPara: "",
  });

  const colunas = planilha?.colunas ?? [];
  const linhas = planilha?.linhas ?? [];

  async function handleArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setErroPlanilha(null);
    setLendo(true);
    try {
      const lida = await lerPlanilha(arquivo);
      setPlanilha({ nomeArquivo: arquivo.name, colunas: lida.colunas, linhas: lida.linhas });
      setColunaNumero(sugerirColunaNumero(lida.colunas) ?? "");
      // Trocar de planilha invalida o mapeamento anterior: as colunas mudaram, então tudo
      // é recasado contra o cabeçalho novo.
      setMapeamento(sugerirMapeamento(extrairVariaveis(mensagem), lida.colunas));
    } catch (falha) {
      setErroPlanilha(
        falha instanceof CsvInvalidoError ? falha.message : "Não foi possível ler a planilha."
      );
    } finally {
      setLendo(false);
    }
  }

  // O casamento automático roda a cada digitação, mas só preenche variável ainda sem
  // escolha: uma coluna que o usuário selecionou à mão nunca é sobrescrita pela sugestão.
  function handleMensagem(texto: string) {
    setMensagem(texto);
    setMapeamento((atual) => {
      const sugerido = sugerirMapeamento(extrairVariaveis(texto), colunas);
      return Object.fromEntries(
        Object.entries(sugerido).map(([variavel, config]) => [variavel, atual[variavel] ?? config])
      );
    });
  }

  function handleEnvio<C extends keyof ConfigEnvio>(campo: C, valor: ConfigEnvio[C]) {
    setEnvio((atual) => ({ ...atual, [campo]: valor }));
  }

  function focarMensagem() {
    const campo = document.getElementById(ID_CAMPO_MENSAGEM);
    campo?.scrollIntoView({ behavior: "smooth", block: "center" });
    campo?.focus();
  }

  const numerosInvalidos = contarNumerosInvalidos(linhas, colunaNumero);
  const pendentes = variaveisNaoMapeadas(mensagem, mapeamento);

  // Mesma validação que o service repete no servidor. O primeiro item não atendido também
  // é o que o botão explica no title, para "Criar campanha" desabilitado não ser um mistério.
  const impedimento =
    nome.trim() === ""
      ? "Dê um nome à campanha."
      : !instancia
        ? "Escolha a conexão que vai disparar."
        : mensagem.trim() === ""
          ? "Escreva a mensagem."
          : pendentes.length > 0
            ? "Escolha a coluna de cada variável da mensagem."
            : !planilha
              ? "Faça o upload da planilha de contatos."
              : colunaNumero === ""
                ? "Escolha a coluna com os números."
                : numerosInvalidos.length > 0
                  ? "Corrija os números inválidos da planilha."
                  : envio.delayMax < envio.delayMin
                    ? "O intervalo máximo precisa ser maior ou igual ao mínimo."
                    : envio.quandoEnviar === "agendar" && envio.agendadaPara === ""
                      ? "Informe a data e hora do agendamento."
                      : null;

  async function handleCriar() {
    if (!planilha || !instancia || impedimento) return;
    try {
      const { campanha } = await criar.mutateAsync({
        nome: nome.trim(),
        instanciaId: instancia.id,
        mensagemTemplate: mensagem.trim(),
        colunaNumero,
        // `pendentes` está vazio aqui, então toda config restante tem coluna real.
        mapeamentoVariaveis: Object.fromEntries(
          Object.entries(mapeamento).filter(([, config]) => Boolean(config?.coluna))
        ) as Record<string, ConfigVariavel>,
        delayMin: envio.delayMin,
        delayMax: envio.delayMax,
        // O input datetime-local devolve hora local sem fuso; o Date converte para o
        // instante correto antes de virar ISO.
        ...(envio.quandoEnviar === "agendar"
          ? { agendadaPara: new Date(envio.agendadaPara).toISOString() }
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
      <input
        ref={inputArquivo}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Arquivo CSV"
        onChange={(evento) => handleArquivo(evento.target.files?.[0])}
      />

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Voltar para campanhas"
          render={<Link href="/campanhas" />}
        >
          <ArrowLeft />
        </Button>
        <h1 className="text-xl font-semibold">Nova campanha de disparos</h1>
      </div>

      {/* Barra de ações: tudo que a campanha precisa numa linha só, em vez de etapas. Cada
          pílula é o próprio controle (nome, conexão, intervalo, agendamento) ou um atalho
          para a seção correspondente (mensagem, contatos). */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-11 w-56"
          maxLength={120}
          placeholder="Nome da campanha"
          aria-label="Nome da campanha"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
        />

        <SeletorInstancia
          instanciaId={instancia?.id ?? ""}
          onSelecionar={(escolhida) => setInstancia(escolhida)}
        />

        <Button type="button" variant="outline" className="h-11" onClick={focarMensagem}>
          <MessageSquare />
          Escrever mensagem
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={lendo}
          onClick={() => inputArquivo.current?.click()}
        >
          <Upload />
          {planilha ? `${planilha.linhas.length} contato(s)` : "Fazer upload de contatos"}
        </Button>

        <PopoverIntervalo valor={envio} totalDestinatarios={linhas.length} onMudar={handleEnvio} />
        <PopoverAgendamento valor={envio} onMudar={handleEnvio} />

        <Button
          type="button"
          className="h-11"
          disabled={impedimento !== null || criar.isPending}
          title={impedimento ?? undefined}
          onClick={handleCriar}
        >
          <Send />
          {criar.isPending ? "Criando..." : "Criar campanha"}
        </Button>

        {impedimento ? (
          <p className="w-full text-xs text-muted-foreground">Para criar: {impedimento}</p>
        ) : null}
      </div>

      <SecaoMensagem
        mensagem={mensagem}
        colunas={colunas}
        primeiraLinha={linhas[0]}
        mapeamento={mapeamento}
        remetenteNome={instancia?.nome ?? ""}
        remetenteFoto={instancia?.fotoPerfilUrl}
        onMensagem={handleMensagem}
        onConfigurar={(variavel, config) =>
          setMapeamento((atual) => ({ ...atual, [variavel]: config }))
        }
      />

      <SecaoContatos
        planilha={planilha}
        colunaNumero={colunaNumero}
        lendo={lendo}
        erro={erroPlanilha}
        onAbrirSeletor={() => inputArquivo.current?.click()}
        onArquivo={handleArquivo}
        onColunaNumero={setColunaNumero}
      />
    </div>
  );
}
