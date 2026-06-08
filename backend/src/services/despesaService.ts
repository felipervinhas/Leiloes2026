import { getPool, sql } from '../config/database';

export async function listarDespesas(idLeilao?: number, busca?: string) {
  const pool = await getPool();
  const req = pool.request();
  const conds: string[] = [];
  if (idLeilao) { req.input('idLeilao', sql.Int, idLeilao); conds.push('D.CODLEI = @idLeilao'); }
  if (busca)    { req.input('busca', sql.VarChar, `%${busca}%`); conds.push('(D.OBSERVACOES LIKE @busca OR C.NOMEXX LIKE @busca)'); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const r = await req.query(`
    SELECT
      D.CODIGO, D.CODLEI, D.CODIGO_CLIENTE, D.D_C, D.VALOR,
      D.OBSERVACOES, D.DATA_INCLUSAO, D.DATA_ALTERACAO,
      L.LEILAO, C.NOMEXX as CLIENTE
    FROM DESPESAS D
    LEFT JOIN LEILOES L ON L.ID = D.CODLEI
    LEFT JOIN CLIENTES C ON C.ID = D.CODIGO_CLIENTE
    ${where}
    ORDER BY D.DATA_INCLUSAO DESC
  `);
  return r.recordset.map((row: any) => ({
    id: row.CODIGO, codLei: row.CODLEI, codigoCliente: row.CODIGO_CLIENTE,
    dc: row.D_C, valor: row.VALOR, observacoes: row.OBSERVACOES,
    dataInclusao: row.DATA_INCLUSAO, dataAlteracao: row.DATA_ALTERACAO,
    leilao: row.LEILAO, cliente: row.CLIENTE,
  }));
}

export async function criarDespesa(dados: any) {
  const pool = await getPool();
  const r = await pool.request()
    .input('codLei',         sql.Int,     dados.codLei         || null)
    .input('codigoCliente',  sql.Int,     dados.codigoCliente  || null)
    .input('dc',             sql.Char,    dados.dc             || 'S')
    .input('valor',          sql.Float,   dados.valor          || 0)
    .input('observacoes',    sql.VarChar, dados.observacoes    || null)
    .input('dataInclusao',   sql.Date,    new Date())
    .input('dataAlteracao',  sql.Date,    new Date())
    .query(`
      INSERT INTO DESPESAS (CODLEI, CODIGO_CLIENTE, D_C, VALOR, OBSERVACOES, DATA_INCLUSAO, DATA_ALTERACAO)
      OUTPUT INSERTED.CODIGO
      VALUES (@codLei, @codigoCliente, @dc, @valor, @observacoes, @dataInclusao, @dataAlteracao)
    `);
  return r.recordset[0].CODIGO;
}

export async function atualizarDespesa(id: number, dados: any) {
  const pool = await getPool();
  await pool.request()
    .input('id',             sql.Int,     id)
    .input('codLei',         sql.Int,     dados.codLei         || null)
    .input('codigoCliente',  sql.Int,     dados.codigoCliente  || null)
    .input('dc',             sql.Char,    dados.dc             || 'S')
    .input('valor',          sql.Float,   dados.valor          || 0)
    .input('observacoes',    sql.VarChar, dados.observacoes    || null)
    .input('dataAlteracao',  sql.Date,    new Date())
    .query(`
      UPDATE DESPESAS SET CODLEI=@codLei, CODIGO_CLIENTE=@codigoCliente, D_C=@dc,
        VALOR=@valor, OBSERVACOES=@observacoes, DATA_ALTERACAO=@dataAlteracao
      WHERE CODIGO=@id
    `);
}

export async function deletarDespesa(id: number) {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM DESPESAS WHERE CODIGO=@id`);
}
