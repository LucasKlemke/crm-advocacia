import { useEffect } from "react";
import { useRouteError } from "react-router";
import { Button } from "@/components/ui/button";

// errorElement da raiz: qualquer erro de render/loader cai aqui. O detalhe vai para o
// console (e para o New Relic do browser, quando configurado), nunca para a tela.
export function ErroRota() {
  const erro = useRouteError();

  useEffect(() => {
    console.error("Erro não tratado na rota", erro);
  }, [erro]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
      <h1 className="text-2xl font-semibold">Algo deu errado</h1>
      <p className="text-muted-foreground">Não foi possível exibir esta página. Tente recarregar.</p>
      <Button type="button" onClick={() => window.location.reload()}>
        Recarregar
      </Button>
    </div>
  );
}
