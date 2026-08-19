"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { formatarCpf } from "@/lib/utils/cpf";
import { useAtualizarCliente, useCriarCliente, type DadosClienteForm } from "@/hooks/use-clientes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClienteDTO } from "@/types/cliente";

export interface ClienteFormProps {
  cliente?: ClienteDTO;
  onSucesso: (cliente: ClienteDTO) => void;
  onCancelar?: () => void;
}

const CAMPOS = [
  { nome: "nome", label: "Nome completo", tipo: "text", obrigatorio: true },
  { nome: "cpf", label: "CPF", tipo: "text", obrigatorio: true },
  { nome: "telefone", label: "Telefone", tipo: "tel", obrigatorio: false },
  { nome: "email", label: "E-mail", tipo: "email", obrigatorio: false },
  { nome: "endereco", label: "Endereço", tipo: "text", obrigatorio: false },
] as const;

// Formulário não-controlado + FormData, como o resto do app; a validação forte é a do
// servidor, e `detalhes` do 400 volta como erro por campo.
export function ClienteForm({ cliente, onSucesso, onCancelar }: ClienteFormProps) {
  const criar = useCriarCliente();
  const atualizar = useAtualizarCliente();
  const [errosPorCampo, setErrosPorCampo] = useState<Record<string, string[] | undefined>>({});

  const salvando = criar.isPending || atualizar.isPending;

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrosPorCampo({});

    const form = new FormData(evento.currentTarget);
    const dados: DadosClienteForm = {
      nome: String(form.get("nome") ?? ""),
      cpf: String(form.get("cpf") ?? ""),
      telefone: String(form.get("telefone") ?? "") || null,
      email: String(form.get("email") ?? "") || null,
      endereco: String(form.get("endereco") ?? "") || null,
    };

    try {
      const resposta = cliente
        ? await atualizar.mutateAsync({ id: cliente.id, dados })
        : await criar.mutateAsync(dados);
      toast.success(cliente ? "Cliente atualizado." : "Cliente criado.");
      onSucesso(resposta.cliente);
    } catch (erro) {
      if (erro instanceof ApiError && erro.detalhes) {
        setErrosPorCampo(erro.detalhes);
      }
      toast.error(erro instanceof ApiError ? erro.message : "Não foi possível salvar o cliente.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {CAMPOS.map((campo) => {
        const erro = errosPorCampo[campo.nome]?.[0];
        const valorInicial =
          campo.nome === "cpf" && cliente ? formatarCpf(cliente.cpf) : (cliente?.[campo.nome] ?? "");

        return (
          <div key={campo.nome} className="flex flex-col gap-2">
            <Label htmlFor={`cliente-${campo.nome}`}>
              {campo.label}
              {campo.obrigatorio ? null : (
                <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
              )}
            </Label>
            <Input
              id={`cliente-${campo.nome}`}
              name={campo.nome}
              type={campo.tipo}
              required={campo.obrigatorio}
              defaultValue={valorInicial ?? ""}
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? `erro-${campo.nome}` : undefined}
              disabled={salvando}
            />
            {erro ? (
              <p id={`erro-${campo.nome}`} role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="mt-2 flex justify-end gap-2">
        {onCancelar ? (
          <Button type="button" variant="outline" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : cliente ? "Salvar alterações" : "Criar cliente"}
        </Button>
      </div>
    </form>
  );
}
