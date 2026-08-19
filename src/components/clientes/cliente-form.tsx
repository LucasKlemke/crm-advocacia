"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { cpfValido, formatarCpf, mascararCpf } from "@/lib/utils/cpf";
import { emailValido } from "@/lib/utils/email";
import { formatarTelefone, mascararTelefone, telefoneValido } from "@/lib/utils/telefone";
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

type NomeCampo = "nome" | "cpf" | "telefone" | "email" | "endereco";

interface Campo {
  nome: NomeCampo;
  label: string;
  tipo: string;
  obrigatorio: boolean;
  placeholder?: string;
  // Máscara aplicada a cada tecla; sem ela o campo é texto livre.
  mascara?: (valor: string) => string;
  // Mensagem de erro, ou null se o valor serve. Campo vazio e opcional nunca é erro:
  // a checagem de obrigatoriedade fica fora do validador.
  validar?: (valor: string) => string | null;
}

const CAMPOS: readonly Campo[] = [
  {
    nome: "nome",
    label: "Nome completo",
    tipo: "text",
    obrigatorio: true,
    validar: (valor) => (valor.trim().length >= 3 ? null : "Informe o nome completo."),
  },
  {
    nome: "cpf",
    label: "CPF",
    tipo: "text",
    obrigatorio: true,
    placeholder: "000.000.000-00",
    mascara: mascararCpf,
    validar: (valor) =>
      cpfValido(valor) ? null : "CPF inválido. Informe os 11 dígitos, como 083.688.379-95.",
  },
  {
    nome: "telefone",
    label: "Telefone",
    tipo: "tel",
    obrigatorio: false,
    placeholder: "+55 (00) 00000-0000",
    mascara: mascararTelefone,
    validar: (valor) =>
      telefoneValido(valor)
        ? null
        : "Telefone inválido. Use +55 (00) 00000-0000, com DDD e nono dígito.",
  },
  {
    nome: "email",
    label: "E-mail",
    tipo: "email",
    obrigatorio: false,
    placeholder: "nome@dominio.com",
    validar: (valor) => (emailValido(valor) ? null : "E-mail inválido."),
  },
  { nome: "endereco", label: "Endereço", tipo: "text", obrigatorio: false },
];

// Os campos chegam do banco sem máscara (CPF e telefone são só dígitos); a edição
// começa já formatada para o usuário reconhecer o que está lá.
function valoresIniciais(cliente?: ClienteDTO): Record<NomeCampo, string> {
  return {
    nome: cliente?.nome ?? "",
    cpf: cliente ? formatarCpf(cliente.cpf) : "",
    telefone: cliente?.telefone ? formatarTelefone(cliente.telefone) : "",
    email: cliente?.email ?? "",
    endereco: cliente?.endereco ?? "",
  };
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

  // Mesma checagem do servidor, adiantada: evita um round-trip só para ouvir que o
  // CPF tem dígito verificador errado. O servidor continua sendo a autoridade.
  function validarTudo(): Record<string, string[]> | null {
    const erros: Record<string, string[]> = {};
    for (const campo of CAMPOS) {
      const valor = valores[campo.nome].trim();
      if (!valor) {
        if (campo.obrigatorio) erros[campo.nome] = ["Campo obrigatório."];
        continue;
      }
      const erro = campo.validar?.(valor);
      if (erro) erros[campo.nome] = [erro];
    }
    return Object.keys(erros).length > 0 ? erros : null;
  }

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const erros = validarTudo();
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
              placeholder={campo.placeholder}
              value={valores[campo.nome]}
              onChange={(evento) => alterar(campo, evento.target.value)}
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
