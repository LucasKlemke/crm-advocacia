import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { iniciais } from "@/lib/utils/nome";

export function AvatarIniciais({
  nome,
  avatarUrl,
  className,
}: {
  nome: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-8 rounded-full", className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className="rounded-full text-xs">{iniciais(nome)}</AvatarFallback>
    </Avatar>
  );
}
