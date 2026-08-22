"use client";

import { usePathname } from "next/navigation";

// A data fica no header de todas as telas menos o dashboard ("/"), onde ela já
// aparece no card de saudação — repetir as duas na mesma dobra é ruído.
export function HeaderData({ data }: { data: string }) {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return <span className="ml-auto text-sm text-muted-foreground">{data}</span>;
}
