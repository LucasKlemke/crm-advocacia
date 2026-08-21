"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { iniciais } from "@/lib/utils/nome";

const TAMANHO_MAXIMO_KB = 5 * 1024;

const TIPO_ARQUIVO_POR_MIME: Record<string, "jpeg" | "png" | "webp"> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface AvatarUploadProps {
  usuario: { nome: string };
  temAvatarInicial: boolean;
}

export function AvatarUpload({ usuario, temAvatarInicial }: AvatarUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!temAvatarInicial) return;
    fetch("/api/perfil/avatar/download-url")
      .then((resposta) => resposta.json())
      .then((dados) => setAvatarUrl(dados?.downloadUrl ?? null))
      .catch(() => {});
  }, [temAvatarInicial]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo) return;

    setErro(null);

    const tipoArquivo = TIPO_ARQUIVO_POR_MIME[arquivo.type];
    if (!tipoArquivo) {
      setErro("Formato não suportado. Use JPEG, PNG ou WEBP.");
      return;
    }

    if (arquivo.size > TAMANHO_MAXIMO_KB * 1024) {
      setErro("A imagem deve ter no máximo 5MB.");
      return;
    }

    setEnviando(true);
    try {
      const respostaUploadUrl = await fetch("/api/perfil/avatar/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeArquivo: arquivo.name,
          tipoArquivo,
          tamanhoBytes: arquivo.size,
        }),
      });

      if (!respostaUploadUrl.ok) {
        const dados = await respostaUploadUrl.json().catch(() => null);
        setErro(dados?.error ?? "Não foi possível iniciar o upload.");
        return;
      }

      const { uploadUrl, storageKey } = await respostaUploadUrl.json();

      const respostaS3 = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": arquivo.type },
        body: arquivo,
      });

      if (!respostaS3.ok) {
        setErro("Não foi possível enviar a imagem.");
        return;
      }

      const respostaConfirmar = await fetch("/api/perfil/avatar/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey }),
      });

      if (!respostaConfirmar.ok) {
        const dados = await respostaConfirmar.json().catch(() => null);
        setErro(dados?.error ?? "Não foi possível confirmar o avatar.");
        return;
      }

      const respostaDownloadUrl = await fetch("/api/perfil/avatar/download-url");
      const dadosDownload = await respostaDownloadUrl.json().catch(() => null);
      setAvatarUrl(dadosDownload?.downloadUrl ?? null);

      toast.success("Foto atualizada.");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback>{iniciais(usuario.nome)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="size-4" />
          {enviando ? "Enviando..." : "Trocar foto"}
        </Button>
        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}
      </div>
    </div>
  );
}
