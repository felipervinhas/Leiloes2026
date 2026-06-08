import { getPool, sql } from '../config/database';
import { Cidade } from '../models/cidade';

export async function listarCidades(busca?: string): Promise<Cidade[]> {
  const pool = await getPool();
  const req = pool.request();
  let where = '';
  if (busca) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    where = `WHERE CIDADE LIKE @busca OR ESTADO LIKE @busca`;
  }
  const r = await req.query(`SELECT ID, CIDADE, ESTADO, PAIS FROM Cidades ${where} ORDER BY ESTADO, CIDADE`);
  return r.recordset.map(c => ({ id: c.ID, cidade: c.CIDADE, estado: c.ESTADO, pais: c.PAIS }));
}

export async function buscarCidadePorId(id: number): Promise<Cidade | null> {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`SELECT ID, CIDADE, ESTADO, PAIS FROM Cidades WHERE ID = @id`);
  if (!r.recordset.length) return null;
  const c = r.recordset[0];
  return { id: c.ID, cidade: c.CIDADE, estado: c.ESTADO, pais: c.PAIS };
}

export async function criarCidade(dados: Omit<Cidade, 'id'>): Promise<number> {
  const pool = await getPool();
  const r = await pool.request()
    .input('cidade', sql.VarChar, dados.cidade)
    .input('estado', sql.VarChar, dados.estado)
    .input('pais', sql.VarChar, dados.pais || null)
    .query(`INSERT INTO Cidades (CIDADE, ESTADO, PAIS) OUTPUT INSERTED.ID VALUES (@cidade, @estado, @pais)`);
  return r.recordset[0].ID;
}

export async function atualizarCidade(id: number, dados: Omit<Cidade, 'id'>): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('cidade', sql.VarChar, dados.cidade)
    .input('estado', sql.VarChar, dados.estado)
    .input('pais', sql.VarChar, dados.pais || null)
    .query(`UPDATE Cidades SET CIDADE=@cidade, ESTADO=@estado, PAIS=@pais WHERE ID=@id`);
}

export async function deletarCidade(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM Cidades WHERE ID=@id`);
}
