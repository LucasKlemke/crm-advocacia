# Armazenamento de Arquivos (S3) — Documentos de Cliente/Caso e Avatar

Data: 2026-08-20
Status: Aprovado, aguardando plano de implementação

## Contexto

O bucket S3 já foi criado (fora do escopo desta spec), com duas pastas de topo: `development` e `producao`. Nenhuma integração com S3 existe hoje no código — `usuario.avatar_url` já existe no schema do Prisma como campo reservado, mas não é preenchido por nenhum fluxo, e a tabela `documento` documentada em [docs/database/schema.md](../../database/schema.md) (FK direta em `caso`) nunca foi implementada (sem repository/service/migration).

Esta spec cobre três funcionalidades novas:

1. Cliente de integração com o bucket S3.
2. Upload/troca de foto de perfil (avatar) do usuário membro do escritório.
3. Documentos anexados a clientes e a casos, com download individual e download em massa ("baixar todos").

## Decisões

- **Credenciais**: IAM User com Access Key/Secret fixos em variáveis de ambiente — mais simples de rodar local e no Amplify do que assumir uma Role.
- **Download**: URLs assinadas (presigned GET), conforme já previsto no `CLAUDE.md` ("Amazon S3 (URL assinada)"). O navegador baixa direto do S3, sem proxy do servidor.
- **"Baixar todos"**: zip gerado sob demanda no servidor (stream), um único arquivo `.zip` entregue ao usuário — melhor UX que múltiplos downloads separados, e o volume esperado (até 1.000 clientes/5.000 casos por escritório, poucos arquivos cada) não justifica a complexidade de downloads paralelos no client.
- **Modelo de documento**: uma única tabela `documento` com `escopo` (`cliente` | `caso`) + `escopo_id`, sem FK — mesmo padrão já usado em `comentario`, validado no Service. Evita duplicar schema/repository/rotas por entidade.
- **Avatar**: tratado como caso à parte, não como `documento` — só sobrescreve `usuario.avatar_url`. Não precisa de histórico, listagem, download em massa nem log de auditoria de domínio jurídico.
- **Upload**: presigned PUT URL — o navegador sobe o arquivo direto pro S3, simétrico ao download, sem sobrecarregar o servidor com bytes de arquivo.
- **Limites do avatar**: imagens até 5MB, tipos JPEG/PNG/WEBP — mais restrito que documentos porque avatar é sempre exibido pequeno.
- **Exclusão de documento**: soft delete, mesma regra de permissão já usada em `comentario` (RN21) — autor do upload, `owner` ou `admin` do escritório podem excluir; arquivo permanece no S3 (permite reverter).
- **Prefixo de ambiente**: variável de ambiente explícita `AWS_S3_PREFIX` (`development` | `producao`), setada manualmente por ambiente — evita acoplar ao `NODE_ENV`, que já controla outras coisas do Next.js.

## Arquitetura

Novo cliente externo `S3Client` em `src/lib/external/s3-client.ts`, no mesmo papel que `UazapiClient` ocupa na arquitetura descrita no `CLAUDE.md` (cliente de serviço externo, chamado só por Services — nunca por Controllers/Repositories diretamente). Usa `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.

Responsabilidades do `S3Client`:

- `gerarUrlUpload(key, contentType, contentLength)` → presigned PUT URL, expira em ~60s.
- `gerarUrlDownload(key)` → presigned GET URL, expira em ~60s.
- `buscarArquivo(key)` → stream do objeto (usado internamente pelo zip do "baixar todos").
- `excluirArquivo(key)` → delete real no S3 (usado só quando um upload substitui outro — troca de avatar; documentos de cliente/caso nunca deletam do S3 no soft delete, só no banco).

### Variáveis de ambiente novas

```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=
AWS_S3_PREFIX=development   # ou "producao"
```

### Organização de keys no bucket

Sempre sob o prefixo de ambiente e escopadas por tenant — reforça RN19 (isolamento de tenant) também na camada de storage, não só no banco:

```
{AWS_S3_PREFIX}/{escritorio_id}/documentos/{escopo}/{escopo_id}/{documento_id}-{nome_original}
{AWS_S3_PREFIX}/{escritorio_id}/avatares/{usuario_id}/{timestamp}-{nome_original}
```

## Modelo de dados

### Tabela `documento` (nova; substitui a versão descrita em schema.md com FK direta em `caso`)

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| escritorio_id | uuid | FK → `escritorio`, `onDelete: Cascade` — escopo de tenant (RN19) |
| escopo | enum `EscopoDocumento` | `cliente` \| `caso` |
| escopo_id | uuid | Id da entidade alvo — sem FK, mesmo padrão de `comentario` |
| autor_membro_id | uuid | FK → `membro`, `onDelete: Restrict` — quem fez upload |
| nome_original | varchar(255) | Nome do arquivo como o usuário enviou |
| tipo_arquivo | enum `TipoArquivo` | `pdf` \| `docx` \| `jpg` \| `png` \| `jpeg` (RN18) |
| tamanho_kb | int | Máx. 10.240 KB = 10MB (RN17) |
| storage_key | varchar(500) | Key completa no S3, incluindo prefixo de ambiente |
| soft_deleted_at | timestamp | `NULL` = ativo; reversível, mesmo padrão de `cliente` |
| created_at / updated_at | timestamp | |

Índice: `@@index([escritorio_id, escopo, escopo_id, soft_deleted_at])` — a consulta real é sempre "arquivos ativos deste alvo, deste tenant".

A validação de que `escopo_id` pertence ao tenant da sessão antes de qualquer escrita fica no `DocumentoService`, exatamente como já acontece em `ComentarioService` para RN19/RN21 — como `(escopo, escopo_id)` não tem integridade referencial de banco, essa checagem no Service é a única garantia contra um documento ancorado num recurso de outro escritório.

### Campo `usuario.avatar_url` (já existe no schema, passa a ser usado)

Nenhuma tabela nova. Upload de avatar sobrescreve o valor de `avatar_url` e remove a key antiga do S3 via `S3Client.excluirArquivo`.

### Consequência para o schema documentado

- A tabela `anotacao` (já marcada em schema.md como "a revisar" — redundante com `comentario` escopo `caso`) permanece fora do escopo, sem mudança nesta spec.
- A definição anterior de `documento` (FK direta em `caso`, sem `escopo`) em schema.md é substituída pela versão acima.

## Fluxos

`DocumentoService` (novo, espelha `ComentarioService`): valida tenant do `escopo_id`, valida tipo/tamanho, orquestra `S3Client` + `DocumentoRepository`, grava em `log` (RN20).

### Upload de documento (cliente ou caso)

1. `POST /api/documentos/upload-url` — body `{ escopo, escopoId, nomeArquivo, tipoArquivo, tamanhoKb }`. O Service valida tenant do alvo, tipo (RN18) e tamanho (RN17) **antes** de gerar a URL — rejeita cedo, sem round-trip ao S3. Gera `documento_id`, monta a `storage_key`, retorna presigned PUT URL + o id.
2. O client sobe o arquivo direto pro S3 via PUT usando a URL recebida.
3. `POST /api/documentos/{id}/confirmar` — cria a linha em `documento` (só agora que o upload foi confirmado) + registro em `log`. Se o passo 2 falhar ou for abandonado, nunca existe linha órfã no banco — só um objeto no S3 sem registro, aceitável sem limpeza automática (ver Fora de escopo).

### Download individual

`GET /api/documentos/{id}/download-url` → Service valida tenant, retorna presigned GET URL; o front redireciona/abre em nova aba.

### "Baixar todos" (por cliente ou por caso)

`GET /api/{clientes|casos}/{id}/documentos/download-todos` → Service busca documentos ativos do escopo, `S3Client.buscarArquivo` em stream para cada um, monta um zip em stream (lib `archiver`) direto na resposta HTTP. Nome do zip: `documentos-caso-{titulo}.zip` ou `documentos-cliente-{nome}.zip`.

### Avatar

- `POST /api/perfil/avatar/upload-url` — valida 5MB / JPEG-PNG-WEBP, mesmo padrão de presigned PUT.
- `POST /api/perfil/avatar/confirmar` — atualiza `usuario.avatar_url` e remove a key antiga do S3.
- Sem tabela `documento`, sem log de auditoria de domínio jurídico (é dado de perfil, não do caso/cliente).

### Exclusão de documento

`DELETE /api/documentos/{id}` — Service checa se quem chama é o autor do upload, `owner` ou `admin` do escritório (RN21); soft delete (`soft_deleted_at`); arquivo permanece no S3; log gravado.

## Tratamento de erro

- Tipo/tamanho inválido → 400, mensagem por campo (mesmo padrão zod das outras rotas).
- Alvo (`escopo_id`) de outro tenant ou inexistente → 404 genérico (nunca revela que o recurso existe em outro escritório).
- Falha do S3 ao gerar URL ou montar zip → 502 com mensagem genérica ao usuário; detalhe técnico só no log estruturado do servidor (NFR de mensagens de erro sem detalhe técnico interno).

## Testes

Conforme [docs/testes/estrategia-tdd.md](../../testes/estrategia-tdd.md), TDD: teste escrito antes da implementação.

- `S3Client`: testes unitários com mocks do SDK AWS (`aws-sdk-client-mock`).
- `DocumentoService`: testes unitários — validação de tipo/tamanho/tenant, permissão de exclusão (autor/owner/admin).
- `DocumentoRepository`: testes de integração contra o Postgres local.
- E2E (Playwright): upload de documento em um caso e download individual. "Baixar todos" e avatar cobertos por teste de integração, não necessariamente E2E completo.

## Fora de escopo

- Rotação/limpeza de objetos órfãos no S3 (upload iniciado mas nunca confirmado no passo 2 do fluxo de upload).
- Redimensionamento/otimização de imagem de avatar.
- Versionamento de documentos.
- Preview inline de PDF/imagem no navegador.
