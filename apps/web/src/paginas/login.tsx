import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { LogIn, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { InputGroupPasswordInput } from "@/components/ui/input-group-password";
import { entrar } from "@/lib/sessao";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";

// Resolve o destino contra a origem atual e só o aceita se continuar nela. Pegar só o
// prefixo "/" não basta: "/\\evil.com", "/\t/evil.com" e afins o browser normaliza para
// outro host (open redirect via callbackUrl manipulado).
export function destinoSeguro(callbackUrl: string | null): string {
  if (!callbackUrl) return "/";
  try {
    const url = new URL(callbackUrl, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

export function PaginaLogin() {
  useTituloPagina("Entrar");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const formData = new FormData(event.currentTarget);

    try {
      const ok = await entrar(String(formData.get("email") ?? ""), String(formData.get("senha") ?? ""));
      if (!ok) {
        setErro("E-mail ou senha inválidos.");
        return;
      }
      // Navegação dura de propósito: o reload descarta qualquer cache em memória de uma
      // sessão anterior e a SPA relê /api/auth/sessao do zero.
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
            <InputGroupInput id="email" name="email" type="email" autoComplete="email" required />
          </InputGroup>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="senha">Senha</Label>
          <InputGroup className="h-14 shrink-0 rounded-full border-transparent bg-background shadow-sm">
            <InputGroupAddon className="mr-2 self-stretch border-r border-border pr-3 pl-5">
              <Lock />
            </InputGroupAddon>
            <InputGroupPasswordInput id="senha" name="senha" autoComplete="current-password" required />
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
        <Link to="/cadastro" className="font-medium text-foreground underline-offset-4 hover:underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
