/**
 * RP/SBB são os documentos de registro para EQUINOS (Registro Provisório / SBB).
 * Para as demais espécies (Bovinos, Ovinos etc.) os mesmos campos (rpxxx/sbbxxx)
 * são reaproveitados, mas com os rótulos que o cliente usa nesses casos:
 * Tatuagem (rpxxx) e Registro (sbbxxx).
 */
export function isEquino(especies?: string | null): boolean {
  // Cadastro de raças tem variações: EQUINOS, EQUINO, Equina, Eqüina
  const e = (especies || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return e.startsWith('EQUIN');
}

export function isBovino(especies?: string | null): boolean {
  // BOVINOS, BOVINO, Bovina
  const e = (especies || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return e.startsWith('BOVIN');
}

export function isOvino(especies?: string | null): boolean {
  // OVINOS, ovinos, OVINA
  const e = (especies || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return e.startsWith('OVIN');
}

export function labelRP(especies?: string | null): string {
  return isEquino(especies) ? 'RP' : 'Tatuagem';
}

export function labelSBB(especies?: string | null): string {
  return isEquino(especies) ? 'SBB' : 'Registro';
}

/**
 * Ordena lotes na mesma sequência configurada na tela de Ordem de Entrada:
 * lotes com "ordem" preenchida vêm primeiro (numericamente), depois os sem
 * ordem (por número do lote). Mesma regra de OrdemEntrada.tsx.
 */
export function ordenarPorEntrada<T extends { id: number; lotexx: string; ordem?: string | null }>(lotes: T[]): T[] {
  return [...lotes].sort((a, b) => {
    const oa = a.ordem || '';
    const ob = b.ordem || '';
    if (oa && !ob) return -1;
    if (!oa && ob) return 1;
    if (!oa && !ob) return a.lotexx.localeCompare(b.lotexx);
    const na = parseInt(oa) || 0;
    const nb = parseInt(ob) || 0;
    return na !== nb ? na - nb : a.lotexx.localeCompare(b.lotexx);
  });
}

/**
 * Categoria do lote (LOTES.CATEGO, uma letra). Os códigos são os do Delphi e do site da
 * Macedo: M Macho, F Fêmea, C Castrado, S Cobertura. Não existe "Neutro" — os poucos
 * lotes com outra letra (E, B, N...) mostram a própria letra.
 */
export const CATEGORIAS_LOTE: Record<string, string> = { M: 'Macho', F: 'Fêmea', C: 'Castrado', S: 'Cobertura' };

export function nomeCategoria(c?: string | null): string {
  if (!c) return '';
  return CATEGORIAS_LOTE[c.trim().toUpperCase()] || c;
}
