import { getPool, sql } from '../../config/database';
import { credenciais, lerConfig, WhatsappError } from './configService';
import { enviarTexto, MetaError } from './metaApi';
import { formatarCelular, normalizarCelular } from './telefone';

/** Lista de conversas (uma linha por número), mais recentes primeiro. */
export async function listarConversas(filtro: { naoLidas?: boolean; busca?: string }) {
  const pool = await getPool();
  const req = pool.request();
  const where: string[] = [];
  if (filtro.naoLidas) where.push('X.NAO_LIDAS > 0');
  if (filtro.busca) {
    req.input('busca', sql.NVarChar, `%${filtro.busca}%`);
    where.push('(X.NOME LIKE @busca OR X.TELEFONE LIKE @busca)');
  }
  const r = await req.query(`
    SELECT TOP 300 * FROM (
      SELECT M.CHAVE,
        MAX(M.TELEFONE) AS TELEFONE,
        COALESCE(MAX(E.NOME), MAX(M.NOME_PERFIL)) AS NOME,
        MAX(M.ID_CLIENTE) AS ID_CLIENTE,
        MAX(M.DATA_HORA) AS ULTIMA,
        MAX(CASE WHEN M.DIRECAO = 'E' THEN M.DATA_HORA END) AS ULTIMA_RECEBIDA,
        SUM(CASE WHEN M.DIRECAO = 'E' AND M.LIDA = 'N' THEN 1 ELSE 0 END) AS NAO_LIDAS,
        (SELECT TOP 1 TEXTO FROM WPP_MENSAGENS U WHERE U.CHAVE = M.CHAVE ORDER BY U.DATA_HORA DESC, U.ID DESC) AS ULTIMO_TEXTO,
        CASE WHEN EXISTS (SELECT 1 FROM WPP_OPTOUT O WHERE O.CHAVE = M.CHAVE) THEN 1 ELSE 0 END AS DESCADASTRADO
      FROM WPP_MENSAGENS M
      OUTER APPLY (SELECT TOP 1 NOME FROM WPP_ENVIOS E WHERE E.CHAVE = M.CHAVE ORDER BY E.ID DESC) E
      GROUP BY M.CHAVE
    ) X
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY X.ULTIMA DESC`);
  return r.recordset.map((c: any) => ({
    chave: c.CHAVE, telefone: formatarCelular(c.TELEFONE), nome: c.NOME, idCliente: c.ID_CLIENTE,
    ultima: c.ULTIMA, ultimaRecebida: c.ULTIMA_RECEBIDA, naoLidas: c.NAO_LIDAS, ultimoTexto: c.ULTIMO_TEXTO,
    descadastrado: !!c.DESCADASTRADO,
    janelaAberta: !!c.ULTIMA_RECEBIDA && Date.now() - new Date(c.ULTIMA_RECEBIDA).getTime() < 24 * 3600_000,
  }));
}

export async function contarNaoLidas(): Promise<number> {
  const pool = await getPool();
  const r = await pool.request().query(`SELECT COUNT(*) AS N FROM WPP_MENSAGENS WHERE DIRECAO = 'E' AND LIDA = 'N'`);
  return r.recordset[0]?.N || 0;
}

export async function mensagensDaConversa(chave: string) {
  const pool = await getPool();
  const r = await pool.request().input('c', sql.VarChar(20), chave).query(`
    SELECT * FROM (
      SELECT 'M' AS ORIGEM, ID, DIRECAO, TIPO, TEXTO, DATA_HORA, USUARIO, NULL AS STATUS, NULL AS CAMPANHA
      FROM WPP_MENSAGENS WHERE CHAVE = @c
      UNION ALL
      SELECT 'C', E.ID, 'S', 'template', C.TEMPLATE_TEXTO, E.ENVIADO_EM, C.CRIADA_POR, E.STATUS, C.NOME
      FROM WPP_ENVIOS E JOIN WPP_CAMPANHAS C ON C.ID = E.ID_CAMPANHA
      WHERE E.CHAVE = @c AND E.ENVIADO_EM IS NOT NULL
    ) X ORDER BY DATA_HORA, ID`);
  await pool.request().input('c', sql.VarChar(20), chave)
    .query(`UPDATE WPP_MENSAGENS SET LIDA = 'S' WHERE CHAVE = @c AND DIRECAO = 'E' AND LIDA = 'N'`);
  return r.recordset.map((m: any) => ({
    origem: m.ORIGEM === 'C' ? 'campanha' : 'conversa', id: m.ID, direcao: m.DIRECAO, tipo: m.TIPO,
    texto: m.TEXTO, dataHora: m.DATA_HORA, usuario: m.USUARIO, status: m.STATUS, campanha: m.CAMPANHA,
  }));
}

/** Resposta em texto livre: a Meta só aceita até 24h depois da última mensagem do cliente. */
export async function responder(chave: string, texto: string, usuario?: string) {
  const msg = String(texto || '').trim();
  if (!msg) throw new WhatsappError(400, 'Digite a mensagem');
  if (msg.length > 4096) throw new WhatsappError(400, 'Mensagem muito longa (máx. 4096 caracteres)');
  const pool = await getPool();
  const r = await pool.request().input('c', sql.VarChar(20), chave).query(`
    SELECT TOP 1 TELEFONE, ID_CLIENTE, DATA_HORA FROM WPP_MENSAGENS WHERE CHAVE = @c AND DIRECAO = 'E' ORDER BY DATA_HORA DESC`);
  const ult = r.recordset[0];
  if (!ult) throw new WhatsappError(400, 'Este número ainda não mandou mensagem — só é possível enviar um template');
  if (Date.now() - new Date(ult.DATA_HORA).getTime() > 24 * 3600_000) {
    throw new WhatsappError(400, 'Passaram mais de 24h desde a última mensagem do cliente. A Meta só permite responder com um template aprovado.');
  }
  const cfg = await lerConfig();
  try {
    const res = await enviarTexto(credenciais(cfg), ult.TELEFONE, msg);
    await pool.request().input('w', sql.VarChar(100), res.wamid || null).input('c', sql.VarChar(20), chave)
      .input('t', sql.VarChar(20), ult.TELEFONE).input('cli', sql.Int, ult.ID_CLIENTE)
      .input('txt', sql.NVarChar(sql.MAX), msg).input('u', sql.VarChar(100), usuario || null).query(`
        INSERT INTO WPP_MENSAGENS (DIRECAO, WAMID, CHAVE, TELEFONE, ID_CLIENTE, TIPO, TEXTO, LIDA, USUARIO)
        VALUES ('S', @w, @c, @t, @cli, 'text', @txt, 'S', @u)`);
  } catch (e) {
    if (e instanceof MetaError) throw new WhatsappError(400, `A Meta recusou o envio: ${e.message}`);
    throw e;
  }
}

// ───────────────────────── descadastrados ─────────────────────────

export async function listarOptout(busca?: string) {
  const pool = await getPool();
  const req = pool.request();
  let where = '';
  if (busca) { req.input('b', sql.NVarChar, `%${busca}%`); where = 'WHERE NOME LIKE @b OR TELEFONE LIKE @b'; }
  const r = await req.query(`SELECT TOP 1000 * FROM WPP_OPTOUT ${where} ORDER BY DATA DESC`);
  return r.recordset.map((o: any) => ({
    chave: o.CHAVE, telefone: formatarCelular(o.TELEFONE), idCliente: o.ID_CLIENTE, nome: o.NOME,
    origem: o.ORIGEM, motivo: o.MOTIVO, data: o.DATA,
  }));
}

export async function adicionarOptout(d: { telefone: string; nome?: string; idCliente?: number; motivo?: string }, usuario?: string) {
  const tel = normalizarCelular(d.telefone);
  if (!tel) throw new WhatsappError(400, 'Celular inválido — use DDD + número');
  const pool = await getPool();
  await pool.request().input('c', sql.VarChar(20), tel.chave).input('t', sql.VarChar(20), tel.numero)
    .input('cli', sql.Int, d.idCliente || null).input('n', sql.NVarChar(150), (d.nome || '').slice(0, 150) || null)
    .input('m', sql.NVarChar(300), (d.motivo || `Incluído por ${usuario || 'usuário'}`).slice(0, 300)).query(`
      IF NOT EXISTS (SELECT 1 FROM WPP_OPTOUT WHERE CHAVE = @c)
        INSERT INTO WPP_OPTOUT (CHAVE, TELEFONE, ID_CLIENTE, NOME, ORIGEM, MOTIVO) VALUES (@c, @t, @cli, @n, 'MANUAL', @m)`);
  return tel.chave;
}

export async function removerOptout(chave: string) {
  const pool = await getPool();
  await pool.request().input('c', sql.VarChar(20), chave).query(`DELETE FROM WPP_OPTOUT WHERE CHAVE = @c`);
}
