import {
  Baby,
  Briefcase,
  CalendarDays,
  Flag,
  Heart,
  IdCard,
  Mail,
  MapPin,
  Phone,
  User,
  type LucideIcon,
} from "lucide-react";
import { cpfValido, formatarCpf, mascararCpf } from "@/lib/utils/cpf";
import { emailValido } from "@/lib/utils/email";
import { formatarTelefone, mascararTelefone, telefoneValido } from "@/lib/utils/telefone";
import type { ClienteDTO } from "@/types/cliente";

export type NomeCampo =
  | "nome"
  | "cpf"
  | "telefone"
  | "email"
  | "endereco"
  | "nascimento"
  | "sexo"
  | "estadoCivil"
  | "nacionalidade"
  | "profissao"
  | "nomeMae"
  | "nomePai";

export interface OpcaoCampo {
  valor: string;
  label: string;
}

export interface Campo {
  nome: NomeCampo;
  label: string;
  tipo: string;
  obrigatorio: boolean;
  icone: LucideIcon;
  placeholder?: string;
  // Presente só nos campos do tipo "select" — lista de opções fixas do domínio.
  opcoes?: readonly OpcaoCampo[];
  // Máscara aplicada a cada tecla; sem ela o campo é texto livre.
  mascara?: (valor: string) => string;
  // Mensagem de erro, ou null se o valor serve. Campo vazio e opcional nunca é erro:
  // a checagem de obrigatoriedade fica fora do validador.
  validar?: (valor: string) => string | null;
}

export const OPCOES_SEXO: readonly OpcaoCampo[] = [
  { valor: "masculino", label: "Masculino" },
  { valor: "feminino", label: "Feminino" },
  { valor: "outro", label: "Outro" },
];

export const OPCOES_ESTADO_CIVIL: readonly OpcaoCampo[] = [
  { valor: "solteiro", label: "Solteiro(a)" },
  { valor: "casado", label: "Casado(a)" },
  { valor: "divorciado", label: "Divorciado(a)" },
  { valor: "viuvo", label: "Viúvo(a)" },
  { valor: "uniao_estavel", label: "União estável" },
];

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
      cpfValido(valor) ? null : "CPF inválido. Informe os 11 dígitos, como 123.456.789-09.",
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
  {
    nome: "nascimento",
    label: "Data de nascimento",
    tipo: "date",
    obrigatorio: false,
    icone: CalendarDays,
  },
  {
    nome: "sexo",
    label: "Sexo",
    tipo: "select",
    obrigatorio: false,
    icone: User,
    opcoes: OPCOES_SEXO,
  },
  {
    nome: "estadoCivil",
    label: "Estado civil",
    tipo: "select",
    obrigatorio: false,
    icone: Heart,
    opcoes: OPCOES_ESTADO_CIVIL,
  },
  {
    nome: "nacionalidade",
    label: "Nacionalidade",
    tipo: "text",
    obrigatorio: false,
    icone: Flag,
    placeholder: "Brasileira",
  },
  {
    nome: "profissao",
    label: "Profissão",
    tipo: "text",
    obrigatorio: false,
    icone: Briefcase,
  },
  {
    nome: "nomeMae",
    label: "Nome da mãe",
    tipo: "text",
    obrigatorio: false,
    icone: Baby,
  },
  {
    nome: "nomePai",
    label: "Nome do pai",
    tipo: "text",
    obrigatorio: false,
    icone: Baby,
  },
];

// Datas chegam do banco em ISO completo (ex.: "1990-05-20T00:00:00.000Z"); o input
// type="date" só aceita "YYYY-MM-DD".
function paraInputDate(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

// Os campos chegam do banco sem máscara (CPF e telefone são só dígitos); a edição
// começa já formatada para o usuário reconhecer o que está lá.
export function valoresIniciais(cliente?: ClienteDTO | null): Record<NomeCampo, string> {
  return {
    nome: cliente?.nome ?? "",
    cpf: cliente ? formatarCpf(cliente.cpf) : "",
    telefone: cliente?.telefone ? formatarTelefone(cliente.telefone) : "",
    email: cliente?.email ?? "",
    endereco: cliente?.endereco ?? "",
    nascimento: paraInputDate(cliente?.nascimento),
    sexo: cliente?.sexo ?? "",
    estadoCivil: cliente?.estadoCivil ?? "",
    nacionalidade: cliente?.nacionalidade ?? "",
    profissao: cliente?.profissao ?? "",
    nomeMae: cliente?.nomeMae ?? "",
    nomePai: cliente?.nomePai ?? "",
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
