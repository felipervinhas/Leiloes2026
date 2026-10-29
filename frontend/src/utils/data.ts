import dayjs, { Dayjs } from 'dayjs';

/** Ancora uma data-only (coluna DATE do banco, sem hora relevante) no dia
 * certo, ignorando o fuso do navegador. Datas DATE-only vêm do backend
 * serializadas como meia-noite UTC (ex.: "2026-08-18T00:00:00.000Z");
 * formatar isso sem tratar o fuso converte pro horário local e recua um
 * dia (chamado #58). Usar só a parte "YYYY-MM-DD" evita esse round-trip.
 * Funciona tanto com ISO completo quanto já cortado ("2026-08-18"). */
export function dataUTC(v: string | Date | null | undefined): Dayjs | null {
  if (!v) return null;
  const iso = v instanceof Date ? v.toISOString() : v;
  return dayjs(iso.slice(0, 10));
}

export function fmtDataUTC(v: string | Date | null | undefined, fallback = '—'): string {
  const d = dataUTC(v);
  return d ? d.format('DD/MM/YYYY') : fallback;
}

/**
 * Encerramento do pré-leilão (Leiloes.HORA_FECHAMENTO_PRE, texto). O site e os apps
 * leem no formato do Delphi, "DD/MM/AAAA HH:mm"; gravar só "19:00" quebrava a contagem
 * regressiva do site. Valor antigo só com a hora é completado com a data do leilão.
 */
export function encerramentoParaDayjs(valor: string | null | undefined, datlei?: string | Date | null): Dayjs | null {
  const v = (valor || '').trim();
  const completo = v.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (completo) {
    const [, d, m, a, h, mi] = completo.map(Number);
    return dayjs(new Date(a, m - 1, d, h, mi));
  }
  const soHora = v.match(/^(\d{1,2}):(\d{2})$/);
  const dia = dataUTC(datlei ?? null);
  if (soHora && dia) return dia.hour(Number(soHora[1])).minute(Number(soHora[2]));
  return null;
}

export function encerramentoParaTexto(d: Dayjs | null | undefined): string | null {
  return d ? d.format('DD/MM/YYYY HH:mm') : null;
}
