import { getPool, sql } from '../config/database';
import { UsuarioComPerfil } from '../models/usuario';

export async function buscarUsuarioPorLogin(cpf: string, senha: string): Promise<UsuarioComPerfil | null> {
  const pool = await getPool();

  const result = await pool.request()
    .input('cpf', sql.VarChar, cpf)
    .input('senha', sql.VarChar, senha)
    .query(`
      SELECT ID, NOMEXX, EMAILX, ATIVOX, BLOCLI, ADM
      FROM Clientes
      WHERE CPFXXX = @cpf
        AND SENHAX = @senha
        AND ADM = 'S'
    `);

  if (result.recordset.length === 0) return null;

  const u = result.recordset[0];

  if (u.ATIVOX !== 'S') return null;
  if (u.BLOCLI === 'Sim') return null;

  const [perfisResult, controlesResult] = await Promise.all([
    pool.request()
      .input('idCliente', sql.Int, u.ID)
      .query(`
        SELECT p.ID, p.PERFIL, p.INSERIR, p.ALTERAR, p.DELETAR
        FROM Clientes_Perfil cp
        INNER JOIN Perfil p ON p.ID = cp.ID_PERFIL
        WHERE cp.ID_CLIENTES = @idCliente
      `),
    pool.request()
      .input('idCliente2', sql.Int, u.ID)
      .query(`SELECT CONTROLE FROM Clientes_Perfil WHERE ID_CLIENTES = @idCliente2 AND CONTROLE IS NOT NULL AND CONTROLE <> ''`),
  ]);

  return {
    id: u.ID,
    nome: u.NOMEXX,
    email: u.EMAILX,
    ativo: u.ATIVOX,
    bloqueado: u.BLOCLI,
    adm: u.ADM,
    perfis: perfisResult.recordset.map(p => ({
      id: p.ID,
      perfil: p.PERFIL,
      inserir: p.INSERIR,
      alterar: p.ALTERAR,
      deletar: p.DELETAR,
    })),
    controles: controlesResult.recordset.map((r: any) => r.CONTROLE as string),
  };
}
