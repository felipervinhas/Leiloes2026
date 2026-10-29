// Valor por extenso — mesma regra de frontend/src/relatorios/promissoriaUtils.ts

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
  const cStr = c > 0 ? (c === 1 ? 'cento' : CENTENAS[c]) : '';
  if (resto === 0) return c === 1 ? 'cem' : cStr;
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
