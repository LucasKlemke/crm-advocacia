"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CadastroPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      nomeEscritorio: formData.get("nomeEscritorio"),
      nomeTitular: formData.get("nomeTitular"),
      email: formData.get("email"),
      senha: formData.get("senha"),
    };

    try {
      const response = await fetch("/api/escritorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setErro(data?.error ?? "Não foi possível concluir o cadastro.");
        return;
      }

      const loginResult = await signIn("credentials", {
        email: payload.email,
        senha: payload.senha,
        redirect: false,
      });

      if (loginResult?.error) {
        router.push("/login");
        return;
      }

      router.push("/");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Card className="w-full ring-foreground/5 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Cadastre seu escritório</CardTitle>
        <CardDescription>
          Crie sua conta para começar a usar o CRM. Você será o usuário titular.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nomeEscritorio">Nome do escritório</Label>
            <Input id="nomeEscritorio" name="nomeEscritorio" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nomeTitular">Seu nome</Label>
            <Input id="nomeTitular" name="nomeTitular" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              name="senha"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {erro ? (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={carregando}
            className="mt-1 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            {carregando ? "Cadastrando..." : "Cadastrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
