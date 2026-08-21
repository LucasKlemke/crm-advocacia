import { Banknote, FileText, Hash, Tag, User, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Diferente de campos-cliente.ts, os campos de Caso são majoritariamente selects (não
// texto/máscara): não há ganho em array-driven form+validação aqui. Este módulo guarda
// só o que de fato se repete entre caso-form.tsx (criação) e caso-dados.tsx (edição
// inline) — rótulo e ícone de cada campo.
export const ICONE_TITULO: LucideIcon = Tag;
export const ICONE_NUMERO_PROCESSO: LucideIcon = Hash;
export const ICONE_CLIENTE: LucideIcon = User;
export const ICONE_RESPONSAVEL: LucideIcon = Users;
export const ICONE_VALOR: LucideIcon = Banknote;
export const ICONE_DESCRICAO: LucideIcon = FileText;

export const SEM_RESPONSAVEL_VALOR = "sem-responsavel";
export const CRIAR_CLIENTE_VALOR = "criar-cliente";
