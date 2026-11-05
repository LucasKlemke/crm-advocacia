import type { ComponentPropsWithRef } from "react";
import { Link as LinkDoRouter, useInRouterContext } from "react-router";

export interface LinkProps extends Omit<ComponentPropsWithRef<"a">, "href"> {
  href: string;
  replace?: boolean;
  /** `false` preserva a rolagem ao navegar, como no next/link. */
  scroll?: boolean;
  /** Aceito só por compatibilidade com next/link — o SPA não faz prefetch de rota. */
  prefetch?: boolean | null;
}

// Mesma API de "next/link" sobre o React Router. Fora de um <Router> (componente
// renderizado isolado num teste) vira um <a> comum, como o next/link se comportava.
// React 19: `ref` chega como prop comum e segue no spread (Base UI usa isso em
// DropdownMenuItem render={<Link … />}).
export function Link({ href, replace, scroll, prefetch: _prefetch, ...props }: LinkProps) {
  const dentroDoRouter = useInRouterContext();

  if (!dentroDoRouter) {
    return <a href={href} {...props} />;
  }

  return (
    <LinkDoRouter to={href} replace={replace} preventScrollReset={scroll === false} {...props} />
  );
}

export default Link;
