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
