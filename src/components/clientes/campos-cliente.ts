import { IdCard, Mail, MapPin, Phone, User, type LucideIcon } from "lucide-react";
import { cpfValido, formatarCpf, mascararCpf } from "@/lib/utils/cpf";
import { emailValido } from "@/lib/utils/email";
import { formatarTelefone, mascararTelefone, telefoneValido } from "@/lib/utils/telefone";
import type { ClienteDTO } from "@/types/cliente";

export type NomeCampo = "nome" | "cpf" | "telefone" | "email" | "endereco";

export interface Campo {
  nome: NomeCampo;
  label: string;
  tipo: string;
  obrigatorio: boolean;
  icone: LucideIcon;
  placeholder?: string;
  // Máscara aplicada a cada tecla; sem ela o campo é texto livre.
  mascara?: (valor: string) => string;
  // Mensagem de erro, ou null se o valor serve. Campo vazio e opcional nunca é erro:
  // a checagem de obrigatoriedade fica fora do validador.
  validar?: (valor: string) => string | null;
}

// Uma única definição dos campos serve o formulário de criação e a edição inline no
// drawer: label, ícone, máscara e validação nunca divergem entre as duas telas.
export const CAMPOS: readonly Campo[] = [
  {
    nome: "nome",
    label: "Nome completo",
    tipo: "text",
    obrigatorio: true,
    icone: User,
    validar: (valor) => (valor.trim().length >= 3 ? null : "Informe o nome completo."),
  },
  {
    nome: "cpf",
    label: "CPF",
    tipo: "text",
    obrigatorio: true,
    icone: IdCard,
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
    icone: Phone,
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
    icone: Mail,
    placeholder: "nome@dominio.com",
    validar: (valor) => (emailValido(valor) ? null : "E-mail inválido."),
  },
  {
    nome: "endereco",
    label: "Endereço",
    tipo: "text",
    obrigatorio: false,
    icone: MapPin,
    placeholder: "Rua, número, cidade",
  },
];

// Os campos chegam do banco sem máscara (CPF e telefone são só dígitos); a edição
// começa já formatada para o usuário reconhecer o que está lá.
export function valoresIniciais(cliente?: ClienteDTO | null): Record<NomeCampo, string> {
  return {
    nome: cliente?.nome ?? "",
    cpf: cliente ? formatarCpf(cliente.cpf) : "",
    telefone: cliente?.telefone ? formatarTelefone(cliente.telefone) : "",
    email: cliente?.email ?? "",
    endereco: cliente?.endereco ?? "",
  };
}

// Mesma checagem do servidor, adiantada: evita um round-trip só para ouvir que o
// CPF tem dígito verificador errado. O servidor continua sendo a autoridade.
export function validarCampos(
  valores: Record<NomeCampo, string>,
  campos: readonly Campo[] = CAMPOS
): Record<string, string[]> | null {
  const erros: Record<string, string[]> = {};
  for (const campo of campos) {
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
