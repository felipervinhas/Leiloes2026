/**
 * Celulares do cadastro vêm em formatos variados: "(55)9972-7368", "51 997893232",
 * "47996624916" — muitos ainda sem o nono dígito (cadastro antigo).
 *
 * - `numero`: o que mandamos para a Meta — 55 + DDD + 9 dígitos.
 * - `chave`:  55 + DDD + últimos 8 dígitos. A Meta devolve o wa_id SEM o nono dígito
 *             para muitos números (ex.: 5553981166340 → 555381166340), então é por
 *             esta chave que casamos respostas, status e descadastros com o envio.
 */
export interface TelefoneNormalizado { numero: string; chave: string; }

export function normalizarCelular(bruto: string | null | undefined): TelefoneNormalizado | null {
  let d = String(bruto || '').replace(/\D/g, '');
  if (!d) return null;
  d = d.replace(/^0+/, '');
  // 12–13 dígitos: país (55) ou código de operadora (0XX, já sem o 0) na frente do DDD
  if (d.length === 12 || d.length === 13) d = d.slice(2);
  // Aqui d = DDD + número (10 ou 11 dígitos)
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = d.slice(0, 2);
  if (Number(ddd) < 11) return null;
  let local = d.slice(2);
  if (local.length === 8) {
    // Sem o nono dígito: só celular (começa com 6–9) ganha o 9; fixo não recebe WhatsApp aqui
    if (!/^[6-9]/.test(local)) return null;
    local = '9' + local;
  }
  if (!/^9/.test(local)) return null;
  return { numero: `55${ddd}${local}`, chave: `55${ddd}${local.slice(-8)}` };
}

/** Chave a partir do wa_id que a Meta manda no webhook (com ou sem o nono dígito). */
export function chaveDeWaId(waId: string): string {
  const d = String(waId || '').replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    return `55${d.slice(2, 4)}${d.slice(-8)}`;
  }
  return d; // número estrangeiro: usa como veio
}

/** Formata para exibição: +55 (53) 98116-6340 */
export function formatarCelular(numero: string): string {
  const d = String(numero || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12 && d.startsWith('55')) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return d;
}
