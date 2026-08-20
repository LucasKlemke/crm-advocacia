# Armazenamento de Arquivos (S3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar upload/download de documentos anexados a `cliente`/`caso` (com "baixar todos" em zip) e upload/troca de avatar de usuário, tudo via S3 com URLs assinadas.

**Architecture:** Um novo `S3Client` (`src/lib/external/s3-client.ts`) é o único ponto de contato com o SDK da AWS, chamado apenas por Services — nunca por Controllers/Repositories, seguindo a camada já descrita no `CLAUDE.md`. Documentos ganham uma tabela nova (`documento`, escopo `cliente`/`caso` sem FK, mesmo padrão de `comentario`) com `DocumentoRepository` + `DocumentoService` espelhando `comentario.repository.ts`/`comentario.service.ts` linha a linha. Avatar não ganha tabela: é só `usuario.avatar_url` (já existe no schema, hoje sem nenhum escritor) atualizado por dois métodos novos em `usuarioService`. Upload é sempre presigned PUT (browser → S3 direto); download individual é presigned GET; "baixar todos" é um zip montado em stream no servidor via `archiver`, lendo cada objeto do S3 em stream.

**Tech Stack:** Next.js 16 (App Router) + TypeScript, Prisma ORM, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `archiver`, Jest + `aws-sdk-client-mock` para os testes do `S3Client`.

**Spec:** [docs/superpowers/specs/2026-08-20-armazenamento-arquivos-s3-design.md](../specs/2026-08-20-armazenamento-arquivos-s3-design.md)

## Global Constraints

- Documentos: máx. 10.240 KB (10MB), tipos aceitos `pdf | docx | jpg | png | jpeg` (RN17/RN18).
- Avatar: máx. 5.120 KB (5MB), tipos aceitos `jpeg | png | webp` — mais restrito que documento.
- URLs assinadas (PUT e GET) expiram em 60s.
- Toda key de documento fica sob `{AWS_S3_PREFIX}/{escritorio_id}/documentos/{escopo}/{escopo_id}/{documento_id}-{nome_original}` (RN19 reforçado também no storage).
- Toda escrita de domínio (criar/excluir documento) grava em `log` na mesma transação (RN20) — avatar não gera log (é dado de perfil, não de domínio jurídico).
- Exclusão de documento é soft delete (`soft_deleted_at`); o objeto permanece no S3.
- Exclusão de documento: autor do upload, `owner` ou `admin` do escritório (RN21, mesmo padrão de `comentario`).
- `escopo_id` de documento não tem FK — a validação de que pertence ao tenant da sessão é feita no Service antes de qualquer escrita, exatamente como em `ComentarioService`.
- Alvo de outro tenant ou inexistente → 404 genérico (nunca revela que o recurso existe em outro escritório).
- Falha do S3 ao gerar URL ou montar zip → 502 com mensagem genérica; detalhe técnico só em log estruturado do servidor.
- Variáveis de ambiente novas: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_S3_PREFIX` (`development` | `producao`).
- Mensagens de commit em Conventional Commits, em português, entidades em português (`docs/git/commits-e-branches.md`); migration de schema entra no mesmo commit do código que a motiva.

## Desvios deliberados em relação à spec (documentados aqui para não serem "bugs" na revisão)

1. **`documento.autor_membro_id` vs. `TenantContext`**: a spec define a FK do autor como `membro` (não `usuario`, diferente de `comentario.autor_usuario_id`), para manter o autor do upload escopado ao tenant. Só que `TenantContext` (retornado por `getTenantContext()`) carrega `usuarioId`, não `membroId`. O plano resolve isso buscando o `Membro` correspondente via `membroRepository.findByUsuarioEEscritorio(ctx.usuarioId, ctx.escritorioId)` dentro do `DocumentoService`, tanto para gravar o autor quanto para checar permissão de exclusão. Esse lookup nunca deveria retornar `null` (a própria `getTenantContext()` já validou a membership), mas o código trata o caso defensivamente lançando `PermissaoDocumentoError`.
2. **Key do avatar não leva `escritorio_id`**: a spec lista o template `{AWS_S3_PREFIX}/{escritorio_id}/avatares/{usuario_id}/{timestamp}-{nome}`, mas `usuario.avatar_url` é um campo único por `Usuario`, e um `Usuario` pode ter `Membro` em vários escritórios (N:N). Não existe um "escritório da sessão" estável para esse campo — a rota de perfil hoje (`src/app/api/perfil/route.ts`) nem usa `getTenantContext()`, só `auth()`, porque o usuário pode estar em onboarding sem nenhum escritório ainda. Este plano usa `{AWS_S3_PREFIX}/avatares/{usuario_id}/{timestamp}-{nome_original}`, sem segmento de escritório, porque avatar é dado de perfil global do usuário, não dado de tenant.

---

### Task 1: Dependências e variáveis de ambiente

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nada.
- Produces: pacotes `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `archiver` (+ `@types/archiver`, `aws-sdk-client-mock` como devDependency) disponíveis para todas as tasks seguintes.

- [ ] **Step 1: Instalar as dependências de produção**

```bash
cd /Users/luke/Desktop/CRM_ADVOCACIA_PORTIFOLIO_CATOLICA
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner archiver
```

- [ ] **Step 2: Instalar as dependências de desenvolvimento**

```bash
npm install -D @types/archiver aws-sdk-client-mock
```

- [ ] **Step 3: Adicionar as variáveis de ambiente novas em `.env.example`**

Adicionar ao final do arquivo:

```
AWS_ACCESS_KEY_ID="troque-pelo-access-key-do-usuario-iam"
AWS_SECRET_ACCESS_KEY="troque-pelo-secret-key-do-usuario-iam"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="troque-pelo-nome-do-bucket"
AWS_S3_PREFIX="development"
```

- [ ] **Step 4: Verificar que o projeto ainda builda com as dependências novas**

Run: `npm run build`
Expected: build conclui sem erro (nenhum código novo ainda usa os pacotes, então isso só confirma que a instalação não quebrou nada).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore(deps): adiciona SDK da AWS S3, archiver e variáveis de ambiente do storage"
```

---

### Task 2: Modelo `Documento` no schema Prisma

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_cria_documento/` (gerado pelo `prisma migrate dev`)

**Interfaces:**
- Consumes: nada.
- Produces: `model Documento` com campos `id, escritorioId, escopo (EscopoDocumento), escopoId, autorMembroId, nomeOriginal, tipoArquivo (TipoArquivo), tamanhoKb, storageKey, softDeletedAt, createdAt, updatedAt`; enums `EscopoDocumento { cliente caso }` e `TipoArquivo { pdf docx jpg png jpeg }`; valor `documento` adicionado ao enum `EntidadeLog`. Tipos gerados pelo Prisma Client (`Documento`, `EscopoDocumento`, `TipoArquivo`) usados por todas as tasks seguintes.

- [ ] **Step 1: Adicionar os enums novos em `prisma/schema.prisma`**

Logo abaixo do enum `EscopoComentario` existente:

```prisma
enum EscopoDocumento {
  cliente
  caso
}

enum TipoArquivo {
  pdf
  docx
  jpg
  png
  jpeg
}
```

- [ ] **Step 2: Adicionar `documento` ao enum `EntidadeLog`**

O enum hoje é:

```prisma
enum EntidadeLog {
  cliente
  comentario
  caso
  status
  membro
}
```

Alterar para:

```prisma
enum EntidadeLog {
  cliente
  comentario
  caso
  status
  membro
  documento
}
```

- [ ] **Step 3: Adicionar o model `Documento`**

Logo abaixo do model `Comentario`:

```prisma
model Documento {
  id             String          @id @default(uuid())
  escritorioId   String          @map("escritorio_id")
  escopo         EscopoDocumento
  escopoId       String          @map("escopo_id")
  autorMembroId  String          @map("autor_membro_id")
  nomeOriginal   String          @map("nome_original") @db.VarChar(255)
  tipoArquivo    TipoArquivo     @map("tipo_arquivo")
  tamanhoKb      Int             @map("tamanho_kb")
  storageKey     String          @map("storage_key") @db.VarChar(500)
  softDeletedAt  DateTime?       @map("soft_deleted_at")
  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt @map("updated_at")

  escritorio Escritorio @relation(fields: [escritorioId], references: [id], onDelete: Cascade)
  autor      Membro     @relation(fields: [autorMembroId], references: [id], onDelete: Restrict)

  @@index([escritorioId, escopo, escopoId, softDeletedAt])
  @@map("documento")
}
```

- [ ] **Step 4: Adicionar as relações inversas em `Escritorio` e `Membro`**

Em `model Escritorio`, junto das outras listas de relação (`comentarios`, `logs`, etc.):

```prisma
  documentos  Documento[]
```

Em `model Membro`, junto de `casos`:

```prisma
  documentos Documento[]
```

- [ ] **Step 5: Gerar e aplicar a migration**

Run: `npx prisma migrate dev --name cria_documento`
Expected: cria `prisma/migrations/<timestamp>_cria_documento/migration.sql`, aplica no banco local sem erro, roda `prisma generate` automaticamente.

- [ ] **Step 6: Verificar que o Prisma Client gerado expõe os tipos novos**

Run: `npx tsc --noEmit`
Expected: sem erros de tipo (o schema ainda não é usado por nenhum código, então isso só confirma que a geração do client foi bem-sucedida).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(documentos): adiciona modelo documento e enum documento em log"
```

---

### Task 3: `S3Client`

**Files:**
- Create: `src/lib/external/s3-client.ts`
- Test: `src/lib/external/s3-client.test.ts`

**Interfaces:**
- Consumes: `process.env.AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`.
- Produces: `export const s3Client = { gerarUrlUpload(key: string, contentType: string, contentLength: number): Promise<string>; gerarUrlDownload(key: string): Promise<string>; buscarArquivo(key: string): Promise<Readable>; excluirArquivo(key: string): Promise<void>; }` — usado por `DocumentoService`, `usuarioService` (avatar) e pelo helper de zip.

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/lib/external/s3-client.test.ts
import { mockClient } from "aws-sdk-client-mock";
import {
  S3Client as AwsS3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(async (_client: unknown, command: { constructor: { name: string } }) => {
    return `https://bucket.s3.amazonaws.com/signed?op=${command.constructor.name}`;
  }),
}));

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "./s3-client";

const s3Mock = mockClient(AwsS3Client);

beforeEach(() => {
  s3Mock.reset();
  process.env.AWS_REGION = "us-east-1";
  process.env.AWS_ACCESS_KEY_ID = "fake-key";
  process.env.AWS_SECRET_ACCESS_KEY = "fake-secret";
  process.env.AWS_S3_BUCKET = "bucket-teste";
});

describe("s3Client.gerarUrlUpload", () => {
  it("gera uma URL assinada de PUT com bucket, key, content-type e tamanho corretos", async () => {
    const url = await s3Client.gerarUrlUpload("development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf", "application/pdf", 1024);

    expect(url).toContain("op=PutObjectCommand");
    const mocked = getSignedUrl as jest.Mock;
    const command = mocked.mock.calls[0][1] as PutObjectCommand;
    expect(command.input).toEqual({
      Bucket: "bucket-teste",
      Key: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
      ContentType: "application/pdf",
      ContentLength: 1024,
    });
  });
});

describe("s3Client.gerarUrlDownload", () => {
  it("gera uma URL assinada de GET com bucket e key corretos", async () => {
    const url = await s3Client.gerarUrlDownload("development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf");

    expect(url).toContain("op=GetObjectCommand");
    const mocked = getSignedUrl as jest.Mock;
    const command = mocked.mock.calls[0][1] as GetObjectCommand;
    expect(command.input).toEqual({
      Bucket: "bucket-teste",
      Key: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    });
  });
});

describe("s3Client.buscarArquivo", () => {
  it("devolve o stream do objeto", async () => {
    const stream = Readable.from([Buffer.from("conteudo do arquivo")]);
    s3Mock.on(GetObjectCommand).resolves({ Body: stream });

    const resultado = await s3Client.buscarArquivo("development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf");

    const chunks: Buffer[] = [];
    for await (const chunk of resultado) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).toString()).toBe("conteudo do arquivo");
  });
});

describe("s3Client.excluirArquivo", () => {
  it("chama DeleteObject com bucket e key corretos", async () => {
    s3Mock.on(DeleteObjectCommand).resolves({});

    await s3Client.excluirArquivo("development/esc-1/avatares/user-1/123-foto.png");

    expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(1);
    expect(s3Mock.commandCalls(DeleteObjectCommand)[0].args[0].input).toEqual({
      Bucket: "bucket-teste",
      Key: "development/esc-1/avatares/user-1/123-foto.png",
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/lib/external/s3-client.test.ts`
Expected: FAIL — `Cannot find module './s3-client'`.

- [ ] **Step 3: Implementar `S3Client`**

```ts
// src/lib/external/s3-client.ts
import {
  S3Client as AwsS3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

const URL_EXPIRA_SEGUNDOS = 60;

function criarClienteAws(): AwsS3Client {
  return new AwsS3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  });
}

// Único ponto de contato com o SDK da AWS — chamado só por Services (CLAUDE.md:
// Auth Middleware → Tenant Context → Controller → Service → Cliente Externo).
export const s3Client = {
  async gerarUrlUpload(key: string, contentType: string, contentLength: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    return getSignedUrl(criarClienteAws(), command, { expiresIn: URL_EXPIRA_SEGUNDOS });
  },

  async gerarUrlDownload(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    });
    return getSignedUrl(criarClienteAws(), command, { expiresIn: URL_EXPIRA_SEGUNDOS });
  },

  async buscarArquivo(key: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    });
    const resposta = await criarClienteAws().send(command);
    return resposta.Body as Readable;
  },

  async excluirArquivo(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    });
    await criarClienteAws().send(command);
  },
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/lib/external/s3-client.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/external/s3-client.ts src/lib/external/s3-client.test.ts
git commit -m "feat(storage): adiciona S3Client com upload/download assinados e leitura em stream"
```

---

### Task 4: `DocumentoRepository`

**Files:**
- Create: `src/repositories/documento.repository.ts`
- Test: `src/repositories/documento.repository.test.ts`

**Interfaces:**
- Consumes: `prisma` (`src/lib/prisma.ts`), tipos `Documento`, `EscopoDocumento`, `Prisma`, `PrismaClient` de `@prisma/client`.
- Produces: `export const documentoRepository = { create(data, db?), findById(id, db?), listarPorEscopo(escritorioId, escopo, escopoId, db?), marcarExcluido(id, quando, db?) }` — usado por `DocumentoService`.

- [ ] **Step 1: Escrever o teste falho (integração, banco real)**

```ts
// src/repositories/documento.repository.test.ts
/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { documentoRepository } from "./documento.repository";
import { escritorioRepository } from "./escritorio.repository";
import { usuarioRepository } from "./usuario.repository";
import { membroRepository } from "./membro.repository";

describe("documentoRepository", () => {
  let escritorioId: string;
  let outroEscritorioId: string;
  let membroId: string;

  beforeAll(async () => {
    escritorioId = (await escritorioRepository.create({ nome: "Escritório Documento Repo" })).id;
    outroEscritorioId = (await escritorioRepository.create({ nome: "Outro Documento Repo" })).id;
    const usuario = await usuarioRepository.create({
      nome: "Autor Documento",
      email: `autor-documento-${Date.now()}@teste.com`,
      senhaHash: "hash",
    });
    membroId = (
      await membroRepository.create({
        usuario: { connect: { id: usuario.id } },
        escritorio: { connect: { id: escritorioId } },
      })
    ).id;
  });

  afterEach(async () => {
    await prisma.documento.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
  });

  afterAll(async () => {
    await prisma.escritorio.deleteMany({ where: { id: { in: [escritorioId, outroEscritorioId] } } });
    await prisma.$disconnect();
  });

  function criar(escritorio: string, escopoId: string, nomeOriginal: string) {
    return documentoRepository.create({
      escopo: "cliente",
      escopoId,
      nomeOriginal,
      tipoArquivo: "pdf",
      tamanhoKb: 100,
      storageKey: `development/${escritorio}/documentos/cliente/${escopoId}/${nomeOriginal}`,
      escritorio: { connect: { id: escritorio } },
      autor: { connect: { id: membroId } },
    });
  }

  it("lista os documentos ativos do escopo", async () => {
    await criar(escritorioId, "cliente-1", "contrato.pdf");

    const documentos = await documentoRepository.listarPorEscopo(escritorioId, "cliente", "cliente-1");
    expect(documentos).toHaveLength(1);
    expect(documentos[0].nomeOriginal).toBe("contrato.pdf");
  });

  it("não mistura documentos de escopos diferentes", async () => {
    await criar(escritorioId, "cliente-1", "do-cliente-1.pdf");
    await criar(escritorioId, "cliente-2", "do-cliente-2.pdf");

    const documentos = await documentoRepository.listarPorEscopo(escritorioId, "cliente", "cliente-1");
    expect(documentos.map((d) => d.nomeOriginal)).toEqual(["do-cliente-1.pdf"]);
  });

  // Mesmo escopoId em tenants distintos não pode vazar de um para o outro (RN19).
  it("não devolve documento de outro escritório", async () => {
    await criar(outroEscritorioId, "cliente-1", "de-outro-tenant.pdf");
    const documentos = await documentoRepository.listarPorEscopo(escritorioId, "cliente", "cliente-1");
    expect(documentos).toHaveLength(0);
  });

  it("omite documentos soft-deletados", async () => {
    const documento = await criar(escritorioId, "cliente-1", "sera-removido.pdf");
    await documentoRepository.marcarExcluido(documento.id, new Date());

    const documentos = await documentoRepository.listarPorEscopo(escritorioId, "cliente", "cliente-1");
    expect(documentos).toHaveLength(0);
  });

  it("findById devolve o documento criado", async () => {
    const criado = await criar(escritorioId, "cliente-1", "para-buscar.pdf");
    await expect(documentoRepository.findById(criado.id)).resolves.toMatchObject({
      id: criado.id,
      nomeOriginal: "para-buscar.pdf",
    });
  });

  // O parâmetro `db` existe para compor com prisma.$transaction: se ele não fosse
  // respeitado, documento e log poderiam ser gravados fora da mesma transação.
  it("respeita o cliente da transação recebido", async () => {
    const criado = await prisma.$transaction((tx) =>
      documentoRepository.create(
        {
          escopo: "cliente",
          escopoId: "cliente-tx",
          nomeOriginal: "dentro-da-transacao.pdf",
          tipoArquivo: "pdf",
          tamanhoKb: 50,
          storageKey: "development/tx/documentos/cliente/cliente-tx/dentro-da-transacao.pdf",
          escritorio: { connect: { id: escritorioId } },
          autor: { connect: { id: membroId } },
        },
        tx
      )
    );

    expect(criado.escopoId).toBe("cliente-tx");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/repositories/documento.repository.test.ts`
Expected: FAIL — `Cannot find module './documento.repository'`.

- [ ] **Step 3: Implementar `DocumentoRepository`**

```ts
// src/repositories/documento.repository.ts
import { prisma } from "@/lib/prisma";
import type { Documento, EscopoDocumento, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "documento">;

export const documentoRepository = {
  async create(data: Prisma.DocumentoCreateInput, db: Db = prisma): Promise<Documento> {
    return db.documento.create({ data });
  },

  async findById(id: string, db: Db = prisma): Promise<Documento | null> {
    return db.documento.findUnique({ where: { id } });
  },

  async listarPorEscopo(
    escritorioId: string,
    escopo: EscopoDocumento,
    escopoId: string,
    db: Db = prisma
  ): Promise<Documento[]> {
    return db.documento.findMany({
      where: { escritorioId, escopo, escopoId, softDeletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async marcarExcluido(id: string, quando: Date, db: Db = prisma): Promise<Documento> {
    return db.documento.update({ where: { id }, data: { softDeletedAt: quando } });
  },
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/repositories/documento.repository.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/documento.repository.ts src/repositories/documento.repository.test.ts
git commit -m "feat(documentos): adiciona DocumentoRepository"
```

---

### Task 6: `DocumentoService` — upload, confirmação e leitura

**Files:**
- Create: `src/services/documento.service.ts`
- Test: `src/services/documento.service.test.ts`

**Interfaces:**
- Consumes: `s3Client` (Task 3), `documentoRepository` (Task 4), `clienteService.obter`, `casoService.obter` (existentes), `membroRepository.findByUsuarioEEscritorio` (existente), `logService.registrar` (existente), `prisma.$transaction`, `TenantContext`.
- Produces:
  - `export class DocumentoNaoEncontradoError extends Error {}`
  - `export class PermissaoDocumentoError extends Error {}`
  - `export class TamanhoInvalidoError extends Error {}`
  - `export interface UploadUrlInput { escopo: EscopoDocumento; escopoId: string; nomeArquivo: string; tipoArquivo: TipoArquivo; tamanhoKb: number; }`
  - `export interface UploadUrlResult { documentoId: string; uploadUrl: string; storageKey: string; }`
  - `export interface ConfirmarUploadInput extends UploadUrlInput { storageKey: string; }`
  - `documentoService.gerarUrlUpload(ctx, input: UploadUrlInput): Promise<UploadUrlResult>`
  - `documentoService.confirmarUpload(ctx, documentoId: string, input: ConfirmarUploadInput): Promise<Documento>`
  - `documentoService.listarPorEscopo(ctx, escopo: EscopoDocumento, escopoId: string): Promise<Documento[]>`
  - `documentoService.obter(ctx, id: string): Promise<Documento>`
  - Usado pelas rotas das Tasks 9, 10, 11 e pelo helper de zip (Task 14).

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/services/documento.service.test.ts
import {
  documentoService,
  DocumentoNaoEncontradoError,
  TamanhoInvalidoError,
} from "./documento.service";
import { documentoRepository } from "@/repositories/documento.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { clienteService, ClienteNaoEncontradoError } from "@/services/cliente.service";
import { casoService, CasoNaoEncontradoError } from "@/services/caso.service";
import { logService } from "@/services/log.service";
import { s3Client } from "@/lib/external/s3-client";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Documento, Membro } from "@prisma/client";

jest.mock("@/repositories/documento.repository");
jest.mock("@/repositories/membro.repository");
jest.mock("@/services/log.service");
jest.mock("@/lib/external/s3-client");
jest.mock("@/services/cliente.service", () => ({
  clienteService: { obter: jest.fn() },
  ClienteNaoEncontradoError: class ClienteNaoEncontradoError extends Error {},
}));
jest.mock("@/services/caso.service", () => ({
  casoService: { obter: jest.fn() },
  CasoNaoEncontradoError: class CasoNaoEncontradoError extends Error {},
}));
jest.mock("@/lib/prisma", () => ({
  prisma: { $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));

const repo = documentoRepository as jest.Mocked<typeof documentoRepository>;
const membros = membroRepository as jest.Mocked<typeof membroRepository>;
const clientes = clienteService as jest.Mocked<typeof clienteService>;
const casos = casoService as jest.Mocked<typeof casoService>;
const logs = logService as jest.Mocked<typeof logService>;
const s3 = s3Client as jest.Mocked<typeof s3Client>;

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

function documentoFake(over: Partial<Documento> = {}): Documento {
  return {
    id: "doc-1",
    escritorioId: "esc-1",
    escopo: "cliente",
    escopoId: "cli-1",
    autorMembroId: "membro-1",
    nomeOriginal: "contrato.pdf",
    tipoArquivo: "pdf",
    tamanhoKb: 100,
    storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    softDeletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function membroFake(over: Partial<Membro> = {}): Membro {
  return {
    id: "membro-1",
    usuarioId: "user-1",
    escritorioId: "esc-1",
    role: "padrao",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  clientes.obter.mockResolvedValue({ id: "cli-1", nome: "Maria Silva" } as never);
  casos.obter.mockResolvedValue({ id: "caso-1", titulo: "Ação de Cobrança" } as never);
  membros.findByUsuarioEEscritorio.mockResolvedValue(membroFake());
  logs.registrar.mockResolvedValue({} as never);
  s3.gerarUrlUpload.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-put");
});

describe("documentoService.gerarUrlUpload", () => {
  it("valida o tenant do alvo, monta a key e devolve a URL assinada de PUT", async () => {
    const resultado = await documentoService.gerarUrlUpload(ctx, {
      escopo: "cliente",
      escopoId: "cli-1",
      nomeArquivo: "contrato.pdf",
      tipoArquivo: "pdf",
      tamanhoKb: 100,
    });

    expect(clientes.obter).toHaveBeenCalledWith(ctx, "cli-1");
    expect(resultado.uploadUrl).toBe("https://bucket.s3.amazonaws.com/signed-put");
    expect(resultado.storageKey).toContain("esc-1/documentos/cliente/cli-1/");
    expect(resultado.storageKey).toContain("contrato.pdf");
    expect(s3.gerarUrlUpload).toHaveBeenCalledWith(
      resultado.storageKey,
      "application/pdf",
      100 * 1024
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  // RN17: arquivo maior que 10MB é rejeitado antes de gerar a URL, sem round-trip ao S3.
  it("recusa arquivo maior que 10MB antes de chamar o S3", async () => {
    await expect(
      documentoService.gerarUrlUpload(ctx, {
        escopo: "cliente",
        escopoId: "cli-1",
        nomeArquivo: "grande.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 10241,
      })
    ).rejects.toThrow(TamanhoInvalidoError);
    expect(s3.gerarUrlUpload).not.toHaveBeenCalled();
  });

  it("recusa anexar em cliente de outro escritório", async () => {
    clientes.obter.mockRejectedValue(new ClienteNaoEncontradoError());
    await expect(
      documentoService.gerarUrlUpload(ctx, {
        escopo: "cliente",
        escopoId: "cli-alheio",
        nomeArquivo: "x.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
      })
    ).rejects.toThrow(ClienteNaoEncontradoError);
    expect(s3.gerarUrlUpload).not.toHaveBeenCalled();
  });

  it("valida o caso quando o escopo é caso", async () => {
    await documentoService.gerarUrlUpload(ctx, {
      escopo: "caso",
      escopoId: "caso-1",
      nomeArquivo: "peticao.docx",
      tipoArquivo: "docx",
      tamanhoKb: 200,
    });
    expect(casos.obter).toHaveBeenCalledWith(ctx, "caso-1");
  });
});

describe("documentoService.confirmarUpload", () => {
  const input = {
    escopo: "cliente" as const,
    escopoId: "cli-1",
    nomeArquivo: "contrato.pdf",
    tipoArquivo: "pdf" as const,
    tamanhoKb: 100,
    storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
  };

  it("cria a linha do documento ancorada no membro autor e registra log", async () => {
    repo.create.mockResolvedValue(documentoFake());

    await documentoService.confirmarUpload(ctx, "doc-1", input);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "doc-1",
        escopo: "cliente",
        escopoId: "cli-1",
        nomeOriginal: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
        storageKey: input.storageKey,
        escritorio: { connect: { id: "esc-1" } },
        autor: { connect: { id: "membro-1" } },
      }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        acao: "criar",
        entidade: "documento",
        entidadeId: "doc-1",
        resumo: 'Documento "contrato.pdf" anexado ao cliente Maria Silva',
      }),
      expect.anything()
    );
  });

  it("recusa confirmar upload maior que 10MB", async () => {
    await expect(
      documentoService.confirmarUpload(ctx, "doc-1", { ...input, tamanhoKb: 99999 })
    ).rejects.toThrow(TamanhoInvalidoError);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("documentoService.obter", () => {
  it("devolve o documento do tenant", async () => {
    repo.findById.mockResolvedValue(documentoFake());
    await expect(documentoService.obter(ctx, "doc-1")).resolves.toMatchObject({ id: "doc-1" });
  });

  it("trata documento de outro escritório como não encontrado (RN19)", async () => {
    repo.findById.mockResolvedValue(documentoFake({ escritorioId: "esc-2" }));
    await expect(documentoService.obter(ctx, "doc-1")).rejects.toThrow(DocumentoNaoEncontradoError);
  });

  it("trata documento já excluído como não encontrado", async () => {
    repo.findById.mockResolvedValue(documentoFake({ softDeletedAt: new Date() }));
    await expect(documentoService.obter(ctx, "doc-1")).rejects.toThrow(DocumentoNaoEncontradoError);
  });
});

describe("documentoService.listarPorEscopo", () => {
  it("valida o alvo antes de listar e escopa ao escritório", async () => {
    repo.listarPorEscopo.mockResolvedValue([]);

    await documentoService.listarPorEscopo(ctx, "cliente", "cli-1");

    expect(clientes.obter).toHaveBeenCalledWith(ctx, "cli-1");
    expect(repo.listarPorEscopo).toHaveBeenCalledWith("esc-1", "cliente", "cli-1");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/services/documento.service.test.ts`
Expected: FAIL — `Cannot find module './documento.service'`.

- [ ] **Step 3: Implementar `DocumentoService` (parte 1 — upload/confirmação/leitura; exclusão vem na Task 8)**

```ts
// src/services/documento.service.ts
import { prisma } from "@/lib/prisma";
import { documentoRepository } from "@/repositories/documento.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { clienteService } from "@/services/cliente.service";
import { casoService } from "@/services/caso.service";
import { logService } from "@/services/log.service";
import { s3Client } from "@/lib/external/s3-client";
import { podeModerarComentario } from "@/lib/auth/permissoes";
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

  // Implementado na Task 8.
  async excluir(_ctx: TenantContext, _id: string): Promise<void> {
    throw new Error("não implementado");
  },

  async gerarUrlDownload(_ctx: TenantContext, _id: string): Promise<string> {
    throw new Error("não implementado");
  },
};
```

> Nota: os dois últimos métodos (`excluir`, `gerarUrlDownload`) ficam como stub proposital nesta task — a Task 8 os substitui pela implementação real e adiciona os testes correspondentes. Isso mantém esta task focada em upload/confirmação/leitura, conforme o Task Right-Sizing do plano.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/services/documento.service.test.ts`
Expected: PASS, 10 testes (os stubs de `excluir`/`gerarUrlDownload` não são exercitados por este arquivo de teste).

- [ ] **Step 5: Commit**

```bash
git add src/services/documento.service.ts src/services/documento.service.test.ts
git commit -m "feat(documentos): adiciona DocumentoService com upload, confirmação e listagem"
```

---

### Task 7: Mapeamento de erros — `erros-documento.ts`

**Files:**
- Create: `src/lib/api/erros-documento.ts`
- Test: `src/lib/api/erros-documento.test.ts`

**Interfaces:**
- Consumes: classes de erro exportadas por `DocumentoService` (definidas na Task 6): `DocumentoNaoEncontradoError`, `PermissaoDocumentoError`, `TamanhoInvalidoError`.
- Produces: `export function tratarErroDeDocumento(error: unknown): NextResponse | null` — usado por todas as rotas de documento (Tasks 9–16).

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/lib/api/erros-documento.test.ts
import { tratarErroDeDocumento } from "./erros-documento";
import {
  DocumentoNaoEncontradoError,
  PermissaoDocumentoError,
  TamanhoInvalidoError,
} from "@/services/documento.service";

describe("tratarErroDeDocumento", () => {
  it("mapeia DocumentoNaoEncontradoError para 404", async () => {
    const resposta = tratarErroDeDocumento(new DocumentoNaoEncontradoError());
    expect(resposta?.status).toBe(404);
  });

  it("mapeia PermissaoDocumentoError para 403", async () => {
    const resposta = tratarErroDeDocumento(new PermissaoDocumentoError());
    expect(resposta?.status).toBe(403);
  });

  it("mapeia TamanhoInvalidoError para 400", async () => {
    const resposta = tratarErroDeDocumento(new TamanhoInvalidoError());
    expect(resposta?.status).toBe(400);
  });

  it("devolve null para erro desconhecido", () => {
    expect(tratarErroDeDocumento(new Error("outra coisa"))).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/lib/api/erros-documento.test.ts`
Expected: FAIL — `Cannot find module './erros-documento'`.

- [ ] **Step 3: Implementar `erros-documento.ts`**

```ts
// src/lib/api/erros-documento.ts
import { NextResponse } from "next/server";
import {
  DocumentoNaoEncontradoError,
  PermissaoDocumentoError,
  TamanhoInvalidoError,
} from "@/services/documento.service";

export function tratarErroDeDocumento(error: unknown) {
  if (error instanceof DocumentoNaoEncontradoError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoDocumentoError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof TamanhoInvalidoError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return null;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/lib/api/erros-documento.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/erros-documento.ts src/lib/api/erros-documento.test.ts
git commit -m "feat(documentos): adiciona mapeamento de erros de documento para HTTP"
```

---

### Task 8: `DocumentoService` — exclusão e download individual

**Files:**
- Modify: `src/services/documento.service.ts` (substitui os stubs `excluir`/`gerarUrlDownload` da Task 6)
- Modify: `src/services/documento.service.test.ts`
- Modify: `src/lib/auth/permissoes.ts` (adiciona `podeExcluirDocumento`)
- Modify: `src/lib/auth/permissoes.test.ts`

**Interfaces:**
- Consumes: `documentoService.obter` (Task 6), `documentoRepository.marcarExcluido` (Task 4), `s3Client.gerarUrlDownload` (Task 3), `membroRepository.findByUsuarioEEscritorio`.
- Produces: `documentoService.excluir(ctx, id): Promise<void>`, `documentoService.gerarUrlDownload(ctx, id): Promise<string>`, `podeExcluirDocumento(atorRole: RoleMembro, ehAutor: boolean): boolean` — usados pelas rotas das Tasks 12 e 13.

- [ ] **Step 1: Escrever o teste falho de `permissoes.ts`**

Adicionar ao final de `src/lib/auth/permissoes.test.ts` (arquivo já existente, mesmo padrão dos testes de `podeModerarComentario` que já estão lá):

```ts
describe("podeExcluirDocumento", () => {
  it("o autor do upload pode excluir o próprio documento", () => {
    expect(podeExcluirDocumento("padrao", true)).toBe(true);
  });

  it("owner exclui documento de qualquer membro", () => {
    expect(podeExcluirDocumento("owner", false)).toBe(true);
  });

  it("admin exclui documento de qualquer membro", () => {
    expect(podeExcluirDocumento("admin", false)).toBe(true);
  });

  it("membro padrão não exclui documento alheio", () => {
    expect(podeExcluirDocumento("padrao", false)).toBe(false);
  });
});
```

E adicionar o import no topo do mesmo arquivo, junto dos demais imports de `@/lib/auth/permissoes`:

```ts
import { podeExcluirDocumento } from "./permissoes";
```

(Ajuste o import existente do arquivo para incluir `podeExcluirDocumento` na mesma linha, se o arquivo já importa outras funções de `./permissoes` num único `import { ... } from "./permissoes"`.)

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/lib/auth/permissoes.test.ts`
Expected: FAIL — `podeExcluirDocumento is not a function` / `is not exported`.

- [ ] **Step 3: Implementar `podeExcluirDocumento` em `permissoes.ts`**

Adicionar ao final de `src/lib/auth/permissoes.ts`:

```ts
// Excluir documento é a mesma regra de moderação de comentário (RN21): o autor do
// upload remove o que enviou, e owner/admin removem documento de qualquer membro.
export function podeExcluirDocumento(atorRole: RoleMembro, ehAutor: boolean): boolean {
  return ehAutor || atorRole === "owner" || atorRole === "admin";
}
```

- [ ] **Step 4: Rodar o teste de `permissoes.ts` e confirmar que passa**

Run: `npx jest src/lib/auth/permissoes.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever o teste falho de `documento.service.ts` (excluir/gerarUrlDownload)**

Adicionar ao final de `src/services/documento.service.test.ts`, e trocar o import do topo do arquivo de `TamanhoInvalidoError` para também trazer `PermissaoDocumentoError`:

```ts
import {
  documentoService,
  DocumentoNaoEncontradoError,
  PermissaoDocumentoError,
  TamanhoInvalidoError,
} from "./documento.service";
```

```ts
describe("documentoService.excluir", () => {
  it("o autor exclui o próprio documento (soft delete + log)", async () => {
    repo.findById.mockResolvedValue(documentoFake({ autorMembroId: "membro-1" }));
    repo.marcarExcluido.mockResolvedValue(documentoFake());
    membros.findByUsuarioEEscritorio.mockResolvedValue(membroFake({ id: "membro-1" }));

    await documentoService.excluir(ctx, "doc-1");

    expect(repo.marcarExcluido).toHaveBeenCalledWith("doc-1", expect.any(Date), expect.anything());
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ acao: "excluir", entidade: "documento", entidadeId: "doc-1" }),
      expect.anything()
    );
  });

  it("owner exclui documento de qualquer membro", async () => {
    const owner: TenantContext = { usuarioId: "user-9", escritorioId: "esc-1", role: "owner" };
    repo.findById.mockResolvedValue(documentoFake({ autorMembroId: "membro-1" }));
    repo.marcarExcluido.mockResolvedValue(documentoFake());
    membros.findByUsuarioEEscritorio.mockResolvedValue(membroFake({ id: "membro-9", usuarioId: "user-9" }));

    await expect(documentoService.excluir(owner, "doc-1")).resolves.toBeUndefined();
  });

  it("membro padrão não exclui documento alheio", async () => {
    const outroPadrao: TenantContext = { usuarioId: "user-2", escritorioId: "esc-1", role: "padrao" };
    repo.findById.mockResolvedValue(documentoFake({ autorMembroId: "membro-1" }));
    membros.findByUsuarioEEscritorio.mockResolvedValue(membroFake({ id: "membro-2", usuarioId: "user-2" }));

    await expect(documentoService.excluir(outroPadrao, "doc-1")).rejects.toThrow(
      PermissaoDocumentoError
    );
    expect(repo.marcarExcluido).not.toHaveBeenCalled();
  });

  it("trata documento de outro escritório como não encontrado (RN19)", async () => {
    repo.findById.mockResolvedValue(documentoFake({ escritorioId: "esc-2" }));
    await expect(documentoService.excluir(ctx, "doc-1")).rejects.toThrow(DocumentoNaoEncontradoError);
  });
});

describe("documentoService.gerarUrlDownload", () => {
  it("valida o tenant e devolve a URL assinada de GET", async () => {
    repo.findById.mockResolvedValue(documentoFake());
    s3.gerarUrlDownload.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");

    const url = await documentoService.gerarUrlDownload(ctx, "doc-1");

    expect(s3.gerarUrlDownload).toHaveBeenCalledWith(
      "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf"
    );
    expect(url).toBe("https://bucket.s3.amazonaws.com/signed-get");
  });

  it("trata documento de outro escritório como não encontrado (RN19)", async () => {
    repo.findById.mockResolvedValue(documentoFake({ escritorioId: "esc-2" }));
    await expect(documentoService.gerarUrlDownload(ctx, "doc-1")).rejects.toThrow(
      DocumentoNaoEncontradoError
    );
  });
});
```

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `npx jest src/services/documento.service.test.ts`
Expected: FAIL — os stubs de `excluir`/`gerarUrlDownload` lançam `Error("não implementado")` em vez do comportamento esperado.

- [ ] **Step 7: Implementar `excluir` e `gerarUrlDownload`, substituindo os stubs**

Em `src/services/documento.service.ts`, trocar o import de `podeModerarComentario` por `podeExcluirDocumento`:

```ts
import { podeExcluirDocumento } from "@/lib/auth/permissoes";
```

E substituir os dois métodos stub por:

```ts
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
```

Remover o objeto de retorno `documentoService` antigo com os stubs e usar esta versão completa (o objeto `documentoService` inteiro passa a ter `gerarUrlUpload`, `confirmarUpload`, `listarPorEscopo`, `obter`, `gerarUrlDownload`, `excluir`).

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `npx jest src/services/documento.service.test.ts src/lib/auth/permissoes.test.ts`
Expected: PASS, todos os testes (10 da Task 6 + 8 novos desta task + 4 de `podeExcluirDocumento`).

- [ ] **Step 9: Commit**

```bash
git add src/services/documento.service.ts src/services/documento.service.test.ts src/lib/auth/permissoes.ts src/lib/auth/permissoes.test.ts
git commit -m "feat(documentos): adiciona exclusão (RN21) e download individual ao DocumentoService"
```

---

### Task 9: Rota `POST /api/documentos/upload-url`

**Files:**
- Create: `src/app/api/documentos/upload-url/route.ts`
- Test: `src/app/api/documentos/upload-url/route.test.ts`

**Interfaces:**
- Consumes: `getTenantContext` (existente), `documentoService.gerarUrlUpload` (Task 6), `tratarErroDeContexto`/`respostaDadosInvalidos`/`lerJson` (existentes em `@/lib/api/erros`), `tratarErroDeCliente`/`tratarErroDeCaso` (existentes), `tratarErroDeDocumento` (Task 7).
- Produces: `POST` handler que devolve `{ documentoId, uploadUrl, storageKey }` com status 200 — consumido pelo front-end (fora do escopo deste plano) para o passo 1 do fluxo de upload.

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/app/api/documentos/upload-url/route.test.ts
import { POST } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { documentoService, TamanhoInvalidoError } from "@/services/documento.service";
import { ClienteNaoEncontradoError } from "@/services/cliente.service";
import type { TenantContext } from "@/lib/auth/tenant-context";

jest.mock("@/lib/auth/tenant-context");
jest.mock("@/services/documento.service");

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

function request(body: unknown) {
  return new Request("http://localhost/api/documentos/upload-url", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("POST /api/documentos/upload-url", () => {
  it("devolve documentoId, uploadUrl e storageKey", async () => {
    (documentoService.gerarUrlUpload as jest.Mock).mockResolvedValue({
      documentoId: "doc-1",
      uploadUrl: "https://bucket.s3.amazonaws.com/signed-put",
      storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    });

    const resposta = await POST(
      request({
        escopo: "cliente",
        escopoId: "550e8400-e29b-41d4-a716-446655440000",
        nomeArquivo: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
      })
    );

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo).toEqual({
      documentoId: "doc-1",
      uploadUrl: "https://bucket.s3.amazonaws.com/signed-put",
      storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    });
  });

  it("recusa payload inválido com 400", async () => {
    const resposta = await POST(request({ escopo: "cliente" }));
    expect(resposta.status).toBe(400);
    expect(documentoService.gerarUrlUpload).not.toHaveBeenCalled();
  });

  it("mapeia TamanhoInvalidoError para 400", async () => {
    (documentoService.gerarUrlUpload as jest.Mock).mockRejectedValue(new TamanhoInvalidoError());

    const resposta = await POST(
      request({
        escopo: "cliente",
        escopoId: "550e8400-e29b-41d4-a716-446655440000",
        nomeArquivo: "grande.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 99999,
      })
    );
    expect(resposta.status).toBe(400);
  });

  it("mapeia ClienteNaoEncontradoError para 404", async () => {
    (documentoService.gerarUrlUpload as jest.Mock).mockRejectedValue(new ClienteNaoEncontradoError());

    const resposta = await POST(
      request({
        escopo: "cliente",
        escopoId: "550e8400-e29b-41d4-a716-446655440000",
        nomeArquivo: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
      })
    );
    expect(resposta.status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/app/api/documentos/upload-url/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar a rota**

```ts
// src/app/api/documentos/upload-url/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { documentoService } from "@/services/documento.service";

const uploadUrlSchema = z.object({
  escopo: z.enum(["cliente", "caso"]),
  escopoId: z.uuid(),
  nomeArquivo: z.string().trim().min(1).max(255),
  tipoArquivo: z.enum(["pdf", "docx", "jpg", "png", "jpeg"]),
  tamanhoKb: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = uploadUrlSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const resultado = await documentoService.gerarUrlUpload(ctx, parsed.data);
    return NextResponse.json(resultado);
  } catch (error) {
    const resposta =
      tratarErroDeContexto(error) ??
      tratarErroDeCliente(error) ??
      tratarErroDeCaso(error) ??
      tratarErroDeDocumento(error);
    if (resposta) return resposta;
    console.error("Erro ao gerar URL de upload de documento", error);
    return NextResponse.json({ error: "Não foi possível iniciar o upload." }, { status: 502 });
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/documentos/upload-url/route.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/documentos/upload-url/route.ts src/app/api/documentos/upload-url/route.test.ts
git commit -m "feat(documentos): adiciona rota de geração de URL de upload"
```

---

### Task 10: Rota `POST /api/documentos/[id]/confirmar`

**Files:**
- Create: `src/app/api/documentos/[id]/confirmar/route.ts`
- Test: `src/app/api/documentos/[id]/confirmar/route.test.ts`

**Interfaces:**
- Consumes: `documentoService.confirmarUpload` (Task 6/7), mesmos helpers de erro da Task 9.
- Produces: `POST` handler que devolve `{ documento }` com status 201.

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/app/api/documentos/[id]/confirmar/route.test.ts
import { POST } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { documentoService } from "@/services/documento.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Documento } from "@prisma/client";

jest.mock("@/lib/auth/tenant-context");
jest.mock("@/services/documento.service");

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

function request(body: unknown) {
  return new Request("http://localhost/api/documentos/doc-1/confirmar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function documentoFake(): Documento {
  return {
    id: "doc-1",
    escritorioId: "esc-1",
    escopo: "cliente",
    escopoId: "cli-1",
    autorMembroId: "membro-1",
    nomeOriginal: "contrato.pdf",
    tipoArquivo: "pdf",
    tamanhoKb: 100,
    storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    softDeletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("POST /api/documentos/[id]/confirmar", () => {
  it("confirma o upload e devolve o documento criado", async () => {
    (documentoService.confirmarUpload as jest.Mock).mockResolvedValue(documentoFake());

    const resposta = await POST(
      request({
        escopo: "cliente",
        escopoId: "550e8400-e29b-41d4-a716-446655440000",
        nomeArquivo: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
        storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );

    expect(resposta.status).toBe(201);
    expect(documentoService.confirmarUpload).toHaveBeenCalledWith(
      ctx,
      "doc-1",
      expect.objectContaining({ storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf" })
    );
  });

  it("recusa payload inválido com 400", async () => {
    const resposta = await POST(request({ escopo: "cliente" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(resposta.status).toBe(400);
    expect(documentoService.confirmarUpload).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/app/api/documentos/\[id\]/confirmar/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar a rota**

```ts
// src/app/api/documentos/[id]/confirmar/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos, lerJson } from "@/lib/api/erros";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { documentoService } from "@/services/documento.service";

const confirmarUploadSchema = z.object({
  escopo: z.enum(["cliente", "caso"]),
  escopoId: z.uuid(),
  nomeArquivo: z.string().trim().min(1).max(255),
  tipoArquivo: z.enum(["pdf", "docx", "jpg", "png", "jpeg"]),
  tamanhoKb: z.number().int().positive(),
  storageKey: z.string().min(1).max(500),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const body = await lerJson(request);
    if (body === null) return respostaDadosInvalidos();

    const parsed = confirmarUploadSchema.safeParse(body);
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const documento = await documentoService.confirmarUpload(ctx, id, parsed.data);
    return NextResponse.json({ documento }, { status: 201 });
  } catch (error) {
    const resposta =
      tratarErroDeContexto(error) ??
      tratarErroDeCliente(error) ??
      tratarErroDeCaso(error) ??
      tratarErroDeDocumento(error);
    if (resposta) return resposta;
    console.error("Erro ao confirmar upload de documento", error);
    return NextResponse.json({ error: "Não foi possível confirmar o upload." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/documentos/\[id\]/confirmar/route.test.ts`
Expected: PASS, 2 testes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/documentos/[id]/confirmar/route.ts" "src/app/api/documentos/[id]/confirmar/route.test.ts"
git commit -m "feat(documentos): adiciona rota de confirmação de upload"
```

---

### Task 11: Rota `GET /api/documentos` (listar por escopo)

**Files:**
- Create: `src/app/api/documentos/route.ts`
- Test: `src/app/api/documentos/route.test.ts`

**Interfaces:**
- Consumes: `documentoService.listarPorEscopo` (Task 6), mesmos helpers de erro das tasks anteriores.
- Produces: `GET` handler `?escopo=cliente|caso&escopoId=<uuid>` que devolve `{ documentos }`.

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/app/api/documentos/route.test.ts
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { documentoService } from "@/services/documento.service";
import type { TenantContext } from "@/lib/auth/tenant-context";

jest.mock("@/lib/auth/tenant-context");
jest.mock("@/services/documento.service");

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("GET /api/documentos", () => {
  it("lista os documentos do escopo informado", async () => {
    (documentoService.listarPorEscopo as jest.Mock).mockResolvedValue([{ id: "doc-1" }]);

    const resposta = await GET(
      new Request("http://localhost/api/documentos?escopo=cliente&escopoId=550e8400-e29b-41d4-a716-446655440000")
    );

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.documentos).toEqual([{ id: "doc-1" }]);
    expect(documentoService.listarPorEscopo).toHaveBeenCalledWith(
      ctx,
      "cliente",
      "550e8400-e29b-41d4-a716-446655440000"
    );
  });

  it("recusa query inválida com 400", async () => {
    const resposta = await GET(new Request("http://localhost/api/documentos?escopo=cliente"));
    expect(resposta.status).toBe(400);
    expect(documentoService.listarPorEscopo).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/app/api/documentos/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar a rota**

```ts
// src/app/api/documentos/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto, respostaDadosInvalidos } from "@/lib/api/erros";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { documentoService } from "@/services/documento.service";

const escopoSchema = z.object({
  escopo: z.enum(["cliente", "caso"]),
  escopoId: z.uuid(),
});

export async function GET(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { searchParams } = new URL(request.url);

    const parsed = escopoSchema.safeParse({
      escopo: searchParams.get("escopo"),
      escopoId: searchParams.get("escopoId"),
    });
    if (!parsed.success) return respostaDadosInvalidos(parsed.error);

    const documentos = await documentoService.listarPorEscopo(
      ctx,
      parsed.data.escopo,
      parsed.data.escopoId
    );
    return NextResponse.json({ documentos });
  } catch (error) {
    const resposta =
      tratarErroDeContexto(error) ??
      tratarErroDeCliente(error) ??
      tratarErroDeCaso(error) ??
      tratarErroDeDocumento(error);
    if (resposta) return resposta;
    console.error("Erro ao listar documentos", error);
    return NextResponse.json({ error: "Não foi possível listar os documentos." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/documentos/route.test.ts`
Expected: PASS, 2 testes.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/documentos/route.ts src/app/api/documentos/route.test.ts
git commit -m "feat(documentos): adiciona rota de listagem por escopo"
```

---

### Task 12: Rota `GET /api/documentos/[id]/download-url`

**Files:**
- Create: `src/app/api/documentos/[id]/download-url/route.ts`
- Test: `src/app/api/documentos/[id]/download-url/route.test.ts`

**Interfaces:**
- Consumes: `documentoService.gerarUrlDownload` (Task 8).
- Produces: `GET` handler que devolve `{ downloadUrl }`.

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/app/api/documentos/[id]/download-url/route.test.ts
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { documentoService, DocumentoNaoEncontradoError } from "@/services/documento.service";
import type { TenantContext } from "@/lib/auth/tenant-context";

jest.mock("@/lib/auth/tenant-context");
jest.mock("@/services/documento.service");

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("GET /api/documentos/[id]/download-url", () => {
  it("devolve a URL assinada de download", async () => {
    (documentoService.gerarUrlDownload as jest.Mock).mockResolvedValue(
      "https://bucket.s3.amazonaws.com/signed-get"
    );

    const resposta = await GET(new Request("http://localhost/api/documentos/doc-1/download-url"), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo).toEqual({ downloadUrl: "https://bucket.s3.amazonaws.com/signed-get" });
  });

  it("mapeia DocumentoNaoEncontradoError para 404", async () => {
    (documentoService.gerarUrlDownload as jest.Mock).mockRejectedValue(
      new DocumentoNaoEncontradoError()
    );

    const resposta = await GET(new Request("http://localhost/api/documentos/doc-alheio/download-url"), {
      params: Promise.resolve({ id: "doc-alheio" }),
    });
    expect(resposta.status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/app/api/documentos/\[id\]/download-url/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar a rota**

```ts
// src/app/api/documentos/[id]/download-url/route.ts
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { documentoService } from "@/services/documento.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const downloadUrl = await documentoService.gerarUrlDownload(ctx, id);
    return NextResponse.json({ downloadUrl });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeDocumento(error);
    if (resposta) return resposta;
    console.error("Erro ao gerar URL de download de documento", error);
    return NextResponse.json({ error: "Não foi possível gerar o link de download." }, { status: 502 });
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/documentos/\[id\]/download-url/route.test.ts`
Expected: PASS, 2 testes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/documentos/[id]/download-url/route.ts" "src/app/api/documentos/[id]/download-url/route.test.ts"
git commit -m "feat(documentos): adiciona rota de geração de URL de download individual"
```

---

### Task 13: Rota `DELETE /api/documentos/[id]`

**Files:**
- Create: `src/app/api/documentos/[id]/route.ts`
- Test: `src/app/api/documentos/[id]/route.test.ts`

**Interfaces:**
- Consumes: `documentoService.excluir` (Task 8).
- Produces: `DELETE` handler que devolve `{ ok: true }`.

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/app/api/documentos/[id]/route.test.ts
import { DELETE } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { documentoService, PermissaoDocumentoError } from "@/services/documento.service";
import type { TenantContext } from "@/lib/auth/tenant-context";

jest.mock("@/lib/auth/tenant-context");
jest.mock("@/services/documento.service");

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("DELETE /api/documentos/[id]", () => {
  it("exclui o documento e devolve ok", async () => {
    (documentoService.excluir as jest.Mock).mockResolvedValue(undefined);

    const resposta = await DELETE(new Request("http://localhost/api/documentos/doc-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(resposta.status).toBe(200);
    expect(documentoService.excluir).toHaveBeenCalledWith(ctx, "doc-1");
  });

  it("mapeia PermissaoDocumentoError para 403", async () => {
    (documentoService.excluir as jest.Mock).mockRejectedValue(new PermissaoDocumentoError());

    const resposta = await DELETE(new Request("http://localhost/api/documentos/doc-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(resposta.status).toBe(403);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/app/api/documentos/\[id\]/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar a rota**

```ts
// src/app/api/documentos/[id]/route.ts
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeDocumento } from "@/lib/api/erros-documento";
import { documentoService } from "@/services/documento.service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    await documentoService.excluir(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeDocumento(error);
    if (resposta) return resposta;
    console.error("Erro ao excluir documento", error);
    return NextResponse.json({ error: "Não foi possível excluir o documento." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/documentos/\[id\]/route.test.ts`
Expected: PASS, 2 testes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/documentos/[id]/route.ts" "src/app/api/documentos/[id]/route.test.ts"
git commit -m "feat(documentos): adiciona rota de exclusão (RN21)"
```

---

### Task 14: Helper de zip — `montarZipDocumentos`

**Files:**
- Create: `src/lib/documentos/zip.ts`
- Test: `src/lib/documentos/zip.test.ts`

**Interfaces:**
- Consumes: `s3Client.buscarArquivo` (Task 3), tipo `Documento` de `@prisma/client`.
- Produces: `export function montarZipDocumentos(documentos: Documento[]): Archiver` (tipo `Archiver` de `"archiver"`) — um stream Node `Readable` que emite o zip pronto — usado pelas rotas das Tasks 15 e 16.

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/lib/documentos/zip.test.ts
import { Readable } from "node:stream";
import { montarZipDocumentos } from "./zip";
import { s3Client } from "@/lib/external/s3-client";
import type { Documento } from "@prisma/client";

jest.mock("@/lib/external/s3-client");

const s3 = s3Client as jest.Mocked<typeof s3Client>;

function documentoFake(over: Partial<Documento> = {}): Documento {
  return {
    id: "doc-1",
    escritorioId: "esc-1",
    escopo: "cliente",
    escopoId: "cli-1",
    autorMembroId: "membro-1",
    nomeOriginal: "contrato.pdf",
    tipoArquivo: "pdf",
    tamanhoKb: 100,
    storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    softDeletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

async function coletar(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

describe("montarZipDocumentos", () => {
  it("monta um zip válido com um arquivo por documento", async () => {
    s3.buscarArquivo.mockImplementation(async (key: string) =>
      Readable.from([Buffer.from(`conteudo de ${key}`)])
    );

    const zip = montarZipDocumentos([
      documentoFake({ nomeOriginal: "contrato.pdf" }),
      documentoFake({ id: "doc-2", nomeOriginal: "procuracao.pdf" }),
    ]);

    const buffer = await coletar(zip);

    // Assinatura de arquivo ZIP (magic bytes "PK\x03\x04" no início do arquivo).
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    expect(s3.buscarArquivo).toHaveBeenCalledTimes(2);
  });

  it("propaga erro do S3 como evento de erro do stream", async () => {
    s3.buscarArquivo.mockRejectedValue(new Error("falha no S3"));

    const zip = montarZipDocumentos([documentoFake()]);

    await expect(coletar(zip)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/lib/documentos/zip.test.ts`
Expected: FAIL — `Cannot find module './zip'`.

- [ ] **Step 3: Implementar `montarZipDocumentos`**

```ts
// src/lib/documentos/zip.ts
import archiver, { type Archiver } from "archiver";
import { s3Client } from "@/lib/external/s3-client";
import type { Documento } from "@prisma/client";

// Monta o zip em stream: cada arquivo é lido do S3 e anexado ao zip conforme chega,
// sem baixar tudo pra memória do servidor antes de responder.
export function montarZipDocumentos(documentos: Documento[]): Archiver {
  const zip = archiver("zip", { zlib: { level: 9 } });

  (async () => {
    try {
      for (const documento of documentos) {
        const stream = await s3Client.buscarArquivo(documento.storageKey);
        zip.append(stream, { name: documento.nomeOriginal });
      }
      await zip.finalize();
    } catch (error) {
      zip.emit("error", error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return zip;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/lib/documentos/zip.test.ts`
Expected: PASS, 2 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/zip.ts src/lib/documentos/zip.test.ts
git commit -m "feat(documentos): adiciona helper de montagem de zip em stream"
```

---

### Task 15: Rota `GET /api/clientes/[id]/documentos/download-todos`

**Files:**
- Create: `src/app/api/clientes/[id]/documentos/download-todos/route.ts`
- Test: `src/app/api/clientes/[id]/documentos/download-todos/route.test.ts`

**Interfaces:**
- Consumes: `clienteService.obter` (existente), `documentoService.listarPorEscopo` (Task 6), `montarZipDocumentos` (Task 14).
- Produces: `GET` handler que devolve um stream `application/zip` com `Content-Disposition: attachment; filename="documentos-cliente-{nome}.zip"`.

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/app/api/clientes/[id]/documentos/download-todos/route.test.ts
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { clienteService, ClienteNaoEncontradoError } from "@/services/cliente.service";
import { documentoService } from "@/services/documento.service";
import { montarZipDocumentos } from "@/lib/documentos/zip";
import { Readable } from "node:stream";
import type { TenantContext } from "@/lib/auth/tenant-context";

jest.mock("@/lib/auth/tenant-context");
jest.mock("@/services/cliente.service", () => ({
  clienteService: { obter: jest.fn() },
  ClienteNaoEncontradoError: class ClienteNaoEncontradoError extends Error {},
}));
jest.mock("@/services/documento.service");
jest.mock("@/lib/documentos/zip");

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("GET /api/clientes/[id]/documentos/download-todos", () => {
  it("devolve um stream zip com o nome do cliente no filename", async () => {
    (clienteService.obter as jest.Mock).mockResolvedValue({ id: "cli-1", nome: "Maria Silva" });
    (documentoService.listarPorEscopo as jest.Mock).mockResolvedValue([{ id: "doc-1" }]);
    (montarZipDocumentos as jest.Mock).mockReturnValue(Readable.from([Buffer.from("PK\x03\x04")]));

    const resposta = await GET(new Request("http://localhost/api/clientes/cli-1/documentos/download-todos"), {
      params: Promise.resolve({ id: "cli-1" }),
    });

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Content-Type")).toBe("application/zip");
    expect(resposta.headers.get("Content-Disposition")).toBe(
      'attachment; filename="documentos-cliente-Maria Silva.zip"'
    );
    expect(documentoService.listarPorEscopo).toHaveBeenCalledWith(ctx, "cliente", "cli-1");
  });

  it("mapeia ClienteNaoEncontradoError para 404", async () => {
    (clienteService.obter as jest.Mock).mockRejectedValue(new ClienteNaoEncontradoError());

    const resposta = await GET(new Request("http://localhost/api/clientes/cli-alheio/documentos/download-todos"), {
      params: Promise.resolve({ id: "cli-alheio" }),
    });
    expect(resposta.status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/app/api/clientes/\[id\]/documentos/download-todos/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar a rota**

```ts
// src/app/api/clientes/[id]/documentos/download-todos/route.ts
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { clienteService } from "@/services/cliente.service";
import { documentoService } from "@/services/documento.service";
import { montarZipDocumentos } from "@/lib/documentos/zip";

// archiver usa streams Node — precisa do runtime Node, não roda no Edge.
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const cliente = await clienteService.obter(ctx, id);
    const documentos = await documentoService.listarPorEscopo(ctx, "cliente", id);
    const zip = montarZipDocumentos(documentos);

    return new NextResponse(Readable.toWeb(zip) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="documentos-cliente-${cliente.nome}.zip"`,
      },
    });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCliente(error);
    if (resposta) return resposta;
    console.error("Erro ao montar zip de documentos do cliente", error);
    return NextResponse.json({ error: "Não foi possível gerar o arquivo zip." }, { status: 502 });
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/clientes/\[id\]/documentos/download-todos/route.test.ts`
Expected: PASS, 2 testes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/clientes/[id]/documentos/download-todos/route.ts" "src/app/api/clientes/[id]/documentos/download-todos/route.test.ts"
git commit -m "feat(documentos): adiciona baixar-todos em zip para documentos de cliente"
```

---

### Task 16: Rota `GET /api/casos/[id]/documentos/download-todos`

**Files:**
- Create: `src/app/api/casos/[id]/documentos/download-todos/route.ts`
- Test: `src/app/api/casos/[id]/documentos/download-todos/route.test.ts`

**Interfaces:**
- Consumes: `casoService.obter` (existente), `documentoService.listarPorEscopo` (Task 6), `montarZipDocumentos` (Task 14). Mesma estrutura da Task 15, trocando cliente por caso.
- Produces: `GET` handler que devolve um stream `application/zip` com `Content-Disposition: attachment; filename="documentos-caso-{titulo}.zip"`.

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/app/api/casos/[id]/documentos/download-todos/route.test.ts
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { casoService, CasoNaoEncontradoError } from "@/services/caso.service";
import { documentoService } from "@/services/documento.service";
import { montarZipDocumentos } from "@/lib/documentos/zip";
import { Readable } from "node:stream";
import type { TenantContext } from "@/lib/auth/tenant-context";

jest.mock("@/lib/auth/tenant-context");
jest.mock("@/services/caso.service", () => ({
  casoService: { obter: jest.fn() },
  CasoNaoEncontradoError: class CasoNaoEncontradoError extends Error {},
}));
jest.mock("@/services/documento.service");
jest.mock("@/lib/documentos/zip");

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("GET /api/casos/[id]/documentos/download-todos", () => {
  it("devolve um stream zip com o título do caso no filename", async () => {
    (casoService.obter as jest.Mock).mockResolvedValue({ id: "caso-1", titulo: "Ação de Cobrança" });
    (documentoService.listarPorEscopo as jest.Mock).mockResolvedValue([{ id: "doc-1" }]);
    (montarZipDocumentos as jest.Mock).mockReturnValue(Readable.from([Buffer.from("PK\x03\x04")]));

    const resposta = await GET(new Request("http://localhost/api/casos/caso-1/documentos/download-todos"), {
      params: Promise.resolve({ id: "caso-1" }),
    });

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Content-Type")).toBe("application/zip");
    expect(resposta.headers.get("Content-Disposition")).toBe(
      'attachment; filename="documentos-caso-Ação de Cobrança.zip"'
    );
    expect(documentoService.listarPorEscopo).toHaveBeenCalledWith(ctx, "caso", "caso-1");
  });

  it("mapeia CasoNaoEncontradoError para 404", async () => {
    (casoService.obter as jest.Mock).mockRejectedValue(new CasoNaoEncontradoError());

    const resposta = await GET(new Request("http://localhost/api/casos/caso-alheio/documentos/download-todos"), {
      params: Promise.resolve({ id: "caso-alheio" }),
    });
    expect(resposta.status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/app/api/casos/\[id\]/documentos/download-todos/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar a rota**

```ts
// src/app/api/casos/[id]/documentos/download-todos/route.ts
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tratarErroDeContexto } from "@/lib/api/erros";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { casoService } from "@/services/caso.service";
import { documentoService } from "@/services/documento.service";
import { montarZipDocumentos } from "@/lib/documentos/zip";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;

    const caso = await casoService.obter(ctx, id);
    const documentos = await documentoService.listarPorEscopo(ctx, "caso", id);
    const zip = montarZipDocumentos(documentos);

    return new NextResponse(Readable.toWeb(zip) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="documentos-caso-${caso.titulo}.zip"`,
      },
    });
  } catch (error) {
    const resposta = tratarErroDeContexto(error) ?? tratarErroDeCaso(error);
    if (resposta) return resposta;
    console.error("Erro ao montar zip de documentos do caso", error);
    return NextResponse.json({ error: "Não foi possível gerar o arquivo zip." }, { status: 502 });
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/casos/\[id\]/documentos/download-todos/route.test.ts`
Expected: PASS, 2 testes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/casos/[id]/documentos/download-todos/route.ts" "src/app/api/casos/[id]/documentos/download-todos/route.test.ts"
git commit -m "feat(documentos): adiciona baixar-todos em zip para documentos de caso"
```

---

### Task 17: `usuarioService` — geração e confirmação de upload de avatar

**Files:**
- Modify: `src/services/usuario.service.ts`
- Modify: `src/services/usuario.service.test.ts` (assume-se existir; se não existir, criar seguindo o padrão de mocks de `comentario.service.test.ts`)

**Interfaces:**
- Consumes: `s3Client` (Task 3), `usuarioRepository` (existente).
- Produces:
  - `export class TamanhoAvatarInvalidoError extends Error {}`
  - `export interface UploadUrlAvatarInput { nomeArquivo: string; tipoArquivo: "jpeg" | "png" | "webp"; tamanhoKb: number; }`
  - `export interface UploadUrlAvatarResult { uploadUrl: string; storageKey: string; }`
  - `usuarioService.gerarUrlUploadAvatar(usuarioId: string, input: UploadUrlAvatarInput): Promise<UploadUrlAvatarResult>`
  - `usuarioService.confirmarUploadAvatar(usuarioId: string, storageKey: string): Promise<Usuario>` — apaga a key antiga do S3 (se houver) e sobrescreve `avatarUrl`.
  - Usado pelas rotas das Tasks 18 e 19.

- [ ] **Step 1: Verificar se `src/services/usuario.service.test.ts` já existe**

Run: `ls src/services/usuario.service.test.ts`
Expected: o arquivo existe (é referenciado implicitamente pela cobertura de Services já em produção). Se o comando falhar (`No such file`), criar o arquivo do zero copiando a estrutura de mocks de `src/services/comentario.service.test.ts` (mock de `@/repositories/usuario.repository`, sem `prisma.$transaction` já que `usuarioService` hoje não usa transação para esses métodos) antes de prosseguir para o Step 2.

- [ ] **Step 2: Escrever o teste falho, adicionando ao final do arquivo de teste**

```ts
import {
  usuarioService,
  TamanhoAvatarInvalidoError,
} from "./usuario.service";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { s3Client } from "@/lib/external/s3-client";

jest.mock("@/lib/external/s3-client");
// (se `usuario.repository` ainda não estiver mockado no topo do arquivo, adicionar:)
// jest.mock("@/repositories/usuario.repository");

const s3 = s3Client as jest.Mocked<typeof s3Client>;
const repo = usuarioRepository as jest.Mocked<typeof usuarioRepository>;

describe("usuarioService.gerarUrlUploadAvatar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    s3.gerarUrlUpload.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-put-avatar");
  });

  it("monta a key sob avatares/{usuarioId} e devolve a URL assinada de PUT", async () => {
    const resultado = await usuarioService.gerarUrlUploadAvatar("user-1", {
      nomeArquivo: "foto.png",
      tipoArquivo: "png",
      tamanhoKb: 200,
    });

    expect(resultado.storageKey).toContain("avatares/user-1/");
    expect(resultado.storageKey).toContain("foto.png");
    expect(resultado.uploadUrl).toBe("https://bucket.s3.amazonaws.com/signed-put-avatar");
    expect(s3.gerarUrlUpload).toHaveBeenCalledWith(resultado.storageKey, "image/png", 200 * 1024);
  });

  // Avatar é mais restrito que documento: 5MB, não 10MB (spec: "mais restrito porque
  // avatar é sempre exibido pequeno").
  it("recusa avatar maior que 5MB antes de chamar o S3", async () => {
    await expect(
      usuarioService.gerarUrlUploadAvatar("user-1", {
        nomeArquivo: "grande.png",
        tipoArquivo: "png",
        tamanhoKb: 5121,
      })
    ).rejects.toThrow(TamanhoAvatarInvalidoError);
    expect(s3.gerarUrlUpload).not.toHaveBeenCalled();
  });
});

describe("usuarioService.confirmarUploadAvatar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sobrescreve avatarUrl e apaga a key antiga do S3", async () => {
    repo.findById.mockResolvedValue({
      id: "user-1",
      nome: "Fulano",
      email: "fulano@teste.com",
      senhaHash: "hash",
      avatarUrl: "development/avatares/user-1/111-antiga.png",
      oab: null,
      telefone: null,
      ativo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    repo.update.mockResolvedValue({ id: "user-1", avatarUrl: "development/avatares/user-1/222-nova.png" } as never);

    await usuarioService.confirmarUploadAvatar("user-1", "development/avatares/user-1/222-nova.png");

    expect(s3.excluirArquivo).toHaveBeenCalledWith("development/avatares/user-1/111-antiga.png");
    expect(repo.update).toHaveBeenCalledWith("user-1", {
      avatarUrl: "development/avatares/user-1/222-nova.png",
    });
  });

  it("não tenta apagar do S3 quando não havia avatar anterior", async () => {
    repo.findById.mockResolvedValue({ id: "user-1", avatarUrl: null } as never);
    repo.update.mockResolvedValue({ id: "user-1", avatarUrl: "development/avatares/user-1/222-nova.png" } as never);

    await usuarioService.confirmarUploadAvatar("user-1", "development/avatares/user-1/222-nova.png");

    expect(s3.excluirArquivo).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx jest src/services/usuario.service.test.ts`
Expected: FAIL — `TamanhoAvatarInvalidoError`/`gerarUrlUploadAvatar`/`confirmarUploadAvatar` não existem em `usuario.service.ts`.

- [ ] **Step 4: Implementar os métodos novos em `usuario.service.ts`**

Adicionar os imports no topo:

```ts
import { s3Client } from "@/lib/external/s3-client";
```

Adicionar as classes/tipos novos, junto das outras classes de erro do arquivo:

```ts
export class TamanhoAvatarInvalidoError extends Error {
  constructor() {
    super("A imagem excede o tamanho máximo permitido (5MB).");
    this.name = "TamanhoAvatarInvalidoError";
  }
}

const TAMANHO_MAXIMO_AVATAR_KB = 5 * 1024;

const MIME_POR_TIPO_AVATAR: Record<"jpeg" | "png" | "webp", string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export interface UploadUrlAvatarInput {
  nomeArquivo: string;
  tipoArquivo: "jpeg" | "png" | "webp";
  tamanhoKb: number;
}

export interface UploadUrlAvatarResult {
  uploadUrl: string;
  storageKey: string;
}
```

Adicionar os métodos dentro do objeto `usuarioService`, depois de `alterarSenha`:

```ts
  async gerarUrlUploadAvatar(
    usuarioId: string,
    input: UploadUrlAvatarInput
  ): Promise<UploadUrlAvatarResult> {
    if (input.tamanhoKb > TAMANHO_MAXIMO_AVATAR_KB) {
      throw new TamanhoAvatarInvalidoError();
    }

    const storageKey = `${process.env.AWS_S3_PREFIX}/avatares/${usuarioId}/${Date.now()}-${input.nomeArquivo}`;
    const uploadUrl = await s3Client.gerarUrlUpload(
      storageKey,
      MIME_POR_TIPO_AVATAR[input.tipoArquivo],
      input.tamanhoKb * 1024
    );

    return { uploadUrl, storageKey };
  },

  // Avatar não gera log de auditoria (é dado de perfil, não de domínio jurídico) nem
  // tabela própria — só sobrescreve usuario.avatar_url e libera a key antiga no S3.
  async confirmarUploadAvatar(usuarioId: string, storageKey: string): Promise<Usuario> {
    const atual = await usuarioRepository.findById(usuarioId);

    if (atual?.avatarUrl) {
      await s3Client.excluirArquivo(atual.avatarUrl);
    }

    return usuarioRepository.update(usuarioId, { avatarUrl: storageKey });
  },
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx jest src/services/usuario.service.test.ts`
Expected: PASS, incluindo os 4 testes novos.

- [ ] **Step 6: Commit**

```bash
git add src/services/usuario.service.ts src/services/usuario.service.test.ts
git commit -m "feat(perfil): adiciona upload e troca de avatar ao usuarioService"
```

---

### Task 18: Rota `POST /api/perfil/avatar/upload-url`

**Files:**
- Create: `src/app/api/perfil/avatar/upload-url/route.ts`
- Test: `src/app/api/perfil/avatar/upload-url/route.test.ts`

**Interfaces:**
- Consumes: `usuarioService.gerarUrlUploadAvatar` (Task 17), `auth()` (existente — perfil não passa por `getTenantContext`, mesmo padrão de `src/app/api/perfil/route.ts`).
- Produces: `POST` handler que devolve `{ uploadUrl, storageKey }`.

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/app/api/perfil/avatar/upload-url/route.test.ts
import { POST } from "./route";
import { auth } from "@/lib/auth/config";
import { usuarioService, TamanhoAvatarInvalidoError } from "@/services/usuario.service";

jest.mock("@/lib/auth/config");
jest.mock("@/services/usuario.service");

function request(body: unknown) {
  return new Request("http://localhost/api/perfil/avatar/upload-url", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: "user-1" } });
});

describe("POST /api/perfil/avatar/upload-url", () => {
  it("devolve uploadUrl e storageKey", async () => {
    (usuarioService.gerarUrlUploadAvatar as jest.Mock).mockResolvedValue({
      uploadUrl: "https://bucket.s3.amazonaws.com/signed-put-avatar",
      storageKey: "development/avatares/user-1/123-foto.png",
    });

    const resposta = await POST(request({ nomeArquivo: "foto.png", tipoArquivo: "png", tamanhoKb: 200 }));

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo).toEqual({
      uploadUrl: "https://bucket.s3.amazonaws.com/signed-put-avatar",
      storageKey: "development/avatares/user-1/123-foto.png",
    });
  });

  it("recusa quando não há sessão", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const resposta = await POST(request({ nomeArquivo: "foto.png", tipoArquivo: "png", tamanhoKb: 200 }));
    expect(resposta.status).toBe(401);
  });

  it("recusa payload inválido com 400", async () => {
    const resposta = await POST(request({ nomeArquivo: "foto.png" }));
    expect(resposta.status).toBe(400);
  });

  it("mapeia TamanhoAvatarInvalidoError para 400", async () => {
    (usuarioService.gerarUrlUploadAvatar as jest.Mock).mockRejectedValue(new TamanhoAvatarInvalidoError());
    const resposta = await POST(request({ nomeArquivo: "grande.png", tipoArquivo: "png", tamanhoKb: 9999 }));
    expect(resposta.status).toBe(400);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/app/api/perfil/avatar/upload-url/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar a rota**

```ts
// src/app/api/perfil/avatar/upload-url/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { usuarioService, TamanhoAvatarInvalidoError } from "@/services/usuario.service";

const uploadUrlAvatarSchema = z.object({
  nomeArquivo: z.string().trim().min(1).max(255),
  tipoArquivo: z.enum(["jpeg", "png", "webp"]),
  tamanhoKb: z.number().int().positive(),
});

// Perfil é do usuário, não do tenant — não passa por getTenantContext() (mesmo
// motivo de src/app/api/perfil/route.ts: pode estar em onboarding, sem escritório).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const parsed = uploadUrlAvatarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const resultado = await usuarioService.gerarUrlUploadAvatar(session.user.id, parsed.data);
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof TamanhoAvatarInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Erro ao gerar URL de upload de avatar", error);
    return NextResponse.json({ error: "Não foi possível iniciar o upload." }, { status: 502 });
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/perfil/avatar/upload-url/route.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/perfil/avatar/upload-url/route.ts src/app/api/perfil/avatar/upload-url/route.test.ts
git commit -m "feat(perfil): adiciona rota de geração de URL de upload de avatar"
```

---

### Task 19: Rota `POST /api/perfil/avatar/confirmar`

**Files:**
- Create: `src/app/api/perfil/avatar/confirmar/route.ts`
- Test: `src/app/api/perfil/avatar/confirmar/route.test.ts`

**Interfaces:**
- Consumes: `usuarioService.confirmarUploadAvatar` (Task 17).
- Produces: `POST` handler que devolve `{ usuario: { id, nome, email, avatarUrl } }`.

- [ ] **Step 1: Escrever o teste falho**

```ts
// src/app/api/perfil/avatar/confirmar/route.test.ts
import { POST } from "./route";
import { auth } from "@/lib/auth/config";
import { usuarioService } from "@/services/usuario.service";

jest.mock("@/lib/auth/config");
jest.mock("@/services/usuario.service");

function request(body: unknown) {
  return new Request("http://localhost/api/perfil/avatar/confirmar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: "user-1" } });
});

describe("POST /api/perfil/avatar/confirmar", () => {
  it("confirma o avatar e devolve os dados públicos do usuário", async () => {
    (usuarioService.confirmarUploadAvatar as jest.Mock).mockResolvedValue({
      id: "user-1",
      nome: "Fulano",
      email: "fulano@teste.com",
      avatarUrl: "development/avatares/user-1/123-foto.png",
    });

    const resposta = await POST(request({ storageKey: "development/avatares/user-1/123-foto.png" }));

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo).toEqual({
      usuario: {
        id: "user-1",
        nome: "Fulano",
        email: "fulano@teste.com",
        avatarUrl: "development/avatares/user-1/123-foto.png",
      },
    });
    expect(usuarioService.confirmarUploadAvatar).toHaveBeenCalledWith(
      "user-1",
      "development/avatares/user-1/123-foto.png"
    );
  });

  it("recusa quando não há sessão", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const resposta = await POST(request({ storageKey: "x" }));
    expect(resposta.status).toBe(401);
  });

  it("recusa payload inválido com 400", async () => {
    const resposta = await POST(request({}));
    expect(resposta.status).toBe(400);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/app/api/perfil/avatar/confirmar/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar a rota**

```ts
// src/app/api/perfil/avatar/confirmar/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { usuarioService } from "@/services/usuario.service";

const confirmarAvatarSchema = z.object({
  storageKey: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const parsed = confirmarAvatarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const usuario = await usuarioService.confirmarUploadAvatar(session.user.id, parsed.data.storageKey);
    return NextResponse.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        avatarUrl: usuario.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Erro ao confirmar upload de avatar", error);
    return NextResponse.json({ error: "Não foi possível confirmar o avatar." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/perfil/avatar/confirmar/route.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/perfil/avatar/confirmar/route.ts src/app/api/perfil/avatar/confirmar/route.test.ts
git commit -m "feat(perfil): adiciona rota de confirmação de upload de avatar"
```

---

### Task 20: Suíte completa e cobertura

**Files:**
- Nenhum arquivo novo — task de verificação final.

**Interfaces:**
- Consumes: toda a suíte de testes das Tasks 1–19.
- Produces: confirmação de que o gate de cobertura do CI (`docs/testes/estrategia-tdd.md`, `jest.config.ts`) passa com o código novo.

- [ ] **Step 1: Rodar a suíte completa com cobertura**

Run: `npm run test:coverage`
Expected: todos os testes passam; os thresholds de `src/services/**` (90%), `src/repositories/**` (70%), `src/app/api/**` (70%) e `src/lib/auth/**` (90%) continuam satisfeitos com os arquivos novos inclusos.

- [ ] **Step 2: Rodar o typecheck e o lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Rodar as migrations em modo `deploy` para confirmar que aplicam limpo (simula CI/produção)**

Run: `npx prisma migrate deploy`
Expected: `No pending migrations to apply` (já foram aplicadas em modo `dev` na Task 2) ou aplica sem erro se rodado num banco limpo.

Este task não gera commit — é só verificação. Se algum item falhar, volte à task correspondente, corrija e re-commit lá (não crie um commit de "fix" solto aqui).

---

## Resumo de rotas criadas

| Método | Rota | Task |
|---|---|---|
| POST | `/api/documentos/upload-url` | 9 |
| POST | `/api/documentos/{id}/confirmar` | 10 |
| GET | `/api/documentos?escopo=&escopoId=` | 11 |
| GET | `/api/documentos/{id}/download-url` | 12 |
| DELETE | `/api/documentos/{id}` | 13 |
| GET | `/api/clientes/{id}/documentos/download-todos` | 15 |
| GET | `/api/casos/{id}/documentos/download-todos` | 16 |
| POST | `/api/perfil/avatar/upload-url` | 18 |
| POST | `/api/perfil/avatar/confirmar` | 19 |

## Fora de escopo (herdado da spec, não implementado neste plano)

- Rotação/limpeza de objetos órfãos no S3 (upload iniciado, nunca confirmado).
- Redimensionamento/otimização de imagem de avatar.
- Versionamento de documentos.
- Preview inline de PDF/imagem no navegador.
- UI (componentes React, formulários de upload, botões de download) — este plano cobre apenas a camada de API/Service/Repository/cliente externo.
