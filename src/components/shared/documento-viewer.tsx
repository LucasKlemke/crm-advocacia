"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentoDTO, TipoArquivoDTO } from "@/types/documento";

// docx não tem visualizador nativo no navegador (diferente de pdf/imagem) — mostrar um
// <iframe>/<img> pra ele só resultaria em download ou tela em branco, então nem tenta.
const TIPOS_VISUALIZAVEIS: TipoArquivoDTO[] = ["pdf", "jpg", "jpeg", "png"];

export interface DocumentoViewerProps {
  documento: DocumentoDTO;
  onVoltar: () => void;
}

// Ocupa o lugar das abas Detalhes/Documentos na drawer (como uma aba exclusiva do
// documento aberto) em vez de abrir por cima como dialog ou nova aba do navegador —
// "Voltar" desmonta este componente e volta pra visualização anterior. Cada montagem é
// de um documento fixo (o chamador troca de documento remontando, nunca trocando a prop
// num componente já montado), então o efeito abaixo não precisa resetar estado antes de
// buscar — só busca uma vez e ignora a resposta se desmontar no meio do caminho.
export function DocumentoViewer({ documento, onVoltar }: DocumentoViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let cancelado = false;

    apiFetch<{ downloadUrl: string }>(`/api/documentos/${documento.id}/download-url?modo=inline`)
      .then((resposta) => {
        if (!cancelado) setUrl(resposta.downloadUrl);
      })
      .catch(() => {
        if (!cancelado) setErro(true);
      });

    return () => {
      cancelado = true;
    };
  }, [documento.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Button type="button" variant="outline" size="sm" onClick={onVoltar}>
          <ArrowLeft />
          Voltar
        </Button>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {documento.nomeOriginal}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-muted/30">
        {erro ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            Não foi possível carregar a visualização.
          </p>
        ) : !url ? (
          <div className="flex h-full items-center justify-center p-4" aria-hidden>
            <Skeleton className="h-full w-full" />
          </div>
        ) : !TIPOS_VISUALIZAVEIS.includes(documento.tipoArquivo) ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Pré-visualização não disponível para este tipo de arquivo.
            </p>
          </div>
        ) : documento.tipoArquivo === "jpg" ||
          documento.tipoArquivo === "jpeg" ||
          documento.tipoArquivo === "png" ? (
          <div className="flex h-full items-center justify-center overflow-auto p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={documento.nomeOriginal}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <iframe src={url} title={documento.nomeOriginal} className="h-full w-full" />
        )}
      </div>
    </div>
  );
}
