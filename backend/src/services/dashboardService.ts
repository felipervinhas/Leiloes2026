import { getPool, sql } from '../config/database';

export async function getDashboardData() {
  const pool = await getPool();

  const [rLeiloes, rCategorias, rVencimentos, rKpis] = await Promise.all([

    // Leilões do mês atual + 5 meses anteriores (garante mês atual sempre presente)
    pool.request().query(`
      SELECT
        L.ID,
        L.LEILAO                                          AS NOME,
        FORMAT(L.DATLEI, 'MM/yy')                        AS PERIODO,
        FORMAT(L.DATLEI, 'dd/MM/yyyy')                   AS DATA_LEILAO,
        ISNULL(SUM(MC.VALORORIGINAL),  0)                AS VALOR_TOTAL,
        ISNULL(SUM(MC.VALORCOMISSAO),  0)                AS COMISSAO,
        ISNULL(SUM(MC.VALORPAGAR),     0)                AS LIQUIDO,
        COUNT(DISTINCT MC.IDMOV)                         AS VENDAS,
        (SELECT COUNT(*) FROM LOTES WHERE IDLEILAO = L.ID) AS TOTAL_LOTES
      FROM LEILOES L
      LEFT JOIN MOVIMENTO           M  ON M.IDLEILAO  = L.ID
      LEFT JOIN MOVIMENTO_COMPRADOR MC ON MC.IDMOV    = M.ID
                                      AND MC.VALORORIGINAL > 0
      WHERE L.DATLEI IS NOT NULL
        AND L.DATLEI >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()) - 5, 0)
      GROUP BY L.ID, L.LEILAO, L.DATLEI
      ORDER BY L.DATLEI DESC
    `),

    // Categorias (Raças) com top compradores e vendedores
    pool.request().query(`
      SELECT
        R.ID,
        ISNULL(R.DESCRICAO, 'Outras') AS NOME,
        COUNT(DISTINCT MC.IDMOV) AS TOTAL_VENDAS,
        SUM(MC.VALORORIGINAL) AS TOTAL_VALOR
      FROM MOVIMENTO_COMPRADOR MC
      INNER JOIN MOVIMENTO_LOTE ML ON ML.IDMOV = MC.IDMOV
      INNER JOIN LOTES LO ON LO.ID = ML.IDLOTE
      LEFT JOIN RACAS R ON R.ID = LO.RACAXX
      WHERE MC.VALORORIGINAL > 0
      GROUP BY R.ID, R.DESCRICAO
      ORDER BY TOTAL_VALOR DESC
    `),

    // Próximos vencimentos (45 dias)
    pool.request().query(`
      SELECT TOP 15
        C.NOMEXX                              AS COMPRADOR,
        MP.ORDXXX,
        FORMAT(MP.DATVEN, 'dd/MM/yyyy')       AS VENCIMENTO,
        MP.DATVEN                             AS DATVEN_RAW,
        MP.VLRPAR                             AS VALOR,
        LO.LOTEXX,
        LO.DESLOT,
        L.LEILAO
      FROM MOVIMENTO_PARCELAMENTO MP
      INNER JOIN CLIENTES        C  ON C.ID  = MP.IDCLI
      INNER JOIN MOVIMENTO       M  ON M.ID  = MP.IDMOV
      INNER JOIN LEILOES         L  ON L.ID  = M.IDLEILAO
      INNER JOIN MOVIMENTO_LOTE  ML ON ML.IDMOV = M.ID
      INNER JOIN LOTES           LO ON LO.ID    = ML.IDLOTE
      WHERE MP.DATVEN BETWEEN GETDATE() AND DATEADD(DAY, 45, GETDATE())
      ORDER BY MP.DATVEN
    `),

    // KPIs gerais (all time)
    pool.request().query(`
      SELECT
        ISNULL(SUM(MC.VALORORIGINAL),  0)  AS TOTAL_GERAL,
        ISNULL(SUM(MC.VALORCOMISSAO),  0)  AS COMISSAO_GERAL,
        ISNULL(SUM(MC.VALORPAGAR),     0)  AS LIQUIDO_GERAL,
        COUNT(DISTINCT MC.IDCLI)           AS TOTAL_COMPRADORES,
        COUNT(DISTINCT MC.IDMOV)           AS TOTAL_VENDAS,
        (SELECT COUNT(*) FROM LEILOES)     AS TOTAL_LEILOES,
        (SELECT COUNT(*) FROM LOTES)       AS TOTAL_LOTES_CAD,
        (
          SELECT COUNT(*)
          FROM MOVIMENTO_PARCELAMENTO
          WHERE DATVEN BETWEEN GETDATE() AND DATEADD(DAY, 45, GETDATE())
        )                                  AS PARC_PROXIMAS,
        (
          SELECT ISNULL(SUM(VLRPAR), 0)
          FROM MOVIMENTO_PARCELAMENTO
          WHERE DATVEN BETWEEN GETDATE() AND DATEADD(DAY, 45, GETDATE())
        )                                  AS VALOR_PARC_PROXIMAS
      FROM MOVIMENTO_COMPRADOR MC
      WHERE MC.VALORORIGINAL > 0
    `),
  ]);

  // cronológico crescente para o gráfico de barras
  const leiloes = [...rLeiloes.recordset].reverse();

  // último leilão COM vendas; se nenhum no período, pega o mais recente cadastrado
  const ultimoComVendas = rLeiloes.recordset.find((r: any) => Number(r.VENDAS) > 0)
    ?? rLeiloes.recordset[0]
    ?? null;
  const ultimo = ultimoComVendas;

  const kpi = rKpis.recordset[0] ?? {};

  return {
    kpis: {
      totalGeral:        Number(kpi.TOTAL_GERAL       ?? 0),
      comissaoGeral:     Number(kpi.COMISSAO_GERAL    ?? 0),
      liquidoGeral:      Number(kpi.LIQUIDO_GERAL     ?? 0),
      totalCompradores:  Number(kpi.TOTAL_COMPRADORES ?? 0),
      totalVendas:       Number(kpi.TOTAL_VENDAS      ?? 0),
      totalLeiloes:      Number(kpi.TOTAL_LEILOES     ?? 0),
      totalLotesCad:     Number(kpi.TOTAL_LOTES_CAD   ?? 0),
      parcProximas:      Number(kpi.PARC_PROXIMAS     ?? 0),
      valorParcProximas: Number(kpi.VALOR_PARC_PROXIMAS ?? 0),
    },
    ultimoLeilao: ultimo ? {
      id:          ultimo.ID,
      nome:        ultimo.NOME,
      data:        ultimo.DATA_LEILAO,
      valorTotal:  Number(ultimo.VALOR_TOTAL),
      comissao:    Number(ultimo.COMISSAO),
      liquido:     Number(ultimo.LIQUIDO),
      vendas:      Number(ultimo.VENDAS),
      totalLotes:  Number(ultimo.TOTAL_LOTES),
    } : null,
    historico: leiloes.map((r: any) => ({
      nome:       (r.NOME as string).length > 18
                    ? (r.NOME as string).substring(0, 16) + '…'
                    : r.NOME,
      nomeCompleto: r.NOME,
      periodo:    r.PERIODO,
      data:       r.DATA_LEILAO,
      valorTotal: Number(r.VALOR_TOTAL),
      comissao:   Number(r.COMISSAO),
      liquido:    Number(r.LIQUIDO),
      vendas:     Number(r.VENDAS),
      totalLotes: Number(r.TOTAL_LOTES),
    })),
    categorias: rCategorias.recordset.map((r: any) => ({
      id:         r.ID,
      nome:       r.NOME,
      vendas:     Number(r.TOTAL_VENDAS),
      valorTotal: Number(r.TOTAL_VALOR),
    })),
    topRacas: rCategorias.recordset.slice(0, 6).map((r: any) => ({
      raca:       r.NOME,
      vendas:     Number(r.TOTAL_VENDAS),
      valorTotal: Number(r.TOTAL_VALOR),
    })),
    vencimentos: rVencimentos.recordset.map((r: any) => ({
      comprador:  r.COMPRADOR,
      ordxxx:     r.ORDXXX,
      vencimento: r.VENCIMENTO,
      valor:      Number(r.VALOR),
      lotexx:     r.LOTEXX,
      deslot:     r.DESLOT,
      leilao:     r.LEILAO,
    })),
  };
}

export async function getTopsPorCategoria(idCategoria?: number) {
  const pool = await getPool();

  const [rCompradores, rVendedores] = await Promise.all([
    // Top 5 compradores por categoria
    pool.request()
      .input('idCategoria', sql.Int, idCategoria ?? null)
      .query(`
        SELECT TOP 5
          C.ID,
          C.NOMEXX AS NOME,
          COUNT(DISTINCT MC.IDMOV) AS COMPRAS,
          SUM(MC.VALORORIGINAL) AS VALOR_TOTAL,
          SUM(MC.VALORPAGAR) AS VALOR_LIQUIDO
        FROM MOVIMENTO_COMPRADOR MC
        INNER JOIN CLIENTES C ON C.ID = MC.IDCLI
        INNER JOIN MOVIMENTO_LOTE ML ON ML.IDMOV = MC.IDMOV
        INNER JOIN LOTES LO ON LO.ID = ML.IDLOTE
        WHERE MC.VALORORIGINAL > 0
          AND (LO.RACAXX = @idCategoria OR @idCategoria IS NULL)
        GROUP BY MC.IDCLI, C.NOMEXX, C.ID
        ORDER BY VALOR_TOTAL DESC
      `),

    // Top 5 vendedores por categoria
    pool.request()
      .input('idCategoria', sql.Int, idCategoria ?? null)
      .query(`
        SELECT TOP 5
          V.ID,
          V.NOMEXX AS NOME,
          COUNT(DISTINCT M.ID) AS VENDAS,
          SUM(MC.VALORORIGINAL) AS VALOR_TOTAL,
          SUM(MC.VALORPAGAR) AS VALOR_LIQUIDO
        FROM LOTES LO
        INNER JOIN MOVIMENTO M ON M.IDLEILAO = LO.IDLEILAO
        INNER JOIN MOVIMENTO_LOTE ML ON ML.IDMOV = M.ID AND ML.IDLOTE = LO.ID
        INNER JOIN MOVIMENTO_COMPRADOR MC ON MC.IDMOV = M.ID
        INNER JOIN CLIENTES V ON V.ID = LO.CODVEN
        WHERE MC.VALORORIGINAL > 0 AND LO.CODVEN IS NOT NULL
          AND (LO.RACAXX = @idCategoria OR @idCategoria IS NULL)
        GROUP BY LO.CODVEN, V.NOMEXX, V.ID
        ORDER BY VALOR_TOTAL DESC
      `),
  ]);

  return {
    topCompradores: rCompradores.recordset.map((r: any, i: number) => ({
      pos: i + 1,
      id: r.ID,
      nome: r.NOME,
      compras: Number(r.COMPRAS),
      valorTotal: Number(r.VALOR_TOTAL),
      valorLiq: Number(r.VALOR_LIQUIDO),
    })),
    topVendedores: rVendedores.recordset.map((r: any, i: number) => ({
      pos: i + 1,
      id: r.ID,
      nome: r.NOME,
      vendas: Number(r.VENDAS),
      valorTotal: Number(r.VALOR_TOTAL),
      valorLiq: Number(r.VALOR_LIQUIDO),
    })),
  };
}
