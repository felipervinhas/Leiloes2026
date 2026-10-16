// Leitor de extrato OFX — aceita a 1.x (SGML, tags sem fechamento, a que o
// Sicredi gera) e a 2.x (XML). Só extrai o que a conciliação usa: conta,
// período, saldo final e os lançamentos com o CPF/CNPJ da contraparte.

export interface LancamentoOfx {
  fitid: string;
  data: string;            // 'YYYY-MM-DD'
  valor: number;           // positivo = crédito, negativo = débito
  sentido: 'C' | 'D';
  memo: string;
  doc: string | null;      // CPF (11) ou CNPJ (14) só com dígitos
  nome: string | null;
}

export interface ExtratoOfx {
  bancoId: string | null;  // BANKID (ex.: 748 = Sicredi)
  contaId: string | null;  // ACCTID
  dtInicio: string | null;
  dtFim: string | null;
  saldoFinal: number | null;
  lancamentos: LancamentoOfx[];
}

/** O cabeçalho da 1.x diz o charset (CHARSET:1252); sem decodificar assim, os acentos dos nomes quebram. */
export function decodificarOfx(buf: Buffer): string {
  const cabecalho = buf.subarray(0, 600).toString('latin1');
  const xmlEncoding = cabecalho.match(/encoding="([^"]+)"/i)?.[1]?.toLowerCase();
  const charset = cabecalho.match(/CHARSET:\s*(\S+)/i)?.[1];
  if (xmlEncoding === 'utf-8' || (charset && /utf-?8/i.test(charset))) return buf.toString('utf8');
  return new TextDecoder('windows-1252').decode(buf);
}

// Lê o valor de uma tag nas duas versões: <TAG>valor (1.x) ou <TAG>valor</TAG> (2.x)
function tag(bloco: string, nome: string): string | null {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i'));
  const v = m?.[1]?.trim();
  return v ? v : null;
}

// 20260923000000[-3:GMT] → 2026-09-23 (a data contábil do banco; a hora não importa)
function dataOfx(v: string | null): string | null {
  if (!v || !/^\d{8}/.test(v)) return null;
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

function valorOfx(v: string | null): number {
  if (!v) return 0;
  // alguns bancos mandam vírgula decimal
  const n = Number(v.includes(',') && !v.includes('.') ? v.replace(',', '.') : v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string, peso: number) => {
    let s = 0;
    for (const c of base) s += Number(c) * peso--;
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

export function cnpjValido(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = [...base].reduce((a, c, i) => a + Number(c) * pesos[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

/**
 * Contraparte do lançamento a partir do histórico. No Sicredi o padrão é
 * "TIPO-SUBTIPO  <CPF/CNPJ> <NOME>" (ex.: "RECEBIMENTO PIX-PIX_CRED  01172860017 JOELSON ...").
 * Genérico: o primeiro bloco isolado de 14 ou 11 dígitos com dígito verificador
 * válido é o documento, e o texto que vem depois dele é o nome.
 */
export function extrairContraparte(memo: string): { doc: string | null; nome: string | null } {
  const re = /(?:^|[\s\-])(\d{14}|\d{11})(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(memo))) {
    const d = m[1];
    if ((d.length === 11 && cpfValido(d)) || (d.length === 14 && cnpjValido(d))) {
      const resto = memo.slice(m.index + m[0].length).trim().replace(/\s{2,}/g, ' ');
      return { doc: d, nome: resto || null };
    }
  }
  return { doc: null, nome: null };
}

export function lerOfx(buf: Buffer): ExtratoOfx {
  const txt = decodificarOfx(buf);
  if (!/<OFX>/i.test(txt)) throw new Error('Arquivo não é um extrato OFX');

  const lancamentos: LancamentoOfx[] = [];
  const blocos = txt.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) || [];
  for (const b of blocos) {
    const valor = valorOfx(tag(b, 'TRNAMT'));
    const data = dataOfx(tag(b, 'DTPOSTED'));
    const fitid = tag(b, 'FITID');
    if (!data || !fitid || valor === 0) continue;
    const memo = (tag(b, 'MEMO') || tag(b, 'NAME') || '').replace(/\s+$/, '');
    const { doc, nome } = extrairContraparte(memo);
    lancamentos.push({
      fitid, data, valor,
      sentido: valor > 0 ? 'C' : 'D',
      memo: memo.slice(0, 255),
      doc,
      nome: nome ? nome.slice(0, 120) : null,
    });
  }

  const saldo = tag(txt.match(/<LEDGERBAL>[\s\S]*?(<\/LEDGERBAL>|<AVAILBAL>|$)/i)?.[0] || '', 'BALAMT');
  return {
    bancoId: tag(txt, 'BANKID'),
    contaId: tag(txt, 'ACCTID'),
    dtInicio: dataOfx(tag(txt, 'DTSTART')),
    dtFim: dataOfx(tag(txt, 'DTEND')),
    saldoFinal: saldo != null ? valorOfx(saldo) : null,
    lancamentos,
  };
}
