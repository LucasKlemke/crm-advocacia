"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AuthTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const value = pathname?.startsWith("/cadastro") ? "cadastro" : "login";

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        router.push(next === "cadastro" ? "/cadastro" : "/login");
      }}
    >
      <TabsList className="w-full">
        <TabsTrigger value="login" className="flex-1">
          Entrar
        </TabsTrigger>
        <TabsTrigger value="cadastro" className="flex-1">
          Cadastrar
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
