// Chamadas do browser aos endpoints de sessão da API Nest (substituem signIn/signOut do
// next-auth/react). O cookie crm_sessao é httpOnly: o browser só o recebe/limpa via
// Set-Cookie, nunca o lê.

export async function entrar(email: string, senha: string): Promise<boolean> {
  const resposta = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  if (resposta.ok) return true;
  // 401 = credencial errada/usuário inativo; 400 = campo vazio. Para a tela, os dois são
  // "e-mail ou senha inválidos" — nunca revelar qual dos dois errou.
  if (resposta.status === 401 || resposta.status === 400) return false;
  throw new Error(`Falha ao entrar (HTTP ${resposta.status}).`);
}

export async function sair(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Sem rede o cookie continua no browser, mas a navegação para /login segue — o
    // usuário pode tentar de novo de lá.
  }
}
