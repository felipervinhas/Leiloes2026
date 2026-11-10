import crypto from 'crypto';
import { getPool, sql } from '../../config/database';
import { credenciais, lerConfig } from './configService';
import { enviarTexto, marcarComoLida } from './metaApi';
import { chaveDeWaId, normalizarCelular } from './telefone';

/**
 * Webhook da Meta: status das mensagens (enviada → entregue → lida / falhou) e
 * mensagens recebidas dos clientes. Cada empresa cadastra no app da Meta a URL
 * com o próprio banco: https://<api>/api/<banco>/whatsapp/webhook
 */

/** Confere a assinatura X-Hub-Signature-256 (HMAC SHA-256 do corpo bruto com o App Secret). */
export function assinaturaValida(rawBody: Buffer | undefined, assinatura: string | undefined, appSecret: string): boolean {
  if (!appSecret) return true; // sem App Secret configurado não há como conferir
  if (!rawBody || !assinatura?.startsWith('sha256=')) return false;
  const esperado = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const recebido = assinatura.slice(7);
  return esperado.length === recebido.length &&
    crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(recebido));
}

const ORDEM: Record<string, number> = { ENVIADO: 1, ENTREGUE: 2, LIDO: 3 };

const PALAVRAS_SAIR = ['SAIR', 'PARAR', 'STOP', 'CANCELAR', 'DESCADASTRAR', 'REMOVER', 'NAO QUERO', 'NAO QUERO MAIS',
  'PARAR PROMOCOES', 'BLOQUEAR'];
const PALAVRAS_VOLTAR = ['VOLTAR', 'RETORNAR', 'QUERO RECEBER'];

const normalizarTexto = (s: string) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();

export async function processarWebhook(corpo: any): Promise<void> {
  for (const entry of corpo?.entry || []) {
    for (const change of entry?.changes || []) {
      if (change?.field !== 'messages') continue;
      const v = change.value || {};
      for (const s of v.statuses || []) await processarStatus(s);
      const nomes = new Map<string, string>((v.contacts || []).map((c: any) => [c.wa_id, c.profile?.name]));
      for (const m of v.messages || []) await processarMensagem(m, nomes.get(m.from) || null);
    }
  }
}

async function processarStatus(s: any) {
  const pool = await getPool();
  const quando = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();
  if (s.status === 'failed') {
    const e = s.errors?.[0] || {};
    const msg = [e.title, e.error_data?.details].filter(Boolean).join(' — ') || 'Falha na entrega';
    await pool.request().input('w', sql.VarChar(100), s.id).input('cod', sql.Int, Number(e.code) || null)
      .input('erro', sql.NVarChar(500), msg.slice(0, 500)).query(`
        UPDATE WPP_ENVIOS SET STATUS = 'FALHOU', ERRO_CODIGO = @cod, ERRO = @erro, ATUALIZADO_EM = GETUTCDATE()
        WHERE WAMID = @w`);
    return;
  }
  const novo = s.status === 'delivered' ? 'ENTREGUE' : s.status === 'read' ? 'LIDO' : s.status === 'sent' ? 'ENVIADO' : null;
  if (!novo) return;
  const coluna = novo === 'ENTREGUE' ? 'ENTREGUE_EM' : novo === 'LIDO' ? 'LIDO_EM' : 'ENVIADO_EM';
  // Os eventos podem chegar fora de ordem: nunca rebaixa "lido" para "entregue".
  const menores = Object.entries(ORDEM).filter(([, n]) => n < ORDEM[novo]).map(([k]) => `'${k}'`);
  await pool.request().input('w', sql.VarChar(100), s.id).input('q', sql.DateTime, quando).query(`
    UPDATE WPP_ENVIOS SET
      STATUS = CASE WHEN STATUS IN ('PROCESSANDO'${menores.length ? ',' + menores.join(',') : ''}) THEN '${novo}' ELSE STATUS END,
      ${coluna} = ISNULL(${coluna}, @q),
      ${novo === 'LIDO' ? 'ENTREGUE_EM = ISNULL(ENTREGUE_EM, @q),' : ''}
      ATUALIZADO_EM = GETUTCDATE()
    WHERE WAMID = @w`);
}

function textoDaMensagem(m: any): { tipo: string; texto: string } {
  switch (m.type) {
    case 'text': return { tipo: 'text', texto: m.text?.body || '' };
    case 'button': return { tipo: 'button', texto: m.button?.text || m.button?.payload || '' };
    case 'interactive': return {
      tipo: 'interactive',
      texto: m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '',
    };
    case 'reaction': return { tipo: 'reaction', texto: m.reaction?.emoji || '' };
    case 'image': case 'video': case 'audio': case 'document': case 'sticker':
      return { tipo: m.type, texto: m[m.type]?.caption || `[${m.type}]` };
    case 'location': return { tipo: 'location', texto: `[localização] ${m.location?.latitude},${m.location?.longitude}` };
    default: return { tipo: m.type || 'outro', texto: `[${m.type || 'mensagem'}]` };
  }
}

async function processarMensagem(m: any, nomePerfil: string | null) {
  const pool = await getPool();
  const chave = chaveDeWaId(m.from);
  // A Meta manda o wa_id muitas vezes sem o nono dígito; guardamos e respondemos no formato completo
  const numero = normalizarCelular(m.from)?.numero || String(m.from);
  const { tipo, texto } = textoDaMensagem(m);

  // Mensagem repetida (a Meta reenvia o webhook se não recebeu 200 a tempo)
  const dup = await pool.request().input('w', sql.VarChar(100), m.id)
    .query(`SELECT TOP 1 1 AS X FROM WPP_MENSAGENS WHERE WAMID = @w`);
  if (dup.recordset.length) return;

  const cli = await pool.request().input('c', sql.VarChar(20), chave).query(`
    SELECT TOP 1 ID_CLIENTE, NOME FROM WPP_ENVIOS WHERE CHAVE = @c AND ID_CLIENTE IS NOT NULL ORDER BY ID DESC`);
  const idCliente = cli.recordset[0]?.ID_CLIENTE ?? null;
  const nome = cli.recordset[0]?.NOME || nomePerfil;

  await pool.request()
    .input('w', sql.VarChar(100), m.id).input('c', sql.VarChar(20), chave).input('t', sql.VarChar(20), numero)
    .input('np', sql.NVarChar(150), (nomePerfil || '').slice(0, 150) || null).input('cli', sql.Int, idCliente)
    .input('tipo', sql.VarChar(20), tipo).input('txt', sql.NVarChar(sql.MAX), texto)
    .input('q', sql.DateTime, m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date())
    .query(`
      INSERT INTO WPP_MENSAGENS (DIRECAO, WAMID, CHAVE, TELEFONE, NOME_PERFIL, ID_CLIENTE, TIPO, TEXTO, DATA_HORA)
      VALUES ('E', @w, @c, @t, @np, @cli, @tipo, @txt, @q)`);

  const t = normalizarTexto(texto);
  const cfg = await lerConfig();
  if (PALAVRAS_SAIR.includes(t) || t.startsWith('PARAR PROMO')) {
    await pool.request().input('c', sql.VarChar(20), chave).input('t', sql.VarChar(20), numero)
      .input('cli', sql.Int, idCliente).input('n', sql.NVarChar(150), (nome || '').slice(0, 150) || null)
      .input('mot', sql.NVarChar(300), `Respondeu "${texto}"`.slice(0, 300)).query(`
        IF NOT EXISTS (SELECT 1 FROM WPP_OPTOUT WHERE CHAVE = @c)
          INSERT INTO WPP_OPTOUT (CHAVE, TELEFONE, ID_CLIENTE, NOME, ORIGEM, MOTIVO) VALUES (@c, @t, @cli, @n, 'CLIENTE', @mot)`);
    await responderAutomatico(cfg, numero, chave, cfg?.msgOptout || '');
  } else if (PALAVRAS_VOLTAR.includes(t)) {
    const r = await pool.request().input('c', sql.VarChar(20), chave)
      .query(`DELETE FROM WPP_OPTOUT WHERE CHAVE = @c; SELECT @@ROWCOUNT AS N;`);
    if (r.recordset[0]?.N) {
      await responderAutomatico(cfg, numero, chave, 'Combinado! Você voltou a receber nossas mensagens por aqui.');
    }
  }
  if (cfg?.token && cfg.phoneNumberId) await marcarComoLida(credenciais(cfg), m.id);
}

async function responderAutomatico(cfg: any, para: string, chave: string, texto: string) {
  if (!texto || !cfg?.token || !cfg?.phoneNumberId) return;
  try {
    const r = await enviarTexto(credenciais(cfg), para, texto);
    const pool = await getPool();
    await pool.request().input('w', sql.VarChar(100), r.wamid || null).input('c', sql.VarChar(20), chave)
      .input('t', sql.VarChar(20), para).input('txt', sql.NVarChar(sql.MAX), texto).query(`
        INSERT INTO WPP_MENSAGENS (DIRECAO, WAMID, CHAVE, TELEFONE, TIPO, TEXTO, LIDA, USUARIO)
        VALUES ('S', @w, @c, @t, 'text', @txt, 'S', 'Automático')`);
  } catch (e: any) {
    console.error('[WhatsApp] resposta automática falhou:', e?.message || e);
  }
}
