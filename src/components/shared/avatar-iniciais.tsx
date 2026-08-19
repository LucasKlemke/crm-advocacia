import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { iniciais } from "@/lib/utils/nome";

export function AvatarIniciais({ nome }: { nome: string }) {
  return (
    <Avatar className="size-8 rounded-full">
      <AvatarFallback className="rounded-full text-xs">{iniciais(nome)}</AvatarFallback>
    </Avatar>
  );
}
