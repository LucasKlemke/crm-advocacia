"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowUp, MoreHorizontal } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { formatarDataHora } from "@/lib/utils/data";
import { podeEditarComentario, podeModerarComentario } from "@/lib/auth/permissoes";
import {
  useAtualizarComentario,
  useComentarios,
  useCriarComentario,
  useExcluirComentario,
} from "@/hooks/use-comentarios";
import { AvatarIniciais } from "@/components/shared/avatar-iniciais";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RoleMembro } from "@prisma/client";
import type { ComentarioDTO } from "@/types/cliente";

export interface ComentariosPanelProps {
  clienteId: string;
  atorUsuarioId: string;
  atorNome: string;
  atorRole: RoleMembro;
}

export function ComentariosPanel({
  clienteId,
  atorUsuarioId,
  atorNome,
  atorRole,
}: ComentariosPanelProps) {
  const { data, isLoading, isError } = useComentarios("cliente", clienteId);
  const criar = useCriarComentario("cliente", clienteId);
  const atualizar = useAtualizarComentario("cliente", clienteId);
  const excluir = useExcluirComentario("cliente", clienteId);

  const [rascunho, setRascunho] = useState("");
  const [emEdicao, setEmEdicao] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState("");

  function avisarErro(erro: unknown, alternativa: string) {
    toast.error(erro instanceof ApiError ? erro.message : alternativa);
  }

  async function comentar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = rascunho.trim();
    if (!texto) return;

    try {
      await criar.mutateAsync(texto);
      setRascunho("");
    } catch (erro) {
      avisarErro(erro, "Não foi possível salvar o comentário.");
    }
  }

  async function salvarEdicao(id: string) {
    try {
      await atualizar.mutateAsync({ id, conteudo: textoEditado });
      setEmEdicao(null);
    } catch (erro) {
      avisarErro(erro, "Não foi possível editar o comentário.");
    }
  }

  async function remover(id: string) {
    try {
      await excluir.mutateAsync(id);
      toast.success("Comentário excluído.");
    } catch (erro) {
      avisarErro(erro, "Não foi possível excluir o comentário.");
    }
  }

  // A API devolve do mais recente para o mais antigo; aqui a leitura é de cima para
  // baixo, terminando no campo de escrever — como numa conversa.
  const comentarios = [...(data?.comentarios ?? [])].reverse();

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}

      {isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar os comentários.
        </p>
      ) : null}

      {!isLoading && !isError && comentarios.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum comentário ainda. Registre aqui o histórico de contato.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {comentarios.map((comentario: ComentarioDTO) => {
          const ehAutor = comentario.autorUsuarioId === atorUsuarioId;
          const podeAlgumaAcao =
            podeEditarComentario(ehAutor) || podeModerarComentario(atorRole, ehAutor);

          return (
            <li key={comentario.id} className="flex gap-2">
              <AvatarIniciais nome={comentario.autor.nome} className="size-6" />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex h-6 items-center gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {comentario.autor.nome}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatarDataHora(comentario.createdAt)}
                  </span>
                  {comentario.editadoEm ? (
                    <span className="text-[11px] text-muted-foreground">(editado)</span>
                  ) : null}
                  {podeAlgumaAcao ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="ml-auto size-6 [&_svg]:size-3.5"
                            aria-label={`Ações do comentário de ${comentario.autor.nome}`}
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {podeEditarComentario(ehAutor) ? (
                          <DropdownMenuItem
                            onClick={() => {
                              setEmEdicao(comentario.id);
                              setTextoEditado(comentario.conteudo);
                            }}
                          >
                            Editar
                          </DropdownMenuItem>
                        ) : null}
                        {podeModerarComentario(atorRole, ehAutor) ? (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => remover(comentario.id)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>

                {emEdicao === comentario.id ? (
                  <div className="flex flex-col gap-2">
                    <Textarea
                      aria-label="Editar comentário"
                      value={textoEditado}
                      onChange={(evento) => setTextoEditado(evento.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEmEdicao(null)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        disabled={atualizar.isPending || !textoEditado.trim()}
                        onClick={() => salvarEdicao(comentario.id)}
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs whitespace-pre-wrap text-foreground">
                    {comentario.conteudo}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Composer minimalista no rodapé, como numa conversa: uma linha que cresce com o
          texto (field-sizing-content) e um botão redondo de enviar. */}
      <form onSubmit={comentar} className="flex items-center gap-2">
        <AvatarIniciais nome={atorNome} className="size-6" />
        <Textarea
          aria-label="Novo comentário"
          placeholder="Adicionar um comentário..."
          className="min-h-6 flex-1 resize-none border-0 px-0 py-0 text-xs shadow-none md:text-xs focus-visible:border-0 focus-visible:ring-0"
          value={rascunho}
          onChange={(evento) => setRascunho(evento.target.value)}
          disabled={criar.isPending}
          rows={1}
        />
        <Button
          type="submit"
          size="icon-sm"
          className="size-6 shrink-0 rounded-full [&_svg]:size-3.5"
          aria-label="Comentar"
          disabled={criar.isPending || !rascunho.trim()}
        >
          <ArrowUp />
        </Button>
      </form>
    </div>
  );
}
