import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { iniciais } from "@/lib/utils/nome";

export function AvatarIniciais({ nome, className }: { nome: string; className?: string }) {
  return (
    <Avatar className={cn("size-8 rounded-full", className)}>
      <AvatarFallback className="rounded-full text-xs">{iniciais(nome)}</AvatarFallback>
    </Avatar>
  );
}
