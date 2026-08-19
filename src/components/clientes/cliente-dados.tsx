"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useAtualizarCliente, type DadosClienteForm } from "@/hooks/use-clientes";
import {
  CAMPOS,
  valoresIniciais,
  validarCampos,
  type Campo,
  type NomeCampo,
} from "@/components/clientes/campos-cliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClienteDTO } from "@/types/cliente";

export interface ClienteDadosProps {
  cliente: ClienteDTO;
}

// Edição inline campo a campo: clicar em um valor transforma só aquele campo em input,
// sem um modo "editar tudo". O botão de salvar só aparece quando algo de fato mudou,
// para que a leitura continue sendo a operação silenciosa e comum.
// Montado com `key={cliente.id}` pelo drawer: trocar de cliente remonta o componente
// em vez de arrastar o rascunho do anterior.
export function ClienteDados({ cliente }: ClienteDadosProps) {
  const atualizar = useAtualizarCliente();
  const [valores, setValores] = useState(() => valoresIniciais(cliente));
  const [original, setOriginal] = useState(() => valoresIniciais(cliente));
  // Um campo por vez: abrir outro fecha o anterior, como no Notion. Fechar não
  // descarta o que foi digitado — só devolve a linha ao formato de leitura.
  const [aberto, setAberto] = useState<NomeCampo | null>(null);
  const [errosPorCampo, setErrosPorCampo] = useState<Record<string, string[] | undefined>>({});

  const alterado = CAMPOS.some((campo) => valores[campo.nome] !== original[campo.nome]);

  function alterar(campo: Campo, digitado: string) {
    const valor = campo.mascara ? campo.mascara(digitado) : digitado;
    setValores((atuais) => ({ ...atuais, [campo.nome]: valor }));
    setErrosPorCampo((atuais) => ({ ...atuais, [campo.nome]: undefined }));
  }

  function cancelar() {
    setValores(original);
    setAberto(null);
    setErrosPorCampo({});
  }

  async function salvar() {
    const erros = validarCampos(valores);
    if (erros) {
      setErrosPorCampo(erros);
      return;
    }
    setErrosPorCampo({});

    // PATCH parcial: só o que mudou viaja, então o diff do log (RN20) fica limpo.
    const dados: Partial<DadosClienteForm> = {};
    for (const campo of CAMPOS) {
      const valor = valores[campo.nome];
      if (valor === original[campo.nome]) continue;
      if (campo.nome === "nome" || campo.nome === "cpf") dados[campo.nome] = valor;
      // Opcional apagado vira null: é assim que o Service limpa o campo.
      else dados[campo.nome] = valor || null;
    }

    try {
      const { cliente: atualizado } = await atualizar.mutateAsync({ id: cliente.id, dados });
      const novos = valoresIniciais(atualizado);
      setValores(novos);
      setOriginal(novos);
      setAberto(null);
      toast.success("Cliente atualizado.");
    } catch (erro) {
      if (erro instanceof ApiError && erro.detalhes) setErrosPorCampo(erro.detalhes);
      toast.error(erro instanceof ApiError ? erro.message : "Não foi possível salvar o cliente.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {CAMPOS.map((campo) => {
        const Icone = campo.icone;
        const erro = errosPorCampo[campo.nome]?.[0];
        // Campo com erro fica aberto: fechá-lo esconderia justamente o que precisa
        // ser corrigido.
        const editando = aberto === campo.nome || Boolean(erro);
        const valor = valores[campo.nome];
        const alteradoAqui = valor !== original[campo.nome];

        return (
          <div key={campo.nome} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Label
                htmlFor={`cliente-${campo.nome}`}
                className="w-32 shrink-0 gap-2 text-xs font-normal text-muted-foreground"
              >
                <Icone aria-hidden className="size-3.5" />
                {campo.label}
              </Label>

              {editando ? (
                <Input
                  id={`cliente-${campo.nome}`}
                  name={campo.nome}
                  type={campo.tipo}
                  autoFocus
                  placeholder={campo.placeholder}
                  value={valor}
                  onChange={(evento) => alterar(campo, evento.target.value)}
                  onBlur={() => setAberto((atual) => (atual === campo.nome ? null : atual))}
                  aria-invalid={erro ? true : undefined}
                  aria-describedby={erro ? `erro-${campo.nome}` : undefined}
                  disabled={atualizar.isPending}
                  className="h-8 flex-1"
                />
              ) : (
                <button
                  type="button"
                  aria-label={`Editar ${campo.label}`}
                  onClick={() => setAberto(campo.nome)}
                  className="flex h-8 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {valor.trim() ? valor : <span className="text-muted-foreground">Vazio</span>}
                  {/* Marca a alteração ainda não salva: sem isso, fechar o input faria
                      a edição parecer perdida. */}
                  {alteradoAqui ? (
                    <span
                      data-alterado
                      title="Alterado, ainda não salvo"
                      className="size-1.5 shrink-0 rounded-full bg-primary"
                    />
                  ) : null}
                </button>
              )}
            </div>

            {erro ? (
              <p
                id={`erro-${campo.nome}`}
                role="alert"
                className="pl-34 text-xs text-destructive"
              >
                {erro}
              </p>
            ) : null}
          </div>
        );
      })}

      {alterado ? (
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={cancelar} disabled={atualizar.isPending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={salvar} disabled={atualizar.isPending}>
            <Save />
            {atualizar.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
