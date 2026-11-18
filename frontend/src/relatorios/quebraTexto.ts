/**
 * Quebra um texto "sem espaços" (ex.: lote "66/68/69/70/71/72", tatuagens
 * "2895/2760/2552") em várias linhas para caber em colunas estreitas dos PDFs.
 *
 * O @react-pdf só quebra linha em espaço — e, pela regra Unicode, nunca entre
 * números separados por "/" ou "-". Sem isso o texto vaza por cima da coluna
 * vizinha (chamado Knorr: fatura unificada / mapa de compradores com lote
 * agrupado). Aqui a quebra é feita à mão, preferindo os separadores
 * (/ - , ; espaço) e só cortando no meio de um pedaço se ele sozinho não couber.
 *
 * `maxChars` é a quantidade aproximada de caracteres que cabem numa linha da
 * coluna (fonte Helvetica ~7pt: dígito ≈ 3,9pt).
 */
export function quebrarTexto(texto: string | null | undefined, maxChars: number): string {
  const t = (texto ?? '').trim();
  if (!t || t.length <= maxChars || maxChars < 2) return t;

  // pedaços com o separador grudado no fim: "66/", "68/", "1611-", "1601 "
  const pedacos = t.match(/[^/\-,;\s]+[/\-,;]?\s*|[/\-,;\s]+/g) || [t];
  const linhas: string[] = [];
  let atual = '';

  const empurrar = (p: string) => {
    if ((atual + p).trimEnd().length <= maxChars) {
      atual += p;
      return;
    }
    if (atual.trim()) linhas.push(atual.trim());
    atual = '';
    // pedaço maior que a linha inteira: corta seco
    while (p.trimEnd().length > maxChars) {
      linhas.push(p.slice(0, maxChars));
      p = p.slice(maxChars);
    }
    atual = p;
  };

  for (const p of pedacos) empurrar(p);
  if (atual.trim()) linhas.push(atual.trim());
  return linhas.join('\n');
}
