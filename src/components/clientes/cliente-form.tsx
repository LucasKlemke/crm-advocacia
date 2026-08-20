"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useAtualizarCliente, useCriarCliente, type DadosClienteForm } from "@/hooks/use-clientes";
import {
  CAMPOS,
  valoresIniciais,
  validarCampos,
  type Campo,
} from "@/components/clientes/campos-cliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClienteDTO, EstadoCivilClienteDTO, SexoClienteDTO } from "@/types/cliente";

export interface ClienteFormProps {
  cliente?: ClienteDTO;
  onSucesso: (cliente: ClienteDTO) => void;
  onCancelar?: () => void;
}

export function ClienteForm({ cliente, onSucesso, onCancelar }: ClienteFormProps) {
  const criar = useCriarCliente();
  const atualizar = useAtualizarCliente();
  const [valores, setValores] = useState(() => valoresIniciais(cliente));
  const [errosPorCampo, setErrosPorCampo] = useState<Record<string, string[] | undefined>>({});

  const salvando = criar.isPending || atualizar.isPending;

  function alterar(campo: Campo, digitado: string) {
    const valor = campo.mascara ? campo.mascara(digitado) : digitado;
    setValores((atuais) => ({ ...atuais, [campo.nome]: valor }));
    // Some com o erro assim que o usuário volta a digitar: manter a mensagem
    // enquanto ele corrige o campo só atrapalha.
    setErrosPorCampo((atuais) => ({ ...atuais, [campo.nome]: undefined }));
  }

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const erros = validarCampos(valores);
    if (erros) {
      setErrosPorCampo(erros);
      return;
    }
    setErrosPorCampo({});

    const dados: DadosClienteForm = {
      nome: valores.nome,
      cpf: valores.cpf,
      telefone: valores.telefone || null,
      email: valores.email || null,
      endereco: valores.endereco || null,
      sexo: (valores.sexo || null) as SexoClienteDTO | null,
      estadoCivil: (valores.estadoCivil || null) as EstadoCivilClienteDTO | null,
      nomeMae: valores.nomeMae || null,
      nomePai: valores.nomePai || null,
      nacionalidade: valores.nacionalidade || null,
      nascimento: valores.nascimento || null,
      profissao: valores.profissao || null,
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {CAMPOS.map((campo) => {
        const erro = errosPorCampo[campo.nome]?.[0];
        const Icone = campo.icone;

        return (
          <div key={campo.nome} className="flex flex-col gap-2">
            <Label htmlFor={`cliente-${campo.nome}`}>
              <Icone aria-hidden className="size-3.5 text-muted-foreground" />
              {campo.label}
              {campo.obrigatorio ? null : (
                <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
              )}
            </Label>
            {campo.tipo === "select" ? (
              <Select
                value={valores[campo.nome] || null}
                onValueChange={(valor) => alterar(campo, (valor as string) ?? "")}
                disabled={salvando}
              >
                <SelectTrigger id={`cliente-${campo.nome}`} className="w-full">
                  <SelectValue>
                    {() =>
                      campo.opcoes?.find((opcao) => opcao.valor === valores[campo.nome])?.label ??
                      "Selecione"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {campo.opcoes?.map((opcao) => (
                    <SelectItem key={opcao.valor} value={opcao.valor}>
                      {opcao.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`cliente-${campo.nome}`}
                name={campo.nome}
                type={campo.tipo}
                placeholder={campo.placeholder}
                value={valores[campo.nome]}
                onChange={(evento) => alterar(campo, evento.target.value)}
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? `erro-${campo.nome}` : undefined}
                disabled={salvando}
              />
            )}
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
          {cliente ? <Save /> : <Plus />}
          {salvando ? "Salvando..." : cliente ? "Salvar alterações" : "Criar cliente"}
        </Button>
      </div>
    </form>
  );
}
