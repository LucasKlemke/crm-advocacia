"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { User, Mail, Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";

export default function CadastroPage() {
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [senha, setSenha] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      nome: formData.get("nome"),
      email: formData.get("email"),
      senha: formData.get("senha"),
    };

    if (payload.senha !== formData.get("confirmarSenha")) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);

    try {
      const response = await fetch("/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setErro(data?.error ?? "Não foi possível concluir o cadastro.");
        return;
      }

      const loginResult = await signIn("credentials", {
        email: payload.email,
        senha: payload.senha,
        redirect: false,
      });

      if (loginResult?.error) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
        return;
      }

      // Navegação forçada (não router.push): evita reusar uma entrada stale do Router
      // Cache pré-fetchada enquanto ainda deslogado (mesmo problema do /login).
      window.location.href = data?.temEscritorio ? "/" : "/onboarding";
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-medium tracking-tight">Crie sua conta</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre-se com seu nome, e-mail e senha para começar a usar o CRM.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome">Seu nome</Label>
          <InputGroup className="h-14 shrink-0 rounded-full border-transparent bg-background shadow-sm">
            <InputGroupAddon className="mr-2 self-stretch border-r border-border pr-3 pl-5">
              <User />
            </InputGroupAddon>
            <InputGroupInput id="nome" name="nome" required />
          </InputGroup>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <InputGroup className="h-14 shrink-0 rounded-full border-transparent bg-background shadow-sm">
            <InputGroupAddon className="mr-2 self-stretch border-r border-border pr-3 pl-5">
              <Mail />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </InputGroup>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="senha">Senha</Label>
          <InputGroup className="h-14 shrink-0 rounded-full border-transparent bg-background shadow-sm">
            <InputGroupAddon className="mr-2 self-stretch border-r border-border pr-3 pl-5">
              <Lock />
            </InputGroupAddon>
            <InputGroupInput
              id="senha"
              name="senha"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
          </InputGroup>
          <PasswordStrengthMeter senha={senha} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmarSenha">Confirmar senha</Label>
          <InputGroup className="h-14 shrink-0 rounded-full border-transparent bg-background shadow-sm">
            <InputGroupAddon className="mr-2 self-stretch border-r border-border pr-3 pl-5">
              <Lock />
            </InputGroupAddon>
            <InputGroupInput
              id="confirmarSenha"
              name="confirmarSenha"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </InputGroup>
        </div>
        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        <Button type="submit" disabled={carregando} className="mt-1 h-14 shrink-0 rounded-full text-base">
          <UserPlus />
          {carregando ? "Cadastrando..." : "Cadastrar"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Já possui cadastro?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Faça login
        </Link>
      </p>
    </div>
  );
}
