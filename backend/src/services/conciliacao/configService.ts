import { getPool, sql } from '../../config/database';
import { garantirTabelasConciliacao } from './schema';
import { ConciliacaoError } from './acessoService';
import { GRUPOS_PADRAO } from './devidoService';

// Configurações da conciliação de cada empresa: quantos grupos de cada condição de
// pagamento passam pela leiloeira, regras de "não é venda" e pagadores conhecidos.

/** Condições de pagamento com os grupos (PARC01..06), o saldo e quantas vendas dos últimos 12 meses usam cada uma. */
export async function listarCondicoes() {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT CP.ID, CP.DESFIN, CP.QTDPAR, CP.SALPAR,
           TRY_CAST(CP.PARC01 AS INT) P1, TRY_CAST(CP.PARC02 AS INT) P2, TRY_CAST(CP.PARC03 AS INT) P3,
           TRY_CAST(CP.PARC04 AS INT) P4, TRY_CAST(CP.PARC05 AS INT) P5, TRY_CAST(CP.PARC06 AS INT) P6,
           G.GRUPOS_LEILOEIRA,
           (SELECT COUNT(*) FROM MOVIMENTO_COMPRADOR MC JOIN MOVIMENTO M ON M.ID = MC.IDMOV
             WHERE MC.IDCONDPAGTO = CP.ID AND M.DATLAN >= DATEADD(MONTH, -12, GETDATE())) AS USO
    FROM CONDICAOPAGTOS CP
    LEFT JOIN CONC_CONDICAO_GRUPOS G ON G.ID_CONDPAGTO = CP.ID
    ORDER BY USO DESC, CP.DESFIN`);
  return r.recordset.map((c: any) => ({
    id: c.ID, descricao: (c.DESFIN || '').trim(), qtdParcelas: Number(c.QTDPAR) || null, saldo: Number(c.SALPAR) || 0,
    grupos: [c.P1, c.P2, c.P3, c.P4, c.P5, c.P6].map((v: any) => Number(v) || 0),
    gruposLeiloeira: c.GRUPOS_LEILOEIRA ?? null, padrao: GRUPOS_PADRAO, usoUltimos12Meses: c.USO,
  }));
}

/** Grava quantos grupos passam pela leiloeira; null volta ao padrão. */
export async function salvarGruposCondicao(idCondicao: number, grupos: number | null) {
  await garantirTabelasConciliacao();
  if (grupos != null && (!Number.isInteger(grupos) || grupos < 1 || grupos > 6))
    throw new ConciliacaoError(400, 'Informe de 1 a 6 grupos');
  const pool = await getPool();
  const req = pool.request().input('c', sql.Int, idCondicao).input('g', sql.Int, grupos);
  if (grupos == null) await req.query(`DELETE FROM CONC_CONDICAO_GRUPOS WHERE ID_CONDPAGTO = @c`);
  else await req.query(`
    IF EXISTS (SELECT 1 FROM CONC_CONDICAO_GRUPOS WHERE ID_CONDPAGTO = @c)
      UPDATE CONC_CONDICAO_GRUPOS SET GRUPOS_LEILOEIRA = @g WHERE ID_CONDPAGTO = @c
    ELSE INSERT INTO CONC_CONDICAO_GRUPOS (ID_CONDPAGTO, GRUPOS_LEILOEIRA) VALUES (@c, @g)`);
}

export async function listarRegrasNaoVenda() {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT I.ID, I.DOC, I.PADRAO_MEMO, I.CATEGORIA, I.DATA,
      (SELECT TOP 1 NOME_CONTRAPARTE FROM CONC_LANCAMENTOS L WHERE I.DOC IS NOT NULL AND L.DOC_CONTRAPARTE = I.DOC) AS NOME,
      (SELECT COUNT(*) FROM CONC_LANCAMENTOS L WHERE L.SITUACAO = 'NAO_VENDA' AND
         ((I.DOC IS NOT NULL AND L.DOC_CONTRAPARTE = I.DOC) OR (I.PADRAO_MEMO IS NOT NULL AND L.MEMO LIKE '%' + I.PADRAO_MEMO + '%'))) AS QTD
    FROM CONC_IGNORAR I ORDER BY I.DATA DESC`);
  return r.recordset.map((x: any) => ({
    id: x.ID, doc: x.DOC, padraoMemo: x.PADRAO_MEMO, nome: x.NOME, categoria: x.CATEGORIA, data: x.DATA, lancamentos: x.QTD,
  }));
}

/** Exclui a regra. Os lançamentos já marcados continuam como estão (o usuário desfaz um a um, se quiser). */
export async function excluirRegraNaoVenda(id: number) {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM CONC_IGNORAR WHERE ID = @id`);
}

export async function listarPagadores() {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT P.ID, P.DOC, P.NOME, P.ID_CLIENTE, C.NOMEXX AS CLIENTE, P.DATA
    FROM CONC_PAGADORES P LEFT JOIN Clientes C ON C.ID = P.ID_CLIENTE ORDER BY P.DATA DESC`);
  return r.recordset.map((x: any) => ({ id: x.ID, doc: x.DOC, nome: x.NOME, idCliente: x.ID_CLIENTE, cliente: x.CLIENTE, data: x.DATA }));
}

/** Exclui o vínculo. Lançamentos já conciliados não mudam; os próximos desse CPF/CNPJ não vão mais para esse cliente. */
export async function excluirPagador(id: number) {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM CONC_PAGADORES WHERE ID = @id`);
}
