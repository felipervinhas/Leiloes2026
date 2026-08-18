/** Persistência de filtros de tela por aba/banco (sessionStorage), pra sobreviver
 * ao remount que acontece quando o usuário troca de aba no MainLayout e volta. */

export function lerFiltroPersistido<T extends Record<string, any>>(banco: string, tela: string, padrao: T): T {
  try {
    const raw = sessionStorage.getItem(`filtro_${banco}_${tela}`);
    return raw ? { ...padrao, ...JSON.parse(raw) } : padrao;
  } catch {
    return padrao;
  }
}

export function salvarFiltroPersistido(banco: string, tela: string, valores: Record<string, any>): void {
  try {
    sessionStorage.setItem(`filtro_${banco}_${tela}`, JSON.stringify(valores));
  } catch {
    // sessionStorage indisponível (modo privado, quota etc.) — falha silenciosa,
    // não é crítico pro funcionamento da tela.
  }
}
