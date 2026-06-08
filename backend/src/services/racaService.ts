import { getPool, sql } from '../config/database';
import { Raca } from '../models/raca';

export async function listarRacas(busca?: string): Promise<Raca[]> {
  const pool = await getPool();
  const req = pool.request();
  let where = '';
  if (busca) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    where = `WHERE DESCRICAO LIKE @busca OR ESPECIES LIKE @busca`;
  }
  const r = await req.query(`SELECT ID, DESCRICAO, ESPECIES, RACA FROM Racas ${where} ORDER BY ESPECIES, DESCRICAO`);
  return r.recordset.map(c => ({ id: c.ID, descricao: c.DESCRICAO, especies: c.ESPECIES, raca: c.RACA }));
}

export async function buscarRacaPorId(id: number): Promise<Raca | null> {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`SELECT ID, DESCRICAO, ESPECIES, RACA FROM Racas WHERE ID=@id`);
  if (!r.recordset.length) return null;
  const c = r.recordset[0];
  return { id: c.ID, descricao: c.DESCRICAO, especies: c.ESPECIES, raca: c.RACA };
}

export async function criarRaca(dados: Omit<Raca, 'id'>): Promise<number> {
  const pool = await getPool();
  const r = await pool.request()
    .input('descricao', sql.VarChar, dados.descricao)
    .input('especies', sql.VarChar, dados.especies || null)
    .input('raca', sql.VarChar, dados.raca || null)
    .query(`INSERT INTO Racas (DESCRICAO, ESPECIES, RACA) OUTPUT INSERTED.ID VALUES (@descricao, @especies, @raca)`);
  return r.recordset[0].ID;
}

export async function atualizarRaca(id: number, dados: Omit<Raca, 'id'>): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('descricao', sql.VarChar, dados.descricao)
    .input('especies', sql.VarChar, dados.especies || null)
    .input('raca', sql.VarChar, dados.raca || null)
    .query(`UPDATE Racas SET DESCRICAO=@descricao, ESPECIES=@especies, RACA=@raca WHERE ID=@id`);
}

export async function deletarRaca(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM Racas WHERE ID=@id`);
}
