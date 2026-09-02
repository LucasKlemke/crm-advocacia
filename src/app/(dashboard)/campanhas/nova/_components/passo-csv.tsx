"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Hash, Loader2, Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CsvInvalidoError, lerPlanilha, sugerirColunaNumero } from "@/lib/utils/csv-campanha";
import { normalizarTelefone, telefoneValido } from "@/lib/utils/telefone";
import type { LinhaCsv } from "@/lib/utils/campanha-mensagem";

export interface PlanilhaSelecionada {
  nomeArquivo: string;
  colunas: string[];
  linhas: LinhaCsv[];
}

export interface PassoCsvProps {
  planilha: PlanilhaSelecionada | null;
  colunaNumero: string;
  onPlanilha: (planilha: PlanilhaSelecionada, colunaNumeroSugerida: string | null) => void;
  onColunaNumero: (coluna: string) => void;
}

const LINHAS_NO_PREVIEW = 5;

// Mesma validação que o service aplica antes de aceitar a campanha (RN13) — rodar aqui
// evita o usuário descobrir só no fim que a planilha tem números quebrados.
export function contarNumerosInvalidos(linhas: LinhaCsv[], coluna: string): number[] {
  if (!coluna) return [];
  return linhas.reduce<number[]>((invalidas, linha, indice) => {
    if (!telefoneValido(normalizarTelefone(linha[coluna] ?? ""))) invalidas.push(indice + 1);
    return invalidas;
  }, []);
}

export function PassoCsv({ planilha, colunaNumero, onPlanilha, onColunaNumero }: PassoCsvProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  async function handleArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setLendo(true);
    try {
      const { colunas, linhas } = await lerPlanilha(arquivo);
      onPlanilha({ nomeArquivo: arquivo.name, colunas, linhas }, sugerirColunaNumero(colunas));
    } catch (falha) {
      setErro(
        falha instanceof CsvInvalidoError ? falha.message : "Não foi possível ler a planilha."
      );
    } finally {
      setLendo(false);
    }
  }

  function handleSoltar(evento: React.DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastando(false);
    handleArquivo(evento.dataTransfer.files?.[0]);
  }

  const invalidas = planilha ? contarNumerosInvalidos(planilha.linhas, colunaNumero) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Planilha de destinatários</h2>
        <p className="text-sm text-muted-foreground">
          Um arquivo CSV com uma linha por destinatário e uma linha de cabeçalho com os nomes
          das colunas.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label="Arquivo CSV"
          onChange={(evento) => handleArquivo(evento.target.files?.[0])}
        />

        {/* A área inteira é clicável e recebe o arquivo arrastado. É um div com role/onKeyDown
            em vez de <button> porque contém o nome do arquivo e a dica em blocos — um botão
            com esse conteúdo vira um alvo de leitor de tela confuso. */}
        <div
          role="button"
          tabIndex={0}
          aria-label={planilha ? "Trocar planilha CSV" : "Selecionar planilha CSV"}
          aria-busy={lendo}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(evento) => {
            if (evento.key === "Enter" || evento.key === " ") {
              evento.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(evento) => {
            evento.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={handleSoltar}
          className={cn(
            "flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            arrastando && "border-primary bg-primary/5",
            lendo && "pointer-events-none opacity-60"
          )}
        >
          {lendo ? (
            <>
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Lendo a planilha...</p>
            </>
          ) : planilha ? (
            <>
              <FileSpreadsheet className="size-8 text-primary" />
              <div>
                <p className="text-sm font-medium">{planilha.nomeArquivo}</p>
                <p className="text-sm text-muted-foreground">
                  {planilha.linhas.length} linha(s) · {planilha.colunas.length} coluna(s)
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Arraste outro arquivo aqui ou clique para trocar
              </p>
            </>
          ) : (
            <>
              <Upload className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Arraste a planilha aqui</p>
                <p className="text-sm text-muted-foreground">
                  ou clique para escolher um arquivo do computador
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Formato CSV, até 5.000 destinatários</p>
            </>
          )}
        </div>

        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}
      </div>

      {planilha ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="coluna-numero" className="flex items-center gap-1.5">
              <Hash className="size-4 text-muted-foreground" />
              Coluna com o número de WhatsApp
            </Label>
            {/* O Select do base-ui emite null ao limpar a seleção; a coluna vazia é o
                estado "ainda não escolhida", que o wizard já trata. */}
            <Select value={colunaNumero} onValueChange={(valor) => onColunaNumero(valor ?? "")}>
              <SelectTrigger id="coluna-numero" className="w-full">
                <Hash className="size-4 text-muted-foreground" />
                <SelectValue placeholder="Escolha a coluna" />
              </SelectTrigger>
              <SelectContent>
                {planilha.colunas.map((coluna) => (
                  <SelectItem key={coluna} value={coluna}>
                    <span className="flex items-center gap-2">
                      <Hash className="size-3.5 text-muted-foreground" />
                      {coluna}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalidas.length > 0 ? (
              <p role="alert" className="text-sm text-destructive">
                {invalidas.length} número(s) inválido(s) — a começar pela linha {invalidas[0]}. Use
                o formato com DDI e DDD, por exemplo 5511999999999.
              </p>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {planilha.colunas.map((coluna) => (
                    <TableHead key={coluna} className="px-4">
                      <span className="flex items-center gap-1.5">
                        {coluna === colunaNumero ? (
                          <Hash className="size-3.5 text-muted-foreground" />
                        ) : null}
                        {coluna}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {planilha.linhas.slice(0, LINHAS_NO_PREVIEW).map((linha, indice) => (
                  <TableRow key={indice}>
                    {planilha.colunas.map((coluna) => (
                      <TableCell key={coluna} className="px-4 py-2 text-sm">
                        {linha[coluna]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {planilha.linhas.length > LINHAS_NO_PREVIEW ? (
            <p className="text-xs text-muted-foreground">
              Mostrando as {LINHAS_NO_PREVIEW} primeiras linhas de {planilha.linhas.length}.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
