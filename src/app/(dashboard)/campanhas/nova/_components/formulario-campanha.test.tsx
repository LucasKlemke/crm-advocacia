import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderComQuery } from "@/lib/test-utils";
import { FormularioCampanha } from "./formulario-campanha";
import type { InstanciaWhatsappDTO } from "@/types/instancia-whatsapp";

const mutateCriar = jest.fn();
const push = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/hooks/use-campanhas", () => ({
  useCriarCampanha: () => ({ mutateAsync: mutateCriar, isPending: false }),
}));

const useInstanciasMock = jest.fn();
jest.mock("@/hooks/use-instancias-whatsapp", () => ({
  useInstanciasWhatsapp: () => useInstanciasMock(),
}));

const lerPlanilhaMock = jest.fn();
jest.mock("@/lib/utils/csv-campanha", () => ({
  ...jest.requireActual("@/lib/utils/csv-campanha"),
  lerPlanilha: (...args: unknown[]) => lerPlanilhaMock(...args),
}));

function instanciaFake(over: Partial<InstanciaWhatsappDTO> = {}): InstanciaWhatsappDTO {
  return {
    id: "instancia-1",
    escritorioId: "esc-1",
    nome: "Atendimento",
    uazapiInstanceId: "uazapi-1",
    status: "connected",
    numeroConectado: "5511999998888",
    fotoPerfilUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useInstanciasMock.mockReturnValue({
    data: { instancias: [instanciaFake()] },
    isLoading: false,
    isError: false,
  });
  lerPlanilhaMock.mockResolvedValue({
    colunas: ["Nome", "numero"],
    linhas: [{ Nome: "ANA MARIA", numero: "5511999998888" }],
  });
  mutateCriar.mockResolvedValue({ campanha: { id: "campanha-1", totalDestinatarios: 1 } });
});

function botaoCriar() {
  return screen.getByRole("button", { name: /criar campanha/i });
}

async function escolherInstancia() {
  await userEvent.click(screen.getByRole("combobox", { name: /instância que vai disparar/i }));
  await userEvent.click(await screen.findByRole("option", { name: /atendimento/i }));
}

async function subirPlanilha() {
  const arquivo = new File(["Nome,numero"], "contatos.csv", { type: "text/csv" });
  await userEvent.upload(screen.getByLabelText("Arquivo CSV"), arquivo);
  await waitFor(() => expect(screen.getByText("contatos.csv")).toBeInTheDocument());
}

// Tudo numa página só: nome, conexão, mensagem, contatos e intervalo convivem sem etapas.
describe("FormularioCampanha — barra de ações", () => {
  it("mostra todos os controles da campanha de uma vez", () => {
    renderComQuery(<FormularioCampanha />);

    expect(screen.getByLabelText("Nome da campanha")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /instância que vai disparar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /escrever mensagem/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fazer upload de contatos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /intervalo entre mensagens/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quando enviar/i })).toBeInTheDocument();
    expect(botaoCriar()).toBeInTheDocument();
  });

  it("mostra as seções de mensagem e contatos na mesma tela", () => {
    renderComQuery(<FormularioCampanha />);

    expect(screen.getByRole("heading", { name: /mensagem/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /contatos/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/texto da mensagem/i)).toBeInTheDocument();
  });

  it("troca o rótulo do upload pelo total de contatos carregados", async () => {
    renderComQuery(<FormularioCampanha />);

    await subirPlanilha();

    expect(screen.getByRole("button", { name: /1 contato\(s\)/i })).toBeInTheDocument();
  });
});

describe("FormularioCampanha — gate do botão criar", () => {
  it("começa desabilitado e explica o que falta", () => {
    renderComQuery(<FormularioCampanha />);

    expect(botaoCriar()).toBeDisabled();
    expect(screen.getByText(/dê um nome à campanha/i)).toBeInTheDocument();
  });

  it("avança a explicação conforme o formulário é preenchido", async () => {
    renderComQuery(<FormularioCampanha />);

    await userEvent.type(screen.getByLabelText("Nome da campanha"), "Retomada");

    expect(screen.getByText(/escolha a conexão/i)).toBeInTheDocument();
    expect(botaoCriar()).toBeDisabled();
  });

  it("cobra a coluna da variável antes de deixar criar", async () => {
    renderComQuery(<FormularioCampanha />);

    await userEvent.type(screen.getByLabelText("Nome da campanha"), "Retomada");
    await escolherInstancia();
    // fireEvent.change e não userEvent.type: o userEvent trata "{{" como escape de chave
    // literal, e a mensagem sairia como "Olá {apelido}" — sem variável nenhuma.
    fireEvent.change(screen.getByLabelText(/texto da mensagem/i), {
      target: { value: "Olá {{apelido}}" },
    });

    expect(screen.getByText(/escolha a coluna de cada variável/i)).toBeInTheDocument();
    expect(botaoCriar()).toBeDisabled();
  });
});

describe("FormularioCampanha — criação", () => {
  async function preencherTudo() {
    await userEvent.type(screen.getByLabelText("Nome da campanha"), "Retomada");
    await escolherInstancia();
    fireEvent.change(screen.getByLabelText(/texto da mensagem/i), {
      target: { value: "Olá {{nome}}, tudo bem?" },
    });
    await subirPlanilha();
  }

  it("habilita o botão quando tudo está preenchido", async () => {
    renderComQuery(<FormularioCampanha />);

    await preencherTudo();

    await waitFor(() => expect(botaoCriar()).toBeEnabled());
    expect(screen.queryByText(/^Para criar:/)).not.toBeInTheDocument();
  });

  it("envia as linhas cruas do CSV e o mapeamento sugerido", async () => {
    renderComQuery(<FormularioCampanha />);

    await preencherTudo();
    await userEvent.click(botaoCriar());

    await waitFor(() =>
      expect(mutateCriar).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: "Retomada",
          instanciaId: "instancia-1",
          mensagemTemplate: "Olá {{nome}}, tudo bem?",
          colunaNumero: "numero",
          mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: [] } },
          delayMin: 3,
          delayMax: 6,
          arquivoCsvNome: "contatos.csv",
          linhas: [{ Nome: "ANA MARIA", numero: "5511999998888" }],
        })
      )
    );
  });

  it("não manda agendamento quando o envio é imediato", async () => {
    renderComQuery(<FormularioCampanha />);

    await preencherTudo();
    await userEvent.click(botaoCriar());

    await waitFor(() => expect(mutateCriar).toHaveBeenCalled());
    expect(mutateCriar.mock.calls[0][0]).not.toHaveProperty("agendadaPara");
  });

  it("leva para o detalhe da campanha criada", async () => {
    renderComQuery(<FormularioCampanha />);

    await preencherTudo();
    await userEvent.click(botaoCriar());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/campanhas/campanha-1"));
  });
});
