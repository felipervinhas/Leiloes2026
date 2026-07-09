// ─── Valor por extenso ────────────────────────────────────────────────────────

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
                  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS  = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cem', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
                  'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function bloco(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const cStr = c > 0 ? CENTENAS[c] : '';
  if (resto === 0) return cStr;
  if (resto < 20) return (cStr ? cStr + ' e ' : '') + UNIDADES[resto];
  const d = Math.floor(resto / 10);
  const u = resto % 10;
  const dStr = DEZENAS[d] + (u > 0 ? ' e ' + UNIDADES[u] : '');
  return (cStr ? cStr + ' e ' : '') + dStr;
}

function extensoInteiro(n: number): string {
  if (n === 0) return 'zero';
  const bi  = Math.floor(n / 1_000_000_000);
  const mi  = Math.floor((n % 1_000_000_000) / 1_000_000);
  const mil = Math.floor((n % 1_000_000) / 1_000);
  const res = n % 1_000;
  const p: string[] = [];
  if (bi  > 0) p.push(bloco(bi)  + (bi  === 1 ? ' bilhão'  : ' bilhões'));
  if (mi  > 0) p.push(bloco(mi)  + (mi  === 1 ? ' milhão'  : ' milhões'));
  if (mil > 0) p.push(mil === 1 ? 'mil' : bloco(mil) + ' mil');
  if (res > 0) p.push(bloco(res));
  return p.join(' e ');
}

export function valorExtenso(valor: number): string {
  if (!valor || valor <= 0) return 'zero reais';
  const reais    = Math.floor(valor);
  const centavos = Math.round((valor - reais) * 100);
  const rStr     = extensoInteiro(reais) + (reais === 1 ? ' real' : ' reais');
  if (centavos === 0) return rStr;
  return rStr + ' e ' + extensoInteiro(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
}

// ─── Utilitários gerais ─────────────────────────────────────────────────────────

export const fmtR = (v?: number | null) =>
  v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

const MESES_EXT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Backend envia datas já em "DD/MM/YYYY". new Date() não parseia esse formato.
export function parseDate(s?: string | null): Date | null {
  if (!s || s === '—') return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export const fmtData = (iso?: string | null) => {
  if (!iso || iso === '—') return '—';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso; // já formatado
  const d = parseDate(iso);
  return d ? d.toLocaleDateString('pt-BR') : '—';
};

export const fmtDataExtenso = (iso?: string | null) => {
  const d = parseDate(iso);
  if (!d) return '—';
  return `${d.getDate()} ${MESES_EXT[d.getMonth()]} ${d.getFullYear()}`;
};

export const CATEGO: Record<string, string> = { M: 'Macho', F: 'Fêmea', N: 'Neutro', C: 'Castrado' };
