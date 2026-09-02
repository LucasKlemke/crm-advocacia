import { NextResponse } from "next/server";
import {
  CampanhaNaoEncontradaError,
  CampanhaSemInstanciaError,
  DestinatariosInvalidosError,
  InstanciaNaoConectadaError,
  PermissaoNegadaError,
  VariavelSemColunaError,
} from "@/services/campanha.service";
import { InstanciaWhatsappNaoEncontradaError } from "@/services/instancia-whatsapp.service";
import { UazapiIndisponivelError } from "@/lib/external/uazapi-client";

export function tratarErroDeCampanha(error: unknown) {
  if (error instanceof CampanhaNaoEncontradaError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  // A campanha aponta para uma instância que não é deste tenant (ou não existe mais):
  // 404 pelo mesmo motivo — não confirmar a existência de dado de outro escritório.
  if (error instanceof InstanciaWhatsappNaoEncontradaError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoNegadaError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  // Estado do recurso impede a operação (instância desconectada ou sem vínculo): 409,
  // não 400 — o corpo enviado pelo cliente está correto.
  if (error instanceof InstanciaNaoConectadaError || error instanceof CampanhaSemInstanciaError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  // Erros de conteúdo da planilha/mensagem: o usuário precisa corrigir o que enviou.
  if (error instanceof VariavelSemColunaError || error instanceof DestinatariosInvalidosError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  // Falha de comunicação com a UAZAPI é indisponibilidade de dependência externa, não erro do cliente.
  if (error instanceof UazapiIndisponivelError) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return null;
}
