import { getPool } from '../config/database';
import { getBanco } from '../config/bancoContext';

// O campo Peso do lote (Lotes.PESOXX) é preenchido de jeitos diferentes em cada leiloeira:
// a Knorr digita o PESO TOTAL do lote (11 fêmeas = 3.193 kg, vendido a R$ 18/kg), enquanto
// G2, LoteRural e Macedo digitam o peso POR CABEÇA (4 terneiras de 268 kg). A regra fica em
// Configuracoes.PESO_LOTE_TOTAL ('S' = total; vazio/'N' = por cabeça, como no Delphi).
// Ligado por nós, direto no banco: UPDATE Configuracoes SET PESO_LOTE_TOTAL = 'S'
const prontos = new Set<string>();

async function garantirColuna() {
  const banco = getBanco();
  if (prontos.has(banco)) return;
  const pool = await getPool();
  await pool.request().query(`IF COL_LENGTH('Configuracoes', 'PESO_LOTE_TOTAL') IS NULL
    ALTER TABLE Configuracoes ADD PESO_LOTE_TOTAL CHAR(1) NULL;`);
  prontos.add(banco);
}

export async function pesoLoteEhTotal(): Promise<boolean> {
  await garantirColuna();
  const pool = await getPool();
  const r = await pool.request().query(`SELECT TOP 1 PESO_LOTE_TOTAL FROM Configuracoes`);
  return r.recordset[0]?.PESO_LOTE_TOTAL === 'S';
}

/**
 * Kg da parte de um comprador no lote.
 * - total:      peso do lote × percentual da parte (lote rateado entre compradores)
 * - por cabeça: animais da parte × peso (ou só o peso, se a quantidade não foi informada)
 * `qtdParte` já é a quantidade da parte (QTDXXX × PERCEN / 100).
 */
export function kgDaParte(pesoxx: any, qtdParte: any, percen: any, total: boolean): number {
  const peso = Number(pesoxx) || 0;
  if (peso <= 0) return 0;
  if (total) {
    const p = percen == null || percen === '' ? 100 : Number(percen);
    return peso * ((Number.isFinite(p) && p > 0 ? p : 100) / 100);
  }
  const qtd = Number(qtdParte) || 0;
  return qtd > 0 ? qtd * peso : peso;
}
