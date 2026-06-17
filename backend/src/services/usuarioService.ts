import { getPool, sql } from '../config/database';

export interface UsuarioSistema {
  id: number;
  nomexx: string;
  emailx?: string;
  cpfxxx?: string;
  ativox?: string;
  blocli?: string;
  acessoApp?: string;
  senhax?: string;
}

function mapRow(c: any): UsuarioSistema {
  return {
    id: c.ID, nomexx: c.NOMEXX, emailx: c.EMAILX, cpfxxx: c.CPFXXX,
    ativox: c.ATIVOX, blocli: c.BLOCLI, acessoApp: c.ACESSO_APP,
  };
}

export async function listarUsuarios(busca?: string): Promise<UsuarioSistema[]> {
  const pool = await getPool();
  const req = pool.request();
  let where = `WHERE ADM = 'S'`;
  if (busca) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    where += ` AND (NOMEXX LIKE @busca OR EMAILX LIKE @busca)`;
  }
  const r = await req.query(`SELECT ID, NOMEXX, EMAILX, CPFXXX, ATIVOX, BLOCLI, ACESSO_APP FROM Clientes ${where} ORDER BY NOMEXX`);
  return r.recordset.map(mapRow);
}

export async function buscarUsuarioPorId(id: number): Promise<UsuarioSistema | null> {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id)
    .query(`SELECT ID, NOMEXX, EMAILX, CPFXXX, ATIVOX, BLOCLI, ACESSO_APP FROM Clientes WHERE ID=@id AND ADM='S'`);
  if (!r.recordset.length) return null;
  return mapRow(r.recordset[0]);
}

export async function criarUsuario(dados: UsuarioSistema): Promise<number> {
  const pool = await getPool();
  const r = await pool.request()
    .input('nomexx',    sql.VarChar, dados.nomexx)
    .input('emailx',    sql.VarChar, dados.emailx   || null)
    .input('cpfxxx',    sql.VarChar, dados.cpfxxx   || null)
    .input('ativox',    sql.Char,    dados.ativox   || 'S')
    .input('blocli',    sql.VarChar, dados.blocli   || 'Não')
    .input('acessoApp', sql.VarChar, dados.acessoApp|| null)
    .input('senhax',    sql.VarChar, dados.senhax   || '')
    .query(`INSERT INTO Clientes (NOMEXX,EMAILX,CPFXXX,ATIVOX,BLOCLI,ACESSO_APP,SENHAX,ADM)
      OUTPUT INSERTED.ID
      VALUES (@nomexx,@emailx,@cpfxxx,@ativox,@blocli,@acessoApp,@senhax,'S')`);
  return r.recordset[0].ID;
}

export async function atualizarUsuario(id: number, dados: UsuarioSistema): Promise<void> {
  const pool = await getPool();
  const req = pool.request()
    .input('id',        sql.Int,     id)
    .input('nomexx',    sql.VarChar, dados.nomexx)
    .input('emailx',    sql.VarChar, dados.emailx   || null)
    .input('cpfxxx',    sql.VarChar, dados.cpfxxx   || null)
    .input('ativox',    sql.Char,    dados.ativox   || 'S')
    .input('blocli',    sql.VarChar, dados.blocli   || 'Não')
    .input('acessoApp', sql.VarChar, dados.acessoApp|| null);
  let query = `UPDATE Clientes SET NOMEXX=@nomexx,EMAILX=@emailx,CPFXXX=@cpfxxx,ATIVOX=@ativox,BLOCLI=@blocli,ACESSO_APP=@acessoApp`;
  if (dados.senhax) {
    req.input('senhax', sql.VarChar, dados.senhax);
    query += `,SENHAX=@senhax`;
  }
  query += ` WHERE ID=@id`;
  await req.query(query);
}

export async function deletarUsuario(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id)
    .query(`UPDATE Clientes SET ADM='N' WHERE ID=@id`);
}

export async function listarControlesUsuario(id: number): Promise<string[]> {
  const pool = await getPool();
  const r = await pool.request()
    .input('id', sql.Int, id)
    .query(`SELECT CONTROLE FROM Clientes_Perfil WHERE ID_CLIENTES = @id AND CONTROLE IS NOT NULL AND CONTROLE <> '' ORDER BY CONTROLE`);
  return r.recordset.map((row: any) => row.CONTROLE as string);
}

export async function salvarControlesUsuario(id: number, controles: string[]): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .query(`DELETE FROM Clientes_Perfil WHERE ID_CLIENTES = @id AND CONTROLE IS NOT NULL AND CONTROLE <> ''`);
  for (const controle of controles) {
    await pool.request()
      .input('id', sql.Int, id)
      .input('controle', sql.VarChar, controle)
      .query(`INSERT INTO Clientes_Perfil (ID_CLIENTES, CONTROLE) VALUES (@id, @controle)`);
  }
}
