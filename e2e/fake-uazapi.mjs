// UAZAPI falsa para o e2e: só o que a sincronização de campanhas consome. Estado em
// memória, separado por token de instância (cada spec usa o seu, então specs paralelos
// não se enxergam). Porta: E2E_UAZAPI_PORT (padrão 3999).
//
// Rotas:
//   GET  /sender/listfolders   -> pastas do token do header `token` (formato da UAZAPI:
//                                 snake_case e `log_sucess` com um "c" só)
//   POST /sender/listmessages  -> nenhuma mensagem
//   POST /__fake/contadores    -> { token, folderId, ...campos } cria/atualiza a pasta
//   GET  /__fake/saude         -> healthcheck do webServer do Playwright
//   qualquer outra             -> 200 {}
import { createServer } from "node:http";

const porta = Number(process.env.E2E_UAZAPI_PORT ?? 3999);
const pastasPorToken = new Map();

function responder(res, status, corpo) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(corpo));
}

async function lerJson(req) {
  let bruto = "";
  for await (const pedaco of req) bruto += pedaco;
  try {
    return bruto ? JSON.parse(bruto) : {};
  } catch {
    return {};
  }
}

const servidor = createServer(async (req, res) => {
  const caminho = new URL(req.url ?? "/", "http://localhost").pathname;

  if (req.method === "GET" && caminho === "/sender/listfolders") {
    const token = String(req.headers.token ?? "");
    return responder(res, 200, [...(pastasPorToken.get(token)?.values() ?? [])]);
  }

  if (req.method === "POST" && caminho === "/sender/listmessages") {
    return responder(res, 200, { messages: [], pagination: { totalRecords: 0 } });
  }

  if (req.method === "POST" && caminho === "/__fake/contadores") {
    const { token, folderId, ...campos } = await lerJson(req);
    if (typeof token !== "string" || typeof folderId !== "string") {
      return responder(res, 400, { erro: "token e folderId são obrigatórios" });
    }
    const pastas = pastasPorToken.get(token) ?? new Map();
    const atual = pastas.get(folderId) ?? {
      id: folderId,
      info: "",
      status: "sending",
      log_total: 0,
      log_sucess: 0,
      log_failed: 0,
      log_delivered: 0,
      log_read: 0,
      log_played: 0,
    };
    pastas.set(folderId, { ...atual, ...campos, id: folderId });
    pastasPorToken.set(token, pastas);
    return responder(res, 200, pastas.get(folderId));
  }

  return responder(res, 200, {});
});

servidor.listen(porta, () => {
  console.log(`[uazapi falsa] ouvindo em http://localhost:${porta}`);
});
