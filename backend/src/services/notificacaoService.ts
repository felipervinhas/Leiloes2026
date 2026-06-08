import { getPool, sql } from '../config/database';
import axios from 'axios';

export async function listarNotificacoes(busca?: string) {
  const pool = await getPool();
  const req = pool.request();
  let where = '1=1';
  if (busca) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    where += ' AND (TITULO LIKE @busca OR MENSAGEM LIKE @busca)';
  }
  const r = await req.query(`SELECT ID, TITULO, MENSAGEM, LINK, PARA_QUEM, RESPOSTA FROM NOTIFICACOES WHERE ${where} ORDER BY ID DESC`);
  return r.recordset.map((row: any) => ({
    id: row.ID, titulo: row.TITULO, mensagem: row.MENSAGEM,
    link: row.LINK, paraQuem: row.PARA_QUEM, resposta: row.RESPOSTA,
  }));
}

export async function criarNotificacao(dados: any) {
  const pool = await getPool();
  const r = await pool.request()
    .input('titulo',   sql.VarChar, dados.titulo   || '')
    .input('mensagem', sql.VarChar, dados.mensagem || '')
    .input('link',     sql.VarChar, dados.link     || null)
    .input('paraQuem', sql.VarChar, dados.paraQuem || 'Todos')
    .query(`INSERT INTO NOTIFICACOES (TITULO, MENSAGEM, LINK, PARA_QUEM) OUTPUT INSERTED.ID VALUES (@titulo, @mensagem, @link, @paraQuem)`);
  return r.recordset[0].ID;
}

export async function deletarNotificacao(id: number) {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM NOTIFICACOES WHERE ID=@id`);
}

export async function enviarPush(titulo: string, mensagem: string, idCliente?: number): Promise<{ enviados: number; erros: number }> {
  const pool = await getPool();
  const req = pool.request();
  let query = `SELECT Token FROM Clientes_Token WHERE Token IS NOT NULL AND Token <> ''`;
  if (idCliente) {
    req.input('idCliente', sql.Int, idCliente);
    query += ' AND ID_CLIENTES = @idCliente';
  }
  const r = await req.query(query);
  const tokens: string[] = r.recordset.map((row: any) => row.Token).filter(Boolean);

  if (tokens.length === 0) return { enviados: 0, erros: 0 };

  const messages = tokens.map(to => ({ to, title: titulo, body: mensagem, sound: 'default' }));

  try {
    const resp = await axios.post('https://exp.host/--/api/v2/push/send', messages, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
    const data = resp.data?.data ?? [];
    const erros = Array.isArray(data) ? data.filter((d: any) => d.status === 'error').length : 0;
    return { enviados: tokens.length - erros, erros };
  } catch {
    return { enviados: 0, erros: tokens.length };
  }
}
