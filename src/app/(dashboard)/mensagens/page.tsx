import type { Metadata } from "next";
import { EmConstrucao } from "@/components/shared/em-construcao";

export const metadata: Metadata = {
  title: "Mensagens",
};

export default function MensagensPage() {
  return (
    <EmConstrucao
      titulo="Mensagens"
      descricao="Em breve você vai disparar mensagens de WhatsApp para seus clientes a partir de templates e acompanhar o histórico de cada envio."
    />
  );
}
