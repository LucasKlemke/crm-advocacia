import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import type { CampanhaDTO } from "@crm/compartilhado/tipos/campanha";
import { AcessoNegadoError, type SessaoMinima, type TenantContext } from "@dominio/lib/auth/resolver-tenant";
import { assinarSessao, assinarTicketWs } from "@dominio/lib/auth/sessao-jwt";
import { eventosCampanha } from "@dominio/lib/tempo-real/eventos-campanha";
import {
  CODIGO_LIMITE_CONEXOES,
  CODIGO_NAO_AUTENTICADO,
  CODIGO_ORIGEM_PROIBIDA,
  INTERVALO_PING_MS,
  MAX_CONEXOES_POR_USUARIO,
  CICLOS_REVALIDACAO,
  anexarServidorWs,
  type OpcoesServidorWs,
} from "./servidor-ws";

const ambienteOriginal = { ...process.env };

interface Cliente {
  ws: WebSocket;
  mensagens: unknown[];
  // Resolve na primeira mensagem (o servidor só manda "pronto" depois de assinar).
  pronto: Promise<void>;
  fechado: Promise<{ codigo: number }>;
  proximaMensagem(): Promise<unknown>;
}

function campanha(id: string): CampanhaDTO {
  return { id, nome: `Campanha ${id}` } as unknown as CampanhaDTO;
}

function resolverPorMembros(membros: Record<string, string[]>) {
  return jest.fn(async (sessao: SessaoMinima): Promise<TenantContext> => {
    const escritorios = membros[sessao.usuarioId ?? ""] ?? [];
    if (!sessao.escritorioId || !escritorios.includes(sessao.escritorioId)) throw new AcessoNegadoError();
    return { usuarioId: sessao.usuarioId!, escritorioId: sessao.escritorioId, role: "owner" };
  });
}

describe("servidor WebSocket /api/ws", () => {
  let servidor: Server;
  let porta: number;
  let ws: { fechar(): Promise<void> } | null;
  const clientes: WebSocket[] = [];

  async function subir(opcoes: Partial<OpcoesServidorWs> = {}) {
    ws = anexarServidorWs(servidor, {
      origensWeb: ["https://app.exemplo.com"],
      resolverTenant: resolverPorMembros({ "user-a": ["esc-A", "esc-B"], "user-b": ["esc-B"] }),
      ...opcoes,
    });
  }

  function conectar(caminho: string, opcoes: { origem?: string; autoPong?: boolean } = {}): Cliente {
    const socket = new WebSocket(`ws://127.0.0.1:${porta}${caminho}`, {
      headers: opcoes.origem ? { Origin: opcoes.origem } : {},
      autoPong: opcoes.autoPong ?? true,
    });
    clientes.push(socket);
    const mensagens: unknown[] = [];
    const esperando: ((m: unknown) => void)[] = [];
    socket.on("message", (dado) => {
      const mensagem = JSON.parse(String(dado));
      const proximo = esperando.shift();
      if (proximo) proximo(mensagem);
      else mensagens.push(mensagem);
    });
    // Erros do cliente (ex.: upgrade recusado) não podem derrubar o teste.
    socket.on("error", () => undefined);
    const fechado = new Promise<{ codigo: number }>((resolve) => socket.on("close", (codigo) => resolve({ codigo })));
    const proximaMensagem = () =>
      mensagens.length > 0 ? Promise.resolve(mensagens.shift()) : new Promise<unknown>((r) => esperando.push(r));
    const pronto = proximaMensagem().then((m) => {
      expect(m).toEqual({ tipo: "pronto" });
    });
    // Evita unhandled rejection quando o teste espera fechamento sem "pronto".
    pronto.catch(() => undefined);
    return { ws: socket, mensagens, pronto, fechado, proximaMensagem };
  }

  async function conectarComTicket(usuario: string, escritorio: string, opcoes: { autoPong?: boolean } = {}) {
    const { ticket } = await assinarTicketWs({ sub: usuario, escritorioId: escritorio });
    const cliente = conectar(`/api/ws?ticket=${encodeURIComponent(ticket)}`, opcoes);
    await cliente.pronto;
    return cliente;
  }

  beforeEach(async () => {
    process.env = { ...ambienteOriginal, AUTH_SECRET: "segredo-de-teste-com-pelo-menos-32-caracteres" };
    servidor = createServer((_req, res) => res.writeHead(404).end());
    await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
    porta = (servidor.address() as AddressInfo).port;
    ws = null;
  });

  afterEach(async () => {
    for (const socket of clientes.splice(0)) socket.terminate();
    await ws?.fechar();
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    process.env = ambienteOriginal;
    jest.restoreAllMocks();
  });

  it("constantes do contrato", () => {
    expect(CODIGO_NAO_AUTENTICADO).toBe(4401);
    expect(CODIGO_ORIGEM_PROIBIDA).toBe(4403);
    expect(INTERVALO_PING_MS).toBe(25000);
    expect(MAX_CONEXOES_POR_USUARIO).toBe(5);
    expect(CICLOS_REVALIDACAO).toBe(4);
  });

  describe("autenticação", () => {
    it("sem ticket → fecha com 4401", async () => {
      await subir();
      await expect(conectar("/api/ws").fechado).resolves.toEqual({ codigo: 4401 });
    });

    it("ticket inválido → 4401", async () => {
      await subir();
      await expect(conectar("/api/ws?ticket=lixo").fechado).resolves.toEqual({ codigo: 4401 });
    });

    it("token de sessão no lugar do ticket → 4401", async () => {
      await subir();
      const sessao = await assinarSessao({ sub: "user-a", escritorioId: "esc-A" });
      await expect(conectar(`/api/ws?ticket=${sessao}`).fechado).resolves.toEqual({ codigo: 4401 });
    });

    it("ticket reusado → a segunda conexão fecha com 4401", async () => {
      await subir();
      const { ticket } = await assinarTicketWs({ sub: "user-a", escritorioId: "esc-A" });

      const primeira = conectar(`/api/ws?ticket=${ticket}`);
      await primeira.pronto;
      const segunda = conectar(`/api/ws?ticket=${ticket}`);

      await expect(segunda.fechado).resolves.toEqual({ codigo: 4401 });
      expect(primeira.ws.readyState).toBe(WebSocket.OPEN);
    });

    it("membership resolvida no banco com o usuário e o escritório do ticket; sem acesso → 4401 sem assinar", async () => {
      const resolverTenant = resolverPorMembros({ "user-b": ["esc-B"] });
      const assinar = jest.spyOn(eventosCampanha, "assinar");
      await subir({ resolverTenant });
      const { ticket } = await assinarTicketWs({ sub: "user-b", escritorioId: "esc-A" });

      await expect(conectar(`/api/ws?ticket=${ticket}`).fechado).resolves.toEqual({ codigo: 4401 });
      expect(resolverTenant).toHaveBeenCalledWith({ usuarioId: "user-b", escritorioId: "esc-A" });
      expect(assinar).not.toHaveBeenCalled();
    });

    it("falha inesperada ao resolver o tenant (banco fora) → fecha com 1011 e loga", async () => {
      const erroSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      await subir({ resolverTenant: jest.fn().mockRejectedValue(new Error("banco fora")) });
      const { ticket } = await assinarTicketWs({ sub: "user-a", escritorioId: "esc-A" });

      await expect(conectar(`/api/ws?ticket=${ticket}`).fechado).resolves.toEqual({ codigo: 1011 });
      expect(erroSpy).toHaveBeenCalledWith(expect.stringContaining("[tempo-real]"), expect.any(Error));
    });
  });

  describe("origem", () => {
    it("Origin fora de WEB_ORIGINS e diferente do host → 4403, sem consumir o ticket", async () => {
      await subir();
      const { ticket } = await assinarTicketWs({ sub: "user-a", escritorioId: "esc-A" });

      const proibida = conectar(`/api/ws?ticket=${ticket}`, { origem: "https://malicioso.exemplo" });
      await expect(proibida.fechado).resolves.toEqual({ codigo: 4403 });

      // O mesmo ticket ainda vale numa origem permitida.
      await expect(conectar(`/api/ws?ticket=${ticket}`, { origem: "https://app.exemplo.com" }).pronto).resolves.toBeUndefined();
    });

    it("Origin igual ao host da requisição é aceita", async () => {
      await subir({ origensWeb: [] });
      const { ticket } = await assinarTicketWs({ sub: "user-a", escritorioId: "esc-A" });

      await expect(conectar(`/api/ws?ticket=${ticket}`, { origem: `http://127.0.0.1:${porta}` }).pronto).resolves.toBeUndefined();
    });

    it("sem Origin (cliente não-browser) é aceita", async () => {
      await subir({ origensWeb: [] });
      const cliente = await conectarComTicket("user-a", "esc-A");
      expect(cliente.ws.readyState).toBe(WebSocket.OPEN);
    });
  });

  describe("entrega de eventos", () => {
    it("evento do escritório A chega só ao socket de A, sem escritorioId no payload", async () => {
      await subir();
      const clienteA = await conectarComTicket("user-a", "esc-A");
      const clienteB = await conectarComTicket("user-b", "esc-B");

      eventosCampanha.publicar({ tipo: "campanha.atualizada", escritorioId: "esc-A", campanha: campanha("c-A") });
      eventosCampanha.publicar({ tipo: "campanha.atualizada", escritorioId: "esc-B", campanha: campanha("c-B") });

      await expect(clienteA.proximaMensagem()).resolves.toEqual({ tipo: "campanha.atualizada", campanha: campanha("c-A") });
      // Mensagens chegam em ordem: se o evento de A tivesse vazado, seria o primeiro de B.
      await expect(clienteB.proximaMensagem()).resolves.toEqual({ tipo: "campanha.atualizada", campanha: campanha("c-B") });
    });

    it("mesmo usuário membro de A e B: cada socket só recebe o escritório do próprio ticket", async () => {
      await subir();
      const socketA = await conectarComTicket("user-a", "esc-A");
      const socketB = await conectarComTicket("user-a", "esc-B");

      eventosCampanha.publicar({ tipo: "campanha.atualizada", escritorioId: "esc-B", campanha: campanha("c-B") });
      eventosCampanha.publicar({ tipo: "campanha.atualizada", escritorioId: "esc-A", campanha: campanha("c-A") });

      await expect(socketA.proximaMensagem()).resolves.toEqual({ tipo: "campanha.atualizada", campanha: campanha("c-A") });
      await expect(socketB.proximaMensagem()).resolves.toEqual({ tipo: "campanha.atualizada", campanha: campanha("c-B") });
    });

    it("repassa campanha.removida só com o id", async () => {
      await subir();
      const cliente = await conectarComTicket("user-a", "esc-A");

      eventosCampanha.publicar({ tipo: "campanha.removida", escritorioId: "esc-A", campanhaId: "c-1" });

      await expect(cliente.proximaMensagem()).resolves.toEqual({ tipo: "campanha.removida", campanhaId: "c-1" });
    });

    it("desconectar cancela a assinatura; publicar depois não lança nem loga erro", async () => {
      const cancelamentos: jest.Mock[] = [];
      const original = eventosCampanha.assinar.bind(eventosCampanha);
      jest.spyOn(eventosCampanha, "assinar").mockImplementation((escritorioId, ouvinte) => {
        const cancelar = jest.fn(original(escritorioId, ouvinte));
        cancelamentos.push(cancelar);
        return cancelar;
      });
      const erroSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      await subir();
      const cliente = await conectarComTicket("user-a", "esc-A");
      expect(cancelamentos).toHaveLength(1);

      cliente.ws.close();
      await cliente.fechado;
      await new Promise((r) => setTimeout(r, 20));

      expect(cancelamentos[0]).toHaveBeenCalledTimes(1);
      expect(() =>
        eventosCampanha.publicar({ tipo: "campanha.atualizada", escritorioId: "esc-A", campanha: campanha("c-1") })
      ).not.toThrow();
      expect(erroSpy).not.toHaveBeenCalled();
    });
  });

  describe("upgrade e ciclo de vida", () => {
    it("path diferente de /api/ws não faz upgrade", async () => {
      await subir();
      const cliente = conectar("/api/outra-coisa");
      const aberto = jest.fn();
      cliente.ws.on("open", aberto);

      await cliente.fechado;
      expect(aberto).not.toHaveBeenCalled();
    });

    it("6ª conexão do mesmo usuário fecha a mais antiga", async () => {
      await subir();
      const conexoes: Cliente[] = [];
      for (let i = 0; i < 5; i++) conexoes.push(await conectarComTicket("user-a", "esc-A"));

      await conectarComTicket("user-a", "esc-B");

      await expect(conexoes[0].fechado).resolves.toEqual({ codigo: CODIGO_LIMITE_CONEXOES });
      for (const conexao of conexoes.slice(1)) expect(conexao.ws.readyState).toBe(WebSocket.OPEN);
    });

    it("o limite é por usuário: outro usuário não derruba ninguém", async () => {
      await subir();
      const conexoes: Cliente[] = [];
      for (let i = 0; i < 5; i++) conexoes.push(await conectarComTicket("user-a", "esc-B"));

      await conectarComTicket("user-b", "esc-B");

      for (const conexao of conexoes) expect(conexao.ws.readyState).toBe(WebSocket.OPEN);
    });

    it("ping periódico: quem não responde ao pong é encerrado, quem responde fica", async () => {
      await subir({ intervaloPingMs: 40 });
      const vivo = await conectarComTicket("user-a", "esc-A");
      const mudo = await conectarComTicket("user-b", "esc-B", { autoPong: false });

      await expect(mudo.fechado).resolves.toEqual({ codigo: 1006 });
      expect(vivo.ws.readyState).toBe(WebSocket.OPEN);
    });

    it("fechar() encerra os sockets abertos e para de aceitar upgrades", async () => {
      await subir();
      const cliente = await conectarComTicket("user-a", "esc-A");

      await ws!.fechar();
      ws = null;
      await cliente.fechado;

      const depois = conectar("/api/ws");
      const aberto = jest.fn();
      depois.ws.on("open", aberto);
      await depois.fechado;
      expect(aberto).not.toHaveBeenCalled();
    });
  });

  describe("revalidação periódica do vínculo (RN19)", () => {
    it("membership removida → socket fechado com 4401 no ciclo de revalidação", async () => {
      const membros: Record<string, string[]> = { "user-a": ["esc-A"] };
      const resolverTenant = jest.fn(async (sessao: SessaoMinima): Promise<TenantContext> => {
        if (!(membros[sessao.usuarioId!] ?? []).includes(sessao.escritorioId!)) throw new AcessoNegadoError();
        return { usuarioId: sessao.usuarioId!, escritorioId: sessao.escritorioId!, role: "owner" };
      });
      await subir({ resolverTenant, intervaloPingMs: 20 });
      const cliente = await conectarComTicket("user-a", "esc-A");
      resolverTenant.mockClear();

      membros["user-a"] = [];

      await expect(cliente.fechado).resolves.toEqual({ codigo: 4401 });
      expect(resolverTenant).toHaveBeenCalledWith({ usuarioId: "user-a", escritorioId: "esc-A" });
    });

    it("revalida só a cada 4 ciclos de ping, com o usuário e o escritório do socket", async () => {
      const resolverTenant = resolverPorMembros({ "user-a": ["esc-B"] });
      const inicio = Date.now();
      await subir({ resolverTenant, intervaloPingMs: 40 });
      const cliente = await conectarComTicket("user-a", "esc-B");
      resolverTenant.mockClear();
      const ate = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, inicio + ms - Date.now())));

      // Ciclos em 40, 80, 120 ms não revalidam (timers só atrasam, nunca adiantam); o 4º (160 ms) sim.
      await ate(140);
      expect(resolverTenant).not.toHaveBeenCalled();
      await ate(240);
      expect(resolverTenant).toHaveBeenCalledWith({ usuarioId: "user-a", escritorioId: "esc-B" });
      expect(cliente.ws.readyState).toBe(WebSocket.OPEN);
    });

    it("erro transitório do banco mantém o socket, loga e tenta de novo no próximo ciclo", async () => {
      const erroSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const resolverTenant = resolverPorMembros({ "user-a": ["esc-A"] });
      await subir({ resolverTenant, intervaloPingMs: 20 });
      const cliente = await conectarComTicket("user-a", "esc-A");
      resolverTenant.mockClear();
      resolverTenant.mockRejectedValueOnce(new Error("banco fora"));

      // Primeira revalidação (~80 ms) falha; a segunda (~160 ms) passa.
      await new Promise((r) => setTimeout(r, 200));

      expect(resolverTenant.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(erroSpy).toHaveBeenCalledWith(
        expect.stringContaining("[tempo-real]"),
        expect.objectContaining({ usuarioId: "user-a", escritorioId: "esc-A" }),
        expect.any(Error)
      );
      expect(cliente.ws.readyState).toBe(WebSocket.OPEN);
    });
  });

  describe("erros do socket", () => {
    it("loga só o código do erro (sem URL nem ticket) via console.warn", async () => {
      const avisoSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      await subir();
      const { ticket } = await assinarTicketWs({ sub: "user-a", escritorioId: "esc-A" });
      const cliente = conectar(`/api/ws?ticket=${ticket}`);
      await cliente.pronto;

      // Frame com opcode inválido (0x3) — o servidor emite "error" e derruba a conexão.
      (cliente.ws as unknown as { _socket: { write(b: Buffer): void } })._socket.write(Buffer.from([0x83, 0x80, 0, 0, 0, 0]));
      await cliente.fechado;
      await new Promise((r) => setTimeout(r, 20));

      expect(avisoSpy).toHaveBeenCalledWith(expect.stringContaining("[tempo-real]"), { codigo: "WS_ERR_INVALID_OPCODE" });
      expect(JSON.stringify(avisoSpy.mock.calls)).not.toContain(ticket);
    });
  });
});
