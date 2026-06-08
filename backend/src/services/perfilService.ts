import { getPool, sql } from '../config/database';
import { Perfil } from '../models/perfil';

export async function listarPerfis(): Promise<Perfil[]> {
  const pool = await getPool();
  const r = await pool.request().query(`SELECT ID, PERFIL, INSERIR, ALTERAR, DELETAR FROM Perfil ORDER BY PERFIL`);
  return r.recordset.map(c => ({ id: c.ID, perfil: c.PERFIL, inserir: c.INSERIR, alterar: c.ALTERAR, deletar: c.DELETAR }));
}

export async function buscarPerfilPorId(id: number): Promise<Perfil | null> {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`SELECT ID, PERFIL, INSERIR, ALTERAR, DELETAR FROM Perfil WHERE ID=@id`);
  if (!r.recordset.length) return null;
  const c = r.recordset[0];
  return { id: c.ID, perfil: c.PERFIL, inserir: c.INSERIR, alterar: c.ALTERAR, deletar: c.DELETAR };
}

export async function criarPerfil(dados: Omit<Perfil, 'id'>): Promise<number> {
  const pool = await getPool();
  const r = await pool.request()
    .input('perfil', sql.VarChar, dados.perfil)
    .input('inserir', sql.Char, dados.inserir || 'N')
    .input('alterar', sql.Char, dados.alterar || 'N')
    .input('deletar', sql.Char, dados.deletar || 'N')
    .query(`INSERT INTO Perfil (PERFIL, INSERIR, ALTERAR, DELETAR) OUTPUT INSERTED.ID VALUES (@perfil, @inserir, @alterar, @deletar)`);
  return r.recordset[0].ID;
}

export async function atualizarPerfil(id: number, dados: Omit<Perfil, 'id'>): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('perfil', sql.VarChar, dados.perfil)
    .input('inserir', sql.Char, dados.inserir || 'N')
    .input('alterar', sql.Char, dados.alterar || 'N')
    .input('deletar', sql.Char, dados.deletar || 'N')
    .query(`UPDATE Perfil SET PERFIL=@perfil, INSERIR=@inserir, ALTERAR=@alterar, DELETAR=@deletar WHERE ID=@id`);
}

export async function deletarPerfil(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM Perfil WHERE ID=@id`);
}
