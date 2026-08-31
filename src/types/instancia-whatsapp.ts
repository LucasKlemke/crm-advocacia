import type { StatusInstanciaWhatsapp } from "@prisma/client";

// DTOs trafegados entre as rotas /api/instancias e o client. Datas chegam como string
// (JSON), por isso não dá para reusar os tipos do Prisma direto no componente.
// uazapiToken nunca aparece aqui: o service já remove esse campo antes de serializar.
export interface InstanciaWhatsappDTO {
  id: string;
  escritorioId: string;
  nome: string;
  uazapiInstanceId: string;
  status: StatusInstanciaWhatsapp;
  numeroConectado: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListaInstanciasWhatsapp {
  instancias: InstanciaWhatsappDTO[];
}

// Resposta de criação/reconexão: qrcode/paircode só vêm quando a UAZAPI devolve um
// código para escanear (qrcode é um data URL `data:image/png;base64,...`).
export interface RespostaConexaoInstanciaWhatsapp {
  instancia: InstanciaWhatsappDTO;
  qrcode?: string;
  paircode?: string;
}

export interface RespostaStatusInstanciaWhatsapp {
  instancia: InstanciaWhatsappDTO;
}
