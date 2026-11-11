import { getPool, sql } from '../../config/database';

// Editar uma venda apaga e gera de novo as parcelas do comprador (gerarParcelas), e cada
// parcela nova ganha outro ID. As baixas (da Cobrança e do extrato), o histórico e os itens
// de fechamento apontam para o ID — sem isto, o pagamento registrado sumiria na edição.
// Antes de apagar, guarda os IDs antigos com o número da parcela; depois de gerar, aponta
// cada registro para a parcela nova de mesmo número (ORDXXX), ou da mesma posição.

const TABELAS: [tabela: string, filtro: string][] = [
  ['COBR_BAIXAS', ''],
  ['COBR_HISTORICO', ''],
  ['COBR_FECHAMENTO_ITENS', ''],
  ['CONC_BAIXAS', " AND TIPO_ALVO = 'PARCELA'"],
];

export interface Fotografia { idMov: number; idCli: number; idMovLote: number; antigas: { ID: number; ORDXXX: string }[]; tabelas: string[] }

async function tabelasExistentes(): Promise<string[]> {
  const pool = await getPool();
  const r = await pool.request().query(`SELECT name FROM sys.tables WHERE name IN (${TABELAS.map(t => `'${t[0]}'`).join(',')})`);
  return r.recordset.map((x: any) => x.name);
}

async function parcelas(idMov: number, idCli: number, idMovLote: number) {
  const pool = await getPool();
  const r = await pool.request().input('m', sql.Int, idMov).input('c', sql.Int, idCli).input('l', sql.Int, idMovLote)
    .query(`SELECT ID, LTRIM(RTRIM(ORDXXX)) AS ORDXXX FROM MOVIMENTO_PARCELAMENTO
            WHERE IDMOV = @m AND IDCLI = @c AND IDMOVLOTE = @l ORDER BY DATVEN, ID`);
  return r.recordset as { ID: number; ORDXXX: string }[];
}

/** Guarda as parcelas atuais, só quando alguma tem registro ligado (senão devolve null e nada é feito). */
export async function fotografarParcelas(idMov: number, idCli: number, idMovLote: number): Promise<Fotografia | null> {
  const tabelas = await tabelasExistentes();
  if (!tabelas.length) return null;
  const antigas = await parcelas(idMov, idCli, idMovLote);
  if (!antigas.length) return null;
  const pool = await getPool();
  const req = pool.request();
  const ids = antigas.map((p, i) => { req.input(`p${i}`, sql.Int, p.ID); return `@p${i}`; }).join(',');
  const usados = TABELAS.filter(([t]) => tabelas.includes(t))
    .map(([t, f]) => `SELECT TOP 1 1 AS X FROM ${t} WHERE ID_PARCELA IN (${ids})${f}`).join(' UNION ALL ');
  const r = await req.query(usados);
  return r.recordset.length ? { idMov, idCli, idMovLote, antigas, tabelas } : null;
}

export async function remapearParcelas(foto: Fotografia | null): Promise<void> {
  if (!foto) return;
  const novas = await parcelas(foto.idMov, foto.idCli, foto.idMovLote);
  const livres = [...novas];
  const pares: [number, number][] = [];
  const semPar: { ID: number; ORDXXX: string }[] = [];
  for (const a of foto.antigas) {
    const i = livres.findIndex(n => n.ORDXXX === a.ORDXXX);
    if (i >= 0) { pares.push([a.ID, livres[i].ID]); livres.splice(i, 1); } else semPar.push(a);
  }
  semPar.forEach((a, i) => { if (livres[i]) pares.push([a.ID, livres[i].ID]); });
  if (!pares.length) return;
  const pool = await getPool();
  for (const [t, f] of TABELAS.filter(([t]) => foto.tabelas.includes(t))) {
    for (const [de, para] of pares) {
      await pool.request().input('de', sql.Int, de).input('para', sql.Int, para)
        .query(`UPDATE ${t} SET ID_PARCELA = @para WHERE ID_PARCELA = @de${f}`);
    }
  }
}

/** Excluir venda ou comprador com recebimento já registrado na Cobrança apagaria o histórico do vendedor. */
export async function exigirSemBaixasDeCobranca(f: { idMov: number; idCli?: number; idMovLote?: number }): Promise<void> {
  const pool = await getPool();
  const existe = (await pool.request().query(`SELECT OBJECT_ID('COBR_BAIXAS') AS X`)).recordset[0].X;
  if (!existe) return;
  const req = pool.request().input('m', sql.Int, f.idMov);
  let cond = 'P.IDMOV = @m';
  if (f.idCli != null) { req.input('c', sql.Int, f.idCli); cond += ' AND P.IDCLI = @c'; }
  if (f.idMovLote != null) { req.input('l', sql.Int, f.idMovLote); cond += ' AND P.IDMOVLOTE = @l'; }
  const r = await req.query(`
    SELECT COUNT(*) AS N FROM COBR_BAIXAS B JOIN MOVIMENTO_PARCELAMENTO P ON P.ID = B.ID_PARCELA
    WHERE B.DESFEITA = 'N' AND B.ORIGEM = 'MANUAL' AND ${cond}`);
  if (r.recordset[0].N > 0) {
    throw new Error('Esta venda tem parcelas com recebimento registrado na Intermediação de Cobrança. Desfaça as baixas na Cobrança antes de excluir.');
  }
}
