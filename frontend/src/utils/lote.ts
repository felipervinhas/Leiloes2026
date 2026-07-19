/**
 * RP/SBB são os documentos de registro para EQUINOS (Registro Provisório / SBB).
 * Para as demais espécies (Bovinos, Ovinos etc.) os mesmos campos (rpxxx/sbbxxx)
 * são reaproveitados, mas com os rótulos que o cliente usa nesses casos:
 * Tatuagem (rpxxx) e Registro (sbbxxx).
 */
export function isEquino(especies?: string | null): boolean {
  return (especies || '').toUpperCase().startsWith('EQUINO');
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
