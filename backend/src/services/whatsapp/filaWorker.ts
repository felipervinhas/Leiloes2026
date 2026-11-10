import { getPool, sql, BANCOS_PERMITIDOS } from '../../config/database';
import { bancoStorage } from '../../config/bancoContext';
import { whatsappInstalado } from './schema';
import { credenciais, lerConfig, ConfigWhatsapp } from './configService';
import { enviarTemplate, MetaError } from './metaApi';

/**
 * Fila de envio das campanhas. Roda dentro do próprio processo da API, a cada
 * INTERVALO_MS, para cada banco que tenha o módulo ligado. Todo o estado fica no
 * banco (WPP_ENVIOS), então um restart da API só retoma de onde parou.
 *
 * Ritmo: MSGS_POR_MINUTO da configuração, e nunca passa do LIMITE_DIARIO
 * (contatos distintos nas últimas 24h — é assim que a Meta conta o limite do número).
 * Quando o limite acaba, a campanha continua "Enviando" e retoma sozinha quando liberar.
 */
const INTERVALO_MS = 15_000;
const MAX_TENTATIVAS = 4;
const PARALELO = 5;

let rodando = false;
let timer: NodeJS.Timeout | null = null;

export function iniciarFilaWhatsapp() {
  if (timer) return;
  timer = setInterval(() => { void ciclo(); }, INTERVALO_MS);
  timer.unref();
  console.log('[WhatsApp] fila de envio iniciada');
}

async function ciclo() {
  if (rodando) return; // ciclo anterior ainda enviando
  rodando = true;
  try {
    for (const banco of BANCOS_PERMITIDOS) {
      await bancoStorage.run(banco, () => processarBanco()).catch(err => {
        console.error(`[WhatsApp] erro na fila (${banco}):`, err?.message || err);
      });
    }
  } finally {
    rodando = false;
  }
}

async function processarBanco() {
  if (!(await whatsappInstalado())) return;
  const pool = await getPool();

  const ativo = await pool.request().query(`SELECT TOP 1 WPP_ATIVA FROM Configuracoes`);
  if (ativo.recordset[0]?.WPP_ATIVA !== 'S') return;

  // Agendadas cujo horário chegou; envios presos em PROCESSANDO (queda no meio do envio);
  // descadastrados depois de a campanha ser criada; campanhas que terminaram.
  await pool.request().query(`
    UPDATE WPP_CAMPANHAS SET STATUS = 'ENVIANDO', INICIADA_EM = ISNULL(INICIADA_EM, GETUTCDATE())
    WHERE STATUS = 'AGENDADA' AND AGENDADA_PARA <= GETUTCDATE();

    UPDATE WPP_ENVIOS SET STATUS = 'PENDENTE', ATUALIZADO_EM = GETUTCDATE()
    WHERE STATUS = 'PROCESSANDO' AND ATUALIZADO_EM < DATEADD(MINUTE, -10, GETUTCDATE());

    UPDATE E SET STATUS = 'IGNORADO', ERRO = 'Cliente descadastrado do WhatsApp', ATUALIZADO_EM = GETUTCDATE()
    FROM WPP_ENVIOS E JOIN WPP_OPTOUT O ON O.CHAVE = E.CHAVE
    WHERE E.STATUS = 'PENDENTE';

    UPDATE C SET STATUS = 'CONCLUIDA', CONCLUIDA_EM = GETUTCDATE()
    FROM WPP_CAMPANHAS C
    WHERE C.STATUS = 'ENVIANDO'
      AND NOT EXISTS (SELECT 1 FROM WPP_ENVIOS E WHERE E.ID_CAMPANHA = C.ID AND E.STATUS IN ('PENDENTE','PROCESSANDO'));
  `);

  const temFila = await pool.request().query(`
    SELECT TOP 1 1 AS X FROM WPP_ENVIOS E JOIN WPP_CAMPANHAS C ON C.ID = E.ID_CAMPANHA
    WHERE C.STATUS = 'ENVIANDO' AND E.STATUS = 'PENDENTE'
      AND (E.PROXIMA_TENTATIVA IS NULL OR E.PROXIMA_TENTATIVA <= GETUTCDATE())`);
  if (!temFila.recordset.length) return;

  const cfg = await lerConfig();
  if (!cfg?.token || !cfg.phoneNumberId) {
    await pausarTodas('WhatsApp não configurado (token ou Phone Number ID ausente)');
    return;
  }

  const usados = await pool.request().query(`
    SELECT COUNT(DISTINCT CHAVE) AS N FROM WPP_ENVIOS
    WHERE ENVIADO_EM >= DATEADD(HOUR, -24, GETUTCDATE())`);
  const restanteDia = cfg.limiteDiario - (usados.recordset[0]?.N || 0);
  if (restanteDia <= 0) return;

  const porCiclo = Math.max(1, Math.round(cfg.msgsPorMinuto * INTERVALO_MS / 60_000));
  const lote = Math.min(porCiclo, restanteDia);

  const r = await pool.request().input('n', sql.Int, lote).query(`
    WITH fila AS (
      SELECT TOP (@n) E.*
      FROM WPP_ENVIOS E WITH (ROWLOCK, READPAST, UPDLOCK)
      WHERE E.STATUS = 'PENDENTE'
        AND (E.PROXIMA_TENTATIVA IS NULL OR E.PROXIMA_TENTATIVA <= GETUTCDATE())
        AND E.ID_CAMPANHA IN (SELECT ID FROM WPP_CAMPANHAS WHERE STATUS = 'ENVIANDO')
      ORDER BY E.ID_CAMPANHA, E.ID
    )
    UPDATE fila SET STATUS = 'PROCESSANDO', ATUALIZADO_EM = GETUTCDATE()
    OUTPUT INSERTED.ID, INSERTED.ID_CAMPANHA, INSERTED.TELEFONE, INSERTED.COMPONENTES, INSERTED.TENTATIVAS;`);
  const itens = r.recordset;
  if (!itens.length) return;

  const campanhas = await templatesDasCampanhas([...new Set(itens.map((i: any) => i.ID_CAMPANHA as number))]);

  for (let i = 0; i < itens.length; i += PARALELO) {
    const parte = itens.slice(i, i + PARALELO);
    const resultados = await Promise.all(parte.map((it: any) => enviarUm(cfg, it, campanhas.get(it.ID_CAMPANHA))));
    if (resultados.includes('AUTH')) {
      // credencial inválida: devolve o resto para a fila e para tudo até alguém corrigir
      const restantes = itens.slice(i + PARALELO).map((x: any) => x.ID);
      await devolverParaFila(restantes);
      return;
    }
  }
}

async function templatesDasCampanhas(ids: number[]) {
  const pool = await getPool();
  const r = await pool.request().input('ids', sql.VarChar(sql.MAX), ids.join(',')).query(`
    SELECT ID, TEMPLATE_NOME, TEMPLATE_IDIOMA FROM WPP_CAMPANHAS
    WHERE ID IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, ','))`);
  return new Map<number, { nome: string; idioma: string }>(
    r.recordset.map((c: any) => [c.ID, { nome: c.TEMPLATE_NOME, idioma: c.TEMPLATE_IDIOMA }]));
}

async function enviarUm(cfg: ConfigWhatsapp, it: any, tpl?: { nome: string; idioma: string }): Promise<'OK' | 'FALHA' | 'AUTH'> {
  const pool = await getPool();
  if (!tpl) return 'FALHA';
  try {
    const res = await enviarTemplate(credenciais(cfg), it.TELEFONE, {
      nome: tpl.nome, idioma: tpl.idioma, componentes: it.COMPONENTES ? JSON.parse(it.COMPONENTES) : [],
    });
    await pool.request().input('id', sql.BigInt, it.ID).input('wamid', sql.VarChar(100), res.wamid || null).query(`
      UPDATE WPP_ENVIOS SET STATUS = CASE WHEN STATUS = 'PROCESSANDO' THEN 'ENVIADO' ELSE STATUS END,
        WAMID = @wamid, ENVIADO_EM = GETUTCDATE(), TENTATIVAS = TENTATIVAS + 1, ERRO = NULL, ERRO_CODIGO = NULL,
        ATUALIZADO_EM = GETUTCDATE()
      WHERE ID = @id`);
    return 'OK';
  } catch (e: any) {
    const err = e instanceof MetaError ? e : new MetaError(String(e?.message || e), null, true, false);
    const tentativas = (it.TENTATIVAS || 0) + 1;

    if (err.autenticacao) {
      await devolverParaFila([it.ID]);
      await pausarTodas(`A Meta recusou a credencial: ${err.message}. Atualize o token em Configuração e retome a campanha.`);
      return 'AUTH';
    }
    const req = pool.request().input('id', sql.BigInt, it.ID)
      .input('cod', sql.Int, err.codigo).input('erro', sql.NVarChar(500), err.message.slice(0, 500))
      .input('tent', sql.Int, tentativas);
    if (err.transitorio && tentativas < MAX_TENTATIVAS) {
      // 1, 4, 9 minutos
      await req.input('min', sql.Int, tentativas * tentativas).query(`
        UPDATE WPP_ENVIOS SET STATUS = 'PENDENTE', TENTATIVAS = @tent, ERRO_CODIGO = @cod, ERRO = @erro,
          PROXIMA_TENTATIVA = DATEADD(MINUTE, @min, GETUTCDATE()), ATUALIZADO_EM = GETUTCDATE()
        WHERE ID = @id`);
    } else {
      await req.query(`
        UPDATE WPP_ENVIOS SET STATUS = 'FALHOU', TENTATIVAS = @tent, ERRO_CODIGO = @cod, ERRO = @erro,
          ATUALIZADO_EM = GETUTCDATE()
        WHERE ID = @id`);
    }
    return 'FALHA';
  }
}

async function devolverParaFila(ids: number[]) {
  if (!ids.length) return;
  const pool = await getPool();
  await pool.request().input('ids', sql.VarChar(sql.MAX), ids.join(',')).query(`
    UPDATE WPP_ENVIOS SET STATUS = 'PENDENTE', ATUALIZADO_EM = GETUTCDATE()
    WHERE STATUS = 'PROCESSANDO' AND ID IN (SELECT TRY_CAST(value AS BIGINT) FROM STRING_SPLIT(@ids, ','))`);
}

async function pausarTodas(motivo: string) {
  const pool = await getPool();
  await pool.request().input('m', sql.NVarChar(500), motivo.slice(0, 500)).query(`
    UPDATE WPP_CAMPANHAS SET STATUS = 'PAUSADA', ULTIMO_ERRO = @m WHERE STATUS = 'ENVIANDO'`);
}
