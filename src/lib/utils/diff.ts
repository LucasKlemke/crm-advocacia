export type Diff<T> = {
  [K in keyof T]?: { antes: T[K]; depois: T[K] };
};

// Compara o estado atual com as mudanças pedidas e devolve só o que realmente mudou,
// no formato gravado em `log.dados` (RN20). Retorna null quando não há mudança —
// nesse caso o Service não grava log, evitando ruído na auditoria.
//
// Campo `undefined` em `mudancas` significa "não enviado" (PATCH parcial) e é ignorado;
// `null` significa "limpar o campo" e conta como mudança.
export function calcularDiff<T extends object>(
  antes: T,
  mudancas: Partial<T>,
  campos: readonly (keyof T)[]
): Diff<T> | null {
  const diff: Diff<T> = {};
  let houveMudanca = false;

  for (const campo of campos) {
    const depois = mudancas[campo];
    if (depois === undefined) continue;
    if (antes[campo] === depois) continue;
    diff[campo] = { antes: antes[campo], depois: depois as T[typeof campo] };
    houveMudanca = true;
  }

  return houveMudanca ? diff : null;
}
