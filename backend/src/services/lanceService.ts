import { getPool, sql } from '../config/database';

export async function listarLances(idLeilao?: number, idLote?: number) {
  const pool = await getPool();
  const req = pool.request();
  let where = '1=1';
  if (idLeilao) { req.input('idLeilao', sql.Int, idLeilao); where += ' AND LEI.ID = @idLeilao'; }
  if (idLote)   { req.input('idLote',   sql.Int, idLote);   where += ' AND LL.IDLOTE = @idLote'; }

  const r = await req.query(`
    SELECT
      LL.ID, LL.IDLOTE, LL.IDCLIENTE, LL.VALOR, LL.DATA,
      LL.IP, LL.OrigemLance,
      L.LOTEXX, L.DESLOT,
      LEI.LEILAO,
      C.NOMEXX, C.CELU_1, C.CELU_2
    FROM LOTES_LANCES LL
    LEFT JOIN LOTES L   ON L.ID = LL.IDLOTE
    LEFT JOIN LEILOES LEI ON LEI.ID = L.IDLEILAO
    LEFT JOIN CLIENTES C  ON C.ID = LL.IDCLIENTE
    WHERE ${where}
    ORDER BY LL.IDLOTE, LL.VALOR DESC, LL.DATA DESC
  `);

  return r.recordset.map((row: any) => ({
    id: row.ID,
    idLote: row.IDLOTE,
    idCliente: row.IDCLIENTE,
    valor: row.VALOR,
    data: row.DATA,
    ip: row.IP,
    origemLance: row.OrigemLance,
    lotexx: row.LOTEXX,
    deslot: row.DESLOT,
    leilao: row.LEILAO,
    nomeCliente: row.NOMEXX,
    celu1: row.CELU_1,
    celu2: row.CELU_2,
  }));
}

export async function resumoLances(idLeilao: number) {
  const pool = await getPool();
  const r = await pool.request()
    .input('idLeilao', sql.Int, idLeilao)
    .query(`
      SELECT
        L.ID as idLote, L.LOTEXX, L.DESLOT,
        COUNT(LL.ID) as qtdLances,
        MAX(LL.VALOR) as maiorLance,
        MIN(LL.VALOR) as menorLance
      FROM LOTES L
      LEFT JOIN LOTES_LANCES LL ON LL.IDLOTE = L.ID
      WHERE L.IDLEILAO = @idLeilao
      GROUP BY L.ID, L.LOTEXX, L.DESLOT
      ORDER BY TRY_CAST(L.LOTEXX AS INT), L.LOTEXX
    `);
  return r.recordset.map((row: any) => ({
    idLote: row.idLote,
    lotexx: row.LOTEXX,
    deslot: row.DESLOT,
    qtdLances: row.qtdLances,
    maiorLance: row.maiorLance,
    menorLance: row.menorLance,
  }));
}
