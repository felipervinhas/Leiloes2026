import { getPool, sql } from '../config/database';

export async function listarCotacoes(busca?: string) {
  const pool = await getPool();
  const req = pool.request();
  let where = '1=1';
  if (busca) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    where += ' AND (COTACAO LIKE @busca OR TIPO LIKE @busca)';
  }
  const r = await req.query(`SELECT ID, DATA, COTACAO, VALOR, TIPO FROM COTACOES WHERE ${where} ORDER BY DATA DESC`);
  return r.recordset.map((row: any) => ({
    id: row.ID, data: row.DATA, cotacao: row.COTACAO, valor: row.VALOR, tipo: row.TIPO,
  }));
}

export async function criarCotacao(dados: any) {
  const pool = await getPool();
  const r = await pool.request()
    .input('data',    sql.DateTime, dados.data    || new Date())
    .input('cotacao', sql.VarChar,  dados.cotacao || '')
    .input('valor',   sql.Float,    dados.valor   || 0)
    .input('tipo',    sql.VarChar,  dados.tipo    || null)
    .query(`INSERT INTO COTACOES (DATA, COTACAO, VALOR, TIPO) OUTPUT INSERTED.ID VALUES (@data, @cotacao, @valor, @tipo)`);
  return r.recordset[0].ID;
}

export async function atualizarCotacao(id: number, dados: any) {
  const pool = await getPool();
  await pool.request()
    .input('id',      sql.Int,      id)
    .input('data',    sql.DateTime, dados.data    || new Date())
    .input('cotacao', sql.VarChar,  dados.cotacao || '')
    .input('valor',   sql.Float,    dados.valor   || 0)
    .input('tipo',    sql.VarChar,  dados.tipo    || null)
    .query(`UPDATE COTACOES SET DATA=@data, COTACAO=@cotacao, VALOR=@valor, TIPO=@tipo WHERE ID=@id`);
}

export async function deletarCotacao(id: number) {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM COTACOES WHERE ID=@id`);
}
