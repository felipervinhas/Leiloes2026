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
