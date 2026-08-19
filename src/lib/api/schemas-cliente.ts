import { z } from "zod";
import { cpfValido } from "@/lib/utils/cpf";
import { emailValido } from "@/lib/utils/email";
import { telefoneValido } from "@/lib/utils/telefone";

// Os mesmos validadores usados pelo Service, aplicados aqui só para que o erro volte
// por campo (`detalhes` do 400) e o formulário consiga destacar o input certo.
export const nomeSchema = z.string().trim().min(3, "Informe o nome completo.").max(140);

export const cpfSchema = z
  .string()
  .trim()
  .refine(cpfValido, "CPF inválido. Informe os 11 dígitos, como 123.456.789-09.");

export const emailSchema = z
  .string()
  .trim()
  .max(140)
  .refine((valor) => valor === "" || emailValido(valor), "E-mail inválido.")
  .nullish();

export const telefoneSchema = z
  .string()
  .trim()
  .max(20)
  .refine(
    (valor) => valor === "" || telefoneValido(valor),
    "Telefone inválido. Use +55 (00) 00000-0000, com DDD e nono dígito."
  )
  .nullish();

export const enderecoSchema = z.string().trim().max(255).nullish();

export const novoClienteSchema = z.object({
  nome: nomeSchema,
  cpf: cpfSchema,
  email: emailSchema,
  telefone: telefoneSchema,
  endereco: enderecoSchema,
});

// PATCH parcial: campo ausente não mexe, `null`/"" limpa.
export const edicaoClienteSchema = z.object({
  nome: nomeSchema.optional(),
  cpf: cpfSchema.optional(),
  email: emailSchema,
  telefone: telefoneSchema,
  endereco: enderecoSchema,
});
