import { getPool, sql } from '../config/database';

async function ensureTable() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RECIBOS_AVULSOS' AND xtype='U')
    CREATE TABLE RECIBOS_AVULSOS (
      ID              INT IDENTITY(1,1) PRIMARY KEY,
      PAGADOR         VARCHAR(200)   NOT NULL,
      CODIGO_CLIENTE  INT            NULL,
      VALOR           FLOAT          NOT NULL,
      OBSERVACOES     VARCHAR(500)   NULL,
      DATA            DATE           NOT NULL,
      DATA_INCLUSAO   DATETIME       DEFAULT GETDATE()
    )
  `);
}

export async function listarRecibos(busca?: string) {
  await ensureTable();
  const pool = await getPool();
  const req = pool.request();
  const conds: string[] = [];
  if (busca) { req.input('busca', sql.VarChar, `%${busca}%`); conds.push('(R.PAGADOR LIKE @busca OR R.OBSERVACOES LIKE @busca)'); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const r = await req.query(`
    SELECT R.ID, R.PAGADOR, R.CODIGO_CLIENTE, R.VALOR, R.OBSERVACOES, R.DATA, R.DATA_INCLUSAO,
           C.NOMEXX AS NOME_CLIENTE
    FROM RECIBOS_AVULSOS R
    LEFT JOIN CLIENTES C ON C.ID = R.CODIGO_CLIENTE
    ${where}
    ORDER BY R.DATA_INCLUSAO DESC
  `);
  return r.recordset.map((row: any) => ({
    id: row.ID, pagador: row.PAGADOR, codigoCliente: row.CODIGO_CLIENTE,
    valor: row.VALOR, observacoes: row.OBSERVACOES,
    data: row.DATA, dataInclusao: row.DATA_INCLUSAO,
    nomeCliente: row.NOME_CLIENTE,
  }));
}

export async function criarRecibo(dados: any) {
  await ensureTable();
  const pool = await getPool();
  const r = await pool.request()
    .input('pagador',        sql.VarChar, dados.pagador)
    .input('codigoCliente',  sql.Int,     dados.codigoCliente || null)
    .input('valor',          sql.Float,   dados.valor || 0)
    .input('observacoes',    sql.VarChar, dados.observacoes || null)
    .input('data',           sql.Date,    dados.data ? new Date(dados.data) : new Date())
    .query(`
      INSERT INTO RECIBOS_AVULSOS (PAGADOR, CODIGO_CLIENTE, VALOR, OBSERVACOES, DATA)
      OUTPUT INSERTED.ID
      VALUES (@pagador, @codigoCliente, @valor, @observacoes, @data)
    `);
  return r.recordset[0].ID;
}

export async function atualizarRecibo(id: number, dados: any) {
  const pool = await getPool();
  await pool.request()
    .input('id',             sql.Int,     id)
    .input('pagador',        sql.VarChar, dados.pagador)
    .input('codigoCliente',  sql.Int,     dados.codigoCliente || null)
    .input('valor',          sql.Float,   dados.valor || 0)
    .input('observacoes',    sql.VarChar, dados.observacoes || null)
    .input('data',           sql.Date,    dados.data ? new Date(dados.data) : new Date())
    .query(`
      UPDATE RECIBOS_AVULSOS
      SET PAGADOR=@pagador, CODIGO_CLIENTE=@codigoCliente, VALOR=@valor,
          OBSERVACOES=@observacoes, DATA=@data
      WHERE ID=@id
    `);
}

export async function deletarRecibo(id: number) {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM RECIBOS_AVULSOS WHERE ID=@id`);
}
