import {
  CampanhaNaoEncontradaError,
  CampanhaSemInstanciaError,
  DestinatariosInvalidosError,
  InstanciaNaoConectadaError,
  PermissaoNegadaError,
  VariavelSemColunaError,
} from "@dominio/services/campanha.service";
import { InstanciaWhatsappNaoEncontradaError } from "@dominio/services/instancia-whatsapp.service";
import { UazapiIndisponivelError } from "@dominio/lib/external/uazapi-client";

export function tratarErroDeCampanha(error: unknown) {
  if (error instanceof CampanhaNaoEncontradaError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  // A campanha aponta para uma instância que não é deste tenant (ou não existe mais):
  // 404 pelo mesmo motivo — não confirmar a existência de dado de outro escritório.
  if (error instanceof InstanciaWhatsappNaoEncontradaError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoNegadaError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  // Estado do recurso impede a operação (instância desconectada ou sem vínculo): 409,
  // não 400 — o corpo enviado pelo cliente está correto.
  if (error instanceof InstanciaNaoConectadaError || error instanceof CampanhaSemInstanciaError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  // Erros de conteúdo da planilha/mensagem: o usuário precisa corrigir o que enviou.
  if (error instanceof VariavelSemColunaError || error instanceof DestinatariosInvalidosError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  // Falha de comunicação com a UAZAPI é indisponibilidade de dependência externa, não erro do cliente.
  if (error instanceof UazapiIndisponivelError) {
    return Response.json({ error: error.message }, { status: 502 });
  }
  return null;
}
