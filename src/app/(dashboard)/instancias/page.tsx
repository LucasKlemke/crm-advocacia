import type { Metadata } from "next";
import { EmConstrucao } from "@/components/shared/em-construcao";

export const metadata: Metadata = {
  title: "Instâncias",
};

export default function InstanciasPage() {
  return (
    <EmConstrucao
      titulo="Instâncias de WhatsApp"
      descricao="Aqui você vai conectar o WhatsApp do escritório por QR Code e acompanhar o status de cada instância conectada. Estamos construindo essa tela."
    />
  );
}
