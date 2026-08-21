"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { Download, FileText, Image as ImageIcon, Pencil, Trash2, Upload } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { inferirTipoArquivo } from "@/lib/utils/tipo-arquivo";
import {
  useDocumentos,
  useEnviarDocumento,
  useExcluirDocumento,
  useRenomearDocumento,
} from "@/hooks/use-documentos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DocumentoDTO, EscopoDocumentoDTO, TipoArquivoDTO } from "@/types/documento";

const TAMANHO_MAXIMO_KB = 10 * 1024;

// Mesma técnica de cor de configuracoes/status-table.tsx (color-mix a partir de uma cor
// base, sem classe Tailwind literal): aqui a cor é fixa por tipo, não escolhida pelo
// usuário, então não precisa de allow-list — só diferenciar documento de imagem à
// primeira vista.
const CONFIG_TIPO_ARQUIVO: Record<TipoArquivoDTO, { Icon: typeof FileText; label: string; cor: string }> = {
  pdf: { Icon: FileText, label: "PDF", cor: "#ef4444" },
  docx: { Icon: FileText, label: "DOCX", cor: "#6366f1" },
  jpg: { Icon: ImageIcon, label: "JPG", cor: "#0ea5e9" },
  jpeg: { Icon: ImageIcon, label: "JPEG", cor: "#0ea5e9" },
  png: { Icon: ImageIcon, label: "PNG", cor: "#0ea5e9" },
};

export interface DocumentosGrupoProps {
  escopo: EscopoDocumentoDTO;
  escopoId: string;
  titulo: string;
  hrefBaixarTodos: string;
  onVisualizar: (documento: DocumentoDTO) => void;
}

// RN17/RN18 valem na Service (documento.service.ts); aqui é só feedback rápido de UX.
function formatarTamanho(tamanhoKb: number): string {
  if (tamanhoKb >= 1024) return `${(tamanhoKb / 1024).toFixed(1)} MB`;
  return `${tamanhoKb} KB`;
}

// A extensão vem do tipoArquivo (já confirmado), não é reparseada do nome — RN18 exige
// que renomear preserve o tipo, então o usuário só edita a parte antes da extensão.
function nomeBase(documento: DocumentoDTO): string {
  const sufixo = `.${documento.tipoArquivo}`;
  return documento.nomeOriginal.toLowerCase().endsWith(sufixo)
    ? documento.nomeOriginal.slice(0, -sufixo.length)
    : documento.nomeOriginal;
}

export function DocumentosGrupo({
  escopo,
  escopoId,
  titulo,
  hrefBaixarTodos,
  onVisualizar,
}: DocumentosGrupoProps) {
  const { data, isLoading, isError } = useDocumentos(escopo, escopoId);
  const enviar = useEnviarDocumento(escopo, escopoId);
  const excluir = useExcluirDocumento(escopo, escopoId);
  const renomear = useRenomearDocumento(escopo, escopoId);

  const inputRef = useRef<HTMLInputElement>(null);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);
  const [confirmandoExclusaoId, setConfirmandoExclusaoId] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<DocumentoDTO | null>(null);
  const [novoNomeBase, setNovoNomeBase] = useState("");

  function avisarErro(erro: unknown, alternativa: string) {
    toast.error(erro instanceof ApiError ? erro.message : alternativa);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo) return;

    setErroValidacao(null);

    if (!inferirTipoArquivo(arquivo.name)) {
      setErroValidacao("Formato não suportado. Use PDF, DOCX, JPG, JPEG ou PNG.");
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO_KB * 1024) {
      setErroValidacao("O arquivo deve ter no máximo 10MB.");
      return;
    }

    try {
      await enviar.mutateAsync(arquivo);
      toast.success("Documento enviado.");
    } catch (erro) {
      avisarErro(erro, "Não foi possível enviar o documento.");
    }
  }

  // downloadUrl é de curta duração (URL pré-assinada): usada imediatamente, nunca
  // guardada em estado ou cache.
  async function baixar(documento: DocumentoDTO) {
    setBaixandoId(documento.id);
    try {
      const { downloadUrl } = await apiFetch<{ downloadUrl: string }>(
        `/api/documentos/${documento.id}/download-url`
      );
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (erro) {
      avisarErro(erro, "Não foi possível gerar o link de download.");
    } finally {
      setBaixandoId(null);
    }
  }

  async function confirmarExclusao() {
    if (!confirmandoExclusaoId) return;
    try {
      await excluir.mutateAsync(confirmandoExclusaoId);
      toast.success("Documento excluído.");
    } catch (erro) {
      avisarErro(erro, "Não foi possível excluir o documento.");
    } finally {
      setConfirmandoExclusaoId(null);
    }
  }

  function abrirRenomear(documento: DocumentoDTO) {
    setRenomeando(documento);
    setNovoNomeBase(nomeBase(documento));
  }

  async function confirmarRenomear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!renomeando) return;
    const base = novoNomeBase.trim();
    if (!base) return;

    try {
      await renomear.mutateAsync({
        id: renomeando.id,
        nomeArquivo: `${base}.${renomeando.tipoArquivo}`,
      });
      toast.success("Documento renomeado.");
      setRenomeando(null);
    } catch (erro) {
      avisarErro(erro, "Não foi possível renomear o documento.");
    }
  }

  const documentos = data?.documentos ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{titulo}</h3>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFileChange}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-primary hover:text-primary"
                  aria-label={enviar.isPending ? "Enviando..." : "Enviar documento"}
                  disabled={enviar.isPending}
                  onClick={() => inputRef.current?.click()}
                />
              }
            >
              <Upload />
            </TooltipTrigger>
            <TooltipContent>{enviar.isPending ? "Enviando..." : "Enviar documento"}</TooltipContent>
          </Tooltip>
          {documentos.length > 0 ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    nativeButton={false}
                    aria-label="Baixar todos"
                    render={<a href={hrefBaixarTodos} download />}
                  />
                }
              >
                <Download />
              </TooltipTrigger>
              <TooltipContent>Baixar todos</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      {erroValidacao ? (
        <p role="alert" className="text-sm text-destructive">
          {erroValidacao}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar os documentos.
        </p>
      ) : null}

      {!isLoading && !isError && documentos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum documento enviado ainda.</p>
      ) : null}

      {!isLoading && !isError && documentos.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {documentos.map((documento) => {
            const { Icon, label, cor } = CONFIG_TIPO_ARQUIVO[documento.tipoArquivo];
            return (
              <li
                key={documento.id}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => onVisualizar(documento)}
                      />
                    }
                  >
                    <div
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `color-mix(in oklch, ${cor}, transparent 85%)` }}
                    >
                      <Icon className="size-4" style={{ color: cor }} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm text-foreground">
                        {documento.nomeOriginal}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="h-4 px-1.5 text-[10px] font-semibold"
                          style={{
                            borderColor: `color-mix(in oklch, ${cor}, transparent 50%)`,
                            color: cor,
                            backgroundColor: `color-mix(in oklch, ${cor}, transparent 92%)`,
                          }}
                        >
                          {label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatarTamanho(documento.tamanhoKb)}
                        </span>
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Visualizar</TooltipContent>
                </Tooltip>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Baixar ${documento.nomeOriginal}`}
                    disabled={baixandoId === documento.id}
                    onClick={() => baixar(documento)}
                  >
                    <Download />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Renomear ${documento.nomeOriginal}`}
                    onClick={() => abrirRenomear(documento)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Excluir ${documento.nomeOriginal}`}
                    onClick={() => setConfirmandoExclusaoId(documento.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <AlertDialog
        open={confirmandoExclusaoId !== null}
        onOpenChange={(aberto) => !aberto && setConfirmandoExclusaoId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={excluir.isPending} onClick={confirmarExclusao}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={renomeando !== null} onOpenChange={(aberto) => !aberto && setRenomeando(null)}>
        <DialogContent>
          <form onSubmit={confirmarRenomear} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Renomear documento</DialogTitle>
              <DialogDescription>A extensão do arquivo é mantida.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="novo-nome-documento">Nome</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="novo-nome-documento"
                  value={novoNomeBase}
                  onChange={(evento) => setNovoNomeBase(evento.target.value)}
                  autoFocus
                />
                {renomeando ? (
                  <span className="shrink-0 text-sm text-muted-foreground">
                    .{renomeando.tipoArquivo}
                  </span>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenomeando(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={renomear.isPending || !novoNomeBase.trim()}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
