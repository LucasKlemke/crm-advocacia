"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { LogIn, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

// Só aceita path relativo interno ("/rota"), nunca URL absoluta/protocol-relative
// ("//host" ou "https://host") — evita open redirect via callbackUrl manipulado.
function destinoSeguro(callbackUrl: string | null): string {
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/";
  }
  return callbackUrl;
}

export default function LoginPage() {
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await signIn("credentials", {
        email: formData.get("email"),
        senha: formData.get("senha"),
        redirect: false,
      });

      if (result?.error) {
        setErro("E-mail ou senha inválidos.");
        return;
      }

      // Navegação forçada (não router.push): o Router Cache do Next pode ter uma
      // entrada de "/" com o redirect para /login pré-fetchada enquanto ainda
      // deslogado (via o Link da marca no layout de auth) — só um reload garante que
      // o middleware releia a sessão recém-criada em vez de reusar esse cache stale.
      const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
      window.location.href = destinoSeguro(callbackUrl);
    } catch {
      setErro("Não foi possível entrar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-medium tracking-tight">Bem-vindo(a) de volta</h1>
        <p className="text-sm text-muted-foreground">Acesse o CRM com seu e-mail e senha.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              autoComplete="current-password"
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
          <LogIn />
          {carregando ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-foreground underline-offset-4 hover:underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
