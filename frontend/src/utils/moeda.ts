/**
 * Formatter/parser para InputNumber em Real (R$), com vírgula como separador decimal
 * e ponto como separador de milhar. A versão anterior aplicava o agrupamento de milhar
 * direto sobre a string com ponto decimal do JS (ex. "1234.56"), resultando em dois
 * pontos ("R$ 1.234.56") em vez de "R$ 1.234,56" — e nunca convertia o "." em ",".
 */
export function formatarMoeda(v?: string | number): string {
  if (v === undefined || v === null || v === '') return '';
  const str = String(v);
  const negativo = str.startsWith('-');
  const [parteInteira, parteDecimal] = str.replace('-', '').split('.');
  const inteiraFormatada = parteInteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const corpo = parteDecimal !== undefined ? `${inteiraFormatada},${parteDecimal}` : inteiraFormatada;
  return `R$ ${negativo ? '-' : ''}${corpo}`;
}

export function parseMoeda(v?: string): string {
  if (!v) return '';
  return v.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.');
}
