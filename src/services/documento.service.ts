import { prisma } from "@/lib/prisma";
import { documentoRepository } from "@/repositories/documento.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { clienteService } from "@/services/cliente.service";
import { casoService } from "@/services/caso.service";
import { logService } from "@/services/log.service";
import { s3Client } from "@/lib/external/s3-client";
import { podeExcluirDocumento } from "@/lib/auth/permissoes";
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

const TAMANHO_MAXIMO_KB = 10 * 1024;

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
  tamanhoKb: number;
}

export interface UploadUrlResult {
  documentoId: string;
  uploadUrl: string;
  storageKey: string;
}

export interface ConfirmarUploadInput extends UploadUrlInput {
  storageKey: string;
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
    if (input.tamanhoKb > TAMANHO_MAXIMO_KB) {
      throw new TamanhoInvalidoError();
    }
    await garantirEscopo(ctx, input.escopo, input.escopoId);

    const documentoId = crypto.randomUUID();
    const storageKey = `${process.env.AWS_S3_PREFIX}/${ctx.escritorioId}/documentos/${input.escopo}/${input.escopoId}/${documentoId}-${input.nomeArquivo}`;

    const uploadUrl = await s3Client.gerarUrlUpload(
      storageKey,
      MIME_POR_TIPO_ARQUIVO[input.tipoArquivo],
      input.tamanhoKb * 1024
    );

    return { documentoId, uploadUrl, storageKey };
  },

  async confirmarUpload(
    ctx: TenantContext,
    documentoId: string,
    input: ConfirmarUploadInput
  ): Promise<Documento> {
    if (input.tamanhoKb > TAMANHO_MAXIMO_KB) {
      throw new TamanhoInvalidoError();
    }
    const nomeAlvo = await garantirEscopo(ctx, input.escopo, input.escopoId);

    // O autor é o Membro (não o Usuario) para manter o autor do upload escopado ao
    // tenant — getTenantContext() já validou essa membership, então o lookup aqui
    // nunca deveria falhar, mas é tratado defensivamente mesmo assim.
    const membro = await membroRepository.findByUsuarioEEscritorio(ctx.usuarioId, ctx.escritorioId);
    if (!membro) {
      throw new PermissaoDocumentoError();
    }

    return prisma.$transaction(async (tx) => {
      const documento = await documentoRepository.create(
        {
          id: documentoId,
          escopo: input.escopo,
          escopoId: input.escopoId,
          nomeOriginal: input.nomeArquivo,
          tipoArquivo: input.tipoArquivo,
          tamanhoKb: input.tamanhoKb,
          storageKey: input.storageKey,
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

  async gerarUrlDownload(ctx: TenantContext, id: string): Promise<string> {
    const documento = await this.obter(ctx, id);
    return s3Client.gerarUrlDownload(documento.storageKey);
  },

  async excluir(ctx: TenantContext, id: string): Promise<void> {
    const documento = await this.obter(ctx, id);
    const membro = await membroRepository.findByUsuarioEEscritorio(ctx.usuarioId, ctx.escritorioId);
    const ehAutor = membro?.id === documento.autorMembroId;

    if (!podeExcluirDocumento(ctx.role, ehAutor)) {
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
};
