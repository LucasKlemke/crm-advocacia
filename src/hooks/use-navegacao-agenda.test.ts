import { renderHook } from "@testing-library/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useNavegacaoAgenda } from "@/hooks/use-navegacao-agenda";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));

const replace = jest.fn();

function montar(query = "") {
  (useRouter as jest.Mock).mockReturnValue({ replace });
  (usePathname as jest.Mock).mockReturnValue("/agenda");
  (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(query));
  return renderHook(() => useNavegacaoAgenda());
}

// Extrai o ?visao=&data= da última chamada de router.replace.
function ultimaUrl(): URLSearchParams {
  const url = replace.mock.calls.at(-1)?.[0] as string;
  return new URLSearchParams(url.split("?")[1]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useNavegacaoAgenda", () => {
  it("assume visão de mês e hoje quando a URL não diz nada", () => {
    const { result } = montar();

    expect(result.current.visao).toBe("mes");
    expect(result.current.dataFoco.toDateString()).toBe(new Date().toDateString());
  });

  it("lê visão e data da URL", () => {
    const { result } = montar("visao=semana&data=2026-09-10");

    expect(result.current.visao).toBe("semana");
    expect(result.current.dataFoco.getFullYear()).toBe(2026);
    expect(result.current.dataFoco.getMonth()).toBe(8);
    // Interpretada em hora local: new Date("2026-09-10") cairia no dia 9 a oeste de Greenwich.
    expect(result.current.dataFoco.getDate()).toBe(10);
  });

  it("ignora visão inválida na URL e cai em mês", () => {
    expect(montar("visao=trimestre").result.current.visao).toBe("mes");
  });

  it("ignora data malformada e cai em hoje", () => {
    const { result } = montar("data=10/09/2026");
    expect(result.current.dataFoco.toDateString()).toBe(new Date().toDateString());
  });

  it("avança e volta o período conforme a visão", () => {
    const { result } = montar("visao=mes&data=2026-09-10");

    result.current.proximo();
    expect(ultimaUrl().get("data")).toBe("2026-10-10");

    result.current.anterior();
    expect(ultimaUrl().get("data")).toBe("2026-08-10");
  });

  it("troca a visão mantendo a data de foco", () => {
    const { result } = montar("visao=mes&data=2026-09-10");

    result.current.trocarVisao("dia");

    expect(ultimaUrl().get("visao")).toBe("dia");
    expect(ultimaUrl().get("data")).toBe("2026-09-10");
  });

  it("irPara leva a um dia específico, podendo trocar a visão junto", () => {
    const { result } = montar("visao=mes&data=2026-09-10");

    result.current.irPara(new Date(2026, 8, 22), "dia");

    expect(ultimaUrl().get("visao")).toBe("dia");
    expect(ultimaUrl().get("data")).toBe("2026-09-22");
  });

  it("hoje volta para a data atual", () => {
    const { result } = montar("visao=mes&data=2020-01-01");

    result.current.hoje();

    const hoje = new Date();
    const esperado = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    expect(ultimaUrl().get("data")).toBe(esperado);
  });

  it("preserva outros parâmetros já presentes na URL", () => {
    const { result } = montar("visao=mes&data=2026-09-10&destaque=abc");

    result.current.proximo();

    expect(ultimaUrl().get("destaque")).toBe("abc");
  });

  it("usa replace para não encher o histórico do navegador", () => {
    const { result } = montar("visao=mes&data=2026-09-10");

    result.current.proximo();

    expect(replace).toHaveBeenCalledWith(expect.stringContaining("/agenda?"), { scroll: false });
  });

  it("expõe o período e o rótulo derivados da visão", () => {
    const { result } = montar("visao=dia&data=2026-09-10");

    expect(result.current.periodo.inicio.getDate()).toBe(10);
    expect(result.current.rotulo).toContain("10");
  });
});
