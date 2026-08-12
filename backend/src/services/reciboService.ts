import { getPool, sql } from '../config/database';
import { getBanco } from '../config/bancoContext';

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
      TIPO            CHAR(1)        NOT NULL DEFAULT 'R',
      DATA_INCLUSAO   DATETIME       DEFAULT GETDATE()
    )
  `);
}

// TIPO: 'R' = Recebimento (Knorr recebe, assina o recibo — comportamento original
// do chamado #10) | 'P' = Pagamento (Knorr paga, o cliente assina recebendo).
// Coluna adicionada depois (chamado #53) — tabelas já existentes não têm TIPO.
const colunaTipoCriadaPorBanco = new Set<string>();
async function garantirColunaTipo() {
  const banco = getBanco();
  if (colunaTipoCriadaPorBanco.has(banco)) return;
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='RECIBOS_AVULSOS' AND COLUMN_NAME='TIPO')
      ALTER TABLE RECIBOS_AVULSOS ADD TIPO CHAR(1) NOT NULL DEFAULT 'R'
  `);
  colunaTipoCriadaPorBanco.add(banco);
}

export async function listarRecibos(busca?: string) {
  await ensureTable();
  await garantirColunaTipo();
  const pool = await getPool();
  const req = pool.request();
  const conds: string[] = [];
  if (busca) { req.input('busca', sql.VarChar, `%${busca}%`); conds.push('(R.PAGADOR LIKE @busca OR R.OBSERVACOES LIKE @busca)'); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const r = await req.query(`
    SELECT R.ID, R.PAGADOR, R.CODIGO_CLIENTE, R.VALOR, R.OBSERVACOES, R.DATA, R.TIPO, R.DATA_INCLUSAO,
           C.NOMEXX AS NOME_CLIENTE
    FROM RECIBOS_AVULSOS R
    LEFT JOIN CLIENTES C ON C.ID = R.CODIGO_CLIENTE
    ${where}
    ORDER BY R.DATA_INCLUSAO DESC
  `);
  return r.recordset.map((row: any) => ({
    id: row.ID, pagador: row.PAGADOR, codigoCliente: row.CODIGO_CLIENTE,
    valor: row.VALOR, observacoes: row.OBSERVACOES,
    data: row.DATA, tipo: row.TIPO || 'R', dataInclusao: row.DATA_INCLUSAO,
    nomeCliente: row.NOME_CLIENTE,
  }));
}

export async function criarRecibo(dados: any) {
  await ensureTable();
  await garantirColunaTipo();
  const pool = await getPool();
  const r = await pool.request()
    .input('pagador',        sql.VarChar, dados.pagador)
    .input('codigoCliente',  sql.Int,     dados.codigoCliente || null)
    .input('valor',          sql.Float,   dados.valor || 0)
    .input('observacoes',    sql.VarChar, dados.observacoes || null)
    .input('data',           sql.Date,    dados.data ? new Date(dados.data) : new Date())
    .input('tipo',           sql.Char,    dados.tipo === 'P' ? 'P' : 'R')
    .query(`
      INSERT INTO RECIBOS_AVULSOS (PAGADOR, CODIGO_CLIENTE, VALOR, OBSERVACOES, DATA, TIPO)
      OUTPUT INSERTED.ID
      VALUES (@pagador, @codigoCliente, @valor, @observacoes, @data, @tipo)
    `);
  return r.recordset[0].ID;
}

export async function atualizarRecibo(id: number, dados: any) {
  await garantirColunaTipo();
  const pool = await getPool();
  await pool.request()
    .input('id',             sql.Int,     id)
    .input('pagador',        sql.VarChar, dados.pagador)
    .input('codigoCliente',  sql.Int,     dados.codigoCliente || null)
    .input('valor',          sql.Float,   dados.valor || 0)
    .input('observacoes',    sql.VarChar, dados.observacoes || null)
    .input('data',           sql.Date,    dados.data ? new Date(dados.data) : new Date())
    .input('tipo',           sql.Char,    dados.tipo === 'P' ? 'P' : 'R')
    .query(`
      UPDATE RECIBOS_AVULSOS
      SET PAGADOR=@pagador, CODIGO_CLIENTE=@codigoCliente, VALOR=@valor,
          OBSERVACOES=@observacoes, DATA=@data, TIPO=@tipo
      WHERE ID=@id
    `);
}

export async function deletarRecibo(id: number) {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM RECIBOS_AVULSOS WHERE ID=@id`);
}
