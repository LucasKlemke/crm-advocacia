import { prisma } from "@/lib/prisma";
import { documentoRepository } from "@/repositories/documento.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { clienteService } from "@/services/cliente.service";
import { casoService } from "@/services/caso.service";
import { logService } from "@/services/log.service";
import { s3Client } from "@/lib/external/s3-client";
import { podeModerarDocumento } from "@/lib/auth/permissoes";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Documento, EscopoDocumento, TipoArquivo } from "@prisma/client";

export class DocumentoNaoEncontradoError extends Error {
  constructor() {
    super("Documento não encontrado.");
    this.name = "DocumentoNaoEncontradoError";
  }
}

export class PermissaoDocumentoError extends Error {
  constructor() {
    super("Você não tem permissão para excluir este documento.");
    this.name = "PermissaoDocumentoError";
  }
}

export class TamanhoInvalidoError extends Error {
  constructor() {
    super("O arquivo excede o tamanho máximo permitido (10MB).");
    this.name = "TamanhoInvalidoError";
  }
}

// RN18: tipo fora da lista aceita, ou declarado diferente da extensão do nome do arquivo
// (ex. `malware.exe` enviado como `pdf`).
export class TipoInvalidoError extends Error {
  constructor() {
    super("Tipo de arquivo inválido. Aceitos: PDF, DOCX, JPG, JPEG, PNG.");
    this.name = "TipoInvalidoError";
  }
}

// Confirmação de um id que já existe no tenant apontando para outro alvo — não é replay
// legítimo do mesmo upload, então nem cria nem devolve a linha existente.
export class DocumentoConflitanteError extends Error {
  constructor() {
    super("Este documento já foi confirmado com outros dados.");
    this.name = "DocumentoConflitanteError";
  }
}

const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;
const URL_DOWNLOAD_SEGUNDOS = 60;
// Visualização embutida fica aberta na tela enquanto o usuário lê o documento — 60s
// (padrão de download) expiraria no meio da leitura de um PDF longo.
const URL_VISUALIZACAO_SEGUNDOS = 5 * 60;

const MIME_POR_TIPO_ARQUIVO: Record<TipoArquivo, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export interface UploadUrlInput {
  escopo: EscopoDocumento;
  escopoId: string;
  nomeArquivo: string;
  tipoArquivo: TipoArquivo;
  // Bytes exatos, não KB arredondado: o Content-Length é um header assinado pela URL do
  // S3 (X-Amz-SignedHeaders), então precisa bater byte a byte com o PUT real do
  // navegador — um valor arredondado quase sempre diverge e o S3 responde 403.
  tamanhoBytes: number;
}

export interface UploadUrlResult {
  documentoId: string;
  uploadUrl: string;
  storageKey: string;
}

// Env ausente/errado produziria keys começando com a string literal "undefined/" sem
// nenhum sinal de erro — falha explícita é preferível a lixo silencioso no bucket.
function obterPrefixoS3(): string {
  const prefixo = process.env.AWS_S3_PREFIX;
  if (!prefixo) {
    throw new Error("AWS_S3_PREFIX não configurado.");
  }
  return prefixo;
}

// RN17/RN18 valem na Service, não só no zod da rota: a regra é de negócio e vale para
// qualquer chamador (defesa em profundidade — CLAUDE.md, camada Service).
function validarTipo(nomeArquivo: string, tipoArquivo: TipoArquivo): void {
  if (!Object.prototype.hasOwnProperty.call(MIME_POR_TIPO_ARQUIVO, tipoArquivo)) {
    throw new TipoInvalidoError();
  }
  if (!nomeArquivo.toLowerCase().endsWith(`.${tipoArquivo}`)) {
    throw new TipoInvalidoError();
  }
}

function ehViolacaoDeUnique(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

// Única fonte da key: gerarUrlUpload assina exatamente esta key e confirmarUpload a
// reconstrói a partir do mesmo id (vindo da URL), sem confiar em nada enviado no body.
function montarStorageKey(
  escritorioId: string,
  escopo: EscopoDocumento,
  escopoId: string,
  documentoId: string,
  nomeArquivo: string
): string {
  return `${obterPrefixoS3()}/${escritorioId}/documentos/${escopo}/${escopoId}/${documentoId}-${nomeArquivo}`;
}

// Valida que o alvo do documento existe e é do tenant, antes de ancorar qualquer
// coisa nele — como (escopo, escopo_id) não tem FK, essa checagem é a única garantia
// (mesmo padrão de ComentarioService.garantirEscopo).
async function garantirEscopo(
  ctx: TenantContext,
  escopo: EscopoDocumento,
  escopoId: string
): Promise<string> {
  switch (escopo) {
    case "cliente": {
      const cliente = await clienteService.obter(ctx, escopoId);
      return cliente.nome;
    }
    case "caso": {
      const caso = await casoService.obter(ctx, escopoId);
      return caso.titulo;
    }
  }
}

export const documentoService = {
  async gerarUrlUpload(ctx: TenantContext, input: UploadUrlInput): Promise<UploadUrlResult> {
    validarTipo(input.nomeArquivo, input.tipoArquivo);
    if (input.tamanhoBytes > TAMANHO_MAXIMO_BYTES) {
      throw new TamanhoInvalidoError();
    }
    await garantirEscopo(ctx, input.escopo, input.escopoId);

    const documentoId = crypto.randomUUID();
    const storageKey = montarStorageKey(
      ctx.escritorioId,
      input.escopo,
      input.escopoId,
      documentoId,
      input.nomeArquivo
    );

    const uploadUrl = await s3Client.gerarUrlUpload(
      storageKey,
      MIME_POR_TIPO_ARQUIVO[input.tipoArquivo],
      input.tamanhoBytes
    );

    return { documentoId, uploadUrl, storageKey };
  },

  async confirmarUpload(
    ctx: TenantContext,
    documentoId: string,
    input: UploadUrlInput
  ): Promise<Documento> {
    validarTipo(input.nomeArquivo, input.tipoArquivo);
    if (input.tamanhoBytes > TAMANHO_MAXIMO_BYTES) {
      throw new TamanhoInvalidoError();
    }

    // Confirmação duplicada (duplo clique, retry do cliente) bateria na unique do id e
    // subiria como 500 — replay do mesmo upload é idempotente e devolve a linha já criada,
    // sem segundo log (RN20: um log por mudança efetivada, e nada mudou aqui).
    const existente = await documentoRepository.findById(documentoId);
    if (existente) {
      if (existente.escritorioId !== ctx.escritorioId) {
        throw new DocumentoNaoEncontradoError();
      }
      if (existente.escopo !== input.escopo || existente.escopoId !== input.escopoId) {
        throw new DocumentoConflitanteError();
      }
      return existente;
    }

    const nomeAlvo = await garantirEscopo(ctx, input.escopo, input.escopoId);

    // O autor é o Membro (não o Usuario) para manter o autor do upload escopado ao
    // tenant — getTenantContext() já validou essa membership, então o lookup aqui
    // nunca deveria falhar, mas é tratado defensivamente mesmo assim.
    const membro = await membroRepository.findByUsuarioEEscritorio(ctx.usuarioId, ctx.escritorioId);
    if (!membro) {
      throw new PermissaoDocumentoError();
    }

    // A key não vem do cliente: é re-derivada aqui com a mesma fórmula de gerarUrlUpload,
    // a partir do id da URL — assim nenhum body pode apontar a linha para um objeto de
    // outro escritório (RN19).
    const storageKey = montarStorageKey(
      ctx.escritorioId,
      input.escopo,
      input.escopoId,
      documentoId,
      input.nomeArquivo
    );

    try {
      return await prisma.$transaction(async (tx) => {
        const documento = await documentoRepository.create(
          {
            id: documentoId,
            escopo: input.escopo,
            escopoId: input.escopoId,
            nomeOriginal: input.nomeArquivo,
            tipoArquivo: input.tipoArquivo,
            tamanhoKb: Math.ceil(input.tamanhoBytes / 1024),
            storageKey,
            escritorio: { connect: { id: ctx.escritorioId } },
            autor: { connect: { id: membro.id } },
          },
          tx
        );

        await logService.registrar(
          ctx,
          {
            acao: "criar",
            entidade: "documento",
            entidadeId: documento.id,
            resumo: `Documento "${input.nomeArquivo}" anexado ao ${input.escopo} ${nomeAlvo}`,
          },
          tx
        );

        return documento;
      });
    } catch (error) {
      // Duas confirmações concorrentes passam as duas pela checagem acima: a perdedora
      // bate na unique e responde conflito, não 500.
      if (ehViolacaoDeUnique(error)) {
        throw new DocumentoConflitanteError();
      }
      throw error;
    }
  },

  async listarPorEscopo(
    ctx: TenantContext,
    escopo: EscopoDocumento,
    escopoId: string
  ): Promise<Documento[]> {
    await garantirEscopo(ctx, escopo, escopoId);
    return documentoRepository.listarPorEscopo(ctx.escritorioId, escopo, escopoId);
  },

  async obter(ctx: TenantContext, id: string): Promise<Documento> {
    const documento = await documentoRepository.findById(id);
    if (
      !documento ||
      documento.escritorioId !== ctx.escritorioId ||
      documento.softDeletedAt !== null
    ) {
      throw new DocumentoNaoEncontradoError();
    }
    return documento;
  },

  async gerarUrlDownload(ctx: TenantContext, id: string, inline = false): Promise<string> {
    const documento = await this.obter(ctx, id);
    // nomeOriginal (não a storageKey) reflete o nome atual do documento: renomear não
    // move o objeto no S3, só troca esse metadado. `inline` deixa o navegador exibir o
    // arquivo embutido (pdf/imagem) em vez de sempre baixar — e usa uma expiração maior
    // porque a visualização fica aberta na tela por mais tempo que um download imediato.
    const expiresIn = inline ? URL_VISUALIZACAO_SEGUNDOS : URL_DOWNLOAD_SEGUNDOS;
    return s3Client.gerarUrlDownload(documento.storageKey, expiresIn, documento.nomeOriginal, inline);
  },

  async excluir(ctx: TenantContext, id: string): Promise<void> {
    const documento = await this.obter(ctx, id);
    const membro = await membroRepository.findByUsuarioEEscritorio(ctx.usuarioId, ctx.escritorioId);
    const ehAutor = membro?.id === documento.autorMembroId;

    if (!podeModerarDocumento(ctx.role, ehAutor)) {
      throw new PermissaoDocumentoError();
    }

    await prisma.$transaction(async (tx) => {
      await documentoRepository.marcarExcluido(id, new Date(), tx);
      await logService.registrar(
        ctx,
        {
          acao: "excluir",
          entidade: "documento",
          entidadeId: id,
          resumo: `Documento "${documento.nomeOriginal}" excluído`,
        },
        tx
      );
    });
  },

  // Renomear troca só o nomeOriginal exibido; a extensão precisa continuar batendo com o
  // tipoArquivo já confirmado (RN18) — trocar de tipo não é "renomear", é outro upload.
  async renomear(ctx: TenantContext, id: string, novoNome: string): Promise<Documento> {
    const documento = await this.obter(ctx, id);
    validarTipo(novoNome, documento.tipoArquivo);

    const membro = await membroRepository.findByUsuarioEEscritorio(ctx.usuarioId, ctx.escritorioId);
    const ehAutor = membro?.id === documento.autorMembroId;

    if (!podeModerarDocumento(ctx.role, ehAutor)) {
      throw new PermissaoDocumentoError();
    }

    return prisma.$transaction(async (tx) => {
      const renomeado = await documentoRepository.atualizarNome(id, novoNome, tx);
      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "documento",
          entidadeId: id,
          resumo: `Documento "${documento.nomeOriginal}" renomeado para "${novoNome}"`,
        },
        tx
      );
      return renomeado;
    });
  },
};
