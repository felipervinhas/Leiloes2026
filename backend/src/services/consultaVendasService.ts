import { getPool, sql } from '../config/database';

export interface FiltrosConsulta {
  idLeilao?: number;
  idLote?: number;
  idVendedor?: number;
  idComprador?: number;
  idRacas?: number[];
  defesa?: 'S' | 'N'; // S=vendido, N=não vendido
}

const BASE_SQL = `
  SELECT
    V.ID,
    V.CODNOT,
    V.IDLEILAO,
    L.LEILAO,
    V.DATLAN,
    LO.LOTEXX,
    LO.DESLOT,
    LO.RPXXX,
    LO.SBBXXX,
    ISNULL(LO.PESOXX, 0) AS PESOXX,
    LO.CODVEN,
    R.ID   AS IDCATEGORIA,
    R.DESCRICAO,
    R.ESPECIES,
    R.RACA,
    VEN.NOMEXX  AS NOME_VENDEDOR,
    VEN.CPFXXX  AS CPF_VENDEDOR,
    VEN.ENDERE  AS ENDERE_VENDEDOR,
    VEN.BAIRRO  AS BAIRRO_VENDEDOR,
    VEN.CEPXXX  AS CEP_VENDEDOR,
    VEN.CELU_1  AS CELULAR_VENDEDOR,
    VEN.TELRES  AS TELRES_VENDEDOR,
    CIDVEN.CIDADE AS CIDADE_VENDEDOR,
    CIDVEN.ESTADO AS ESTADO_VENDEDOR,
    V.IDCLI,
    COM.NOMEXX  AS NOME_COMPRADOR,
    COM.CPFXXX  AS CPF_COMPRADOR,
    COM.ENDERE  AS ENDERE_COMPRADOR,
    COM.BAIRRO  AS BAIRRO_COMPRADOR,
    COM.CEPXXX  AS CEP_COMPRADOR,
    COM.CELU_1  AS CELULAR_COMPRADOR,
    CIDCOM.CIDADE AS CIDADE_COMPRADOR,
    CIDCOM.ESTADO AS ESTADO_COMPRADOR,
    CP.INSCRICAO,
    CP.NOME_PROPRIEDADE,
    CP.LOCALIDADE,
    CP.CIDADE    AS CIDADE_PROPRIEDADE,
    CP.ESTADO    AS ESTADO_PROPRIEDADE,
    PG.DESFIN,
    (V.QTDXXX * (V.PERCEN / 100))   AS QTDXXX,
    CASE WHEN V.QTDXXX > 0 THEN (V.VALORORIGINAL / V.QTDXXX) ELSE 0 END AS VALOR_UNIDADE,
    (SELECT TOP 1 VLRPAR  FROM MOVIMENTO_PARCELAMENTO WHERE IDMOV = V.ID AND IDCLI = COM.ID AND PRIPAR = 'S') AS PARCELAINICIAL,
    (SELECT TOP 1 FORMAT(DATVEN,'dd/MM/yyyy') FROM MOVIMENTO_PARCELAMENTO WHERE IDMOV = V.ID AND IDCLI = COM.ID AND PRIPAR = 'S') AS PRIMEIRO_VENCIMENTO_DATA,
    (SELECT TOP 1 VLRPAR  FROM MOVIMENTO_PARCELAMENTO WHERE IDMOV = V.ID AND IDCLI = COM.ID AND PRIPAR = 'S') AS PRIMEIRO_VENCIMENTO_VALOR,
    V.VALORORIGINAL  AS VALORPAGAR,
    V.VALORCOMISSAO,
    V.VALORDESCONTO,
    (V.VALORPAGAR - V.VALORDESCONTO) AS VALOR_LIQUIDO,
    V.VALORCOMISSAOVENDEDOR,
    V.COMISSAOVENDEDOR,
    V.DEFESA
  FROM VWVendas V
  LEFT JOIN Leiloes L              ON L.ID  = V.IDLEILAO
  LEFT JOIN Lotes LO               ON LO.ID = V.IDLOTE
  LEFT JOIN Racas R                ON R.ID  = LO.RACAXX
  LEFT JOIN Clientes VEN           ON VEN.ID = LO.CODVEN
  LEFT JOIN CondicaoPagtos PG      ON PG.ID  = V.IDCONDPAGTO
  LEFT JOIN Clientes COM           ON COM.ID = V.IDCLI
  LEFT JOIN Clientes_Propriedades CP ON CP.ID = V.ID_PROPRIEDADE
  LEFT JOIN Cidades CIDVEN         ON CIDVEN.ID = VEN.CIDADE
  LEFT JOIN Cidades CIDCOM         ON CIDCOM.ID = COM.CIDADE
  WHERE V.ID > 0 AND V.VALORPAGAR >= 0
`;

export async function consultarVendas(filtros: FiltrosConsulta) {
  const pool = await getPool();
  const req  = pool.request();
  const conds: string[] = [];

  if (filtros.idLeilao)   { req.input('idLeilao',   sql.Int, filtros.idLeilao);   conds.push('V.IDLEILAO = @idLeilao'); }
  if (filtros.idLote)     { req.input('idLote',     sql.Int, filtros.idLote);     conds.push('V.IDLOTE = @idLote'); }
  if (filtros.idVendedor) { req.input('idVendedor', sql.Int,     filtros.idVendedor);              conds.push('LO.CODVEN = @idVendedor'); }
  // V.IDCLI em VWVendas é VARCHAR — passamos como string para evitar incompatibilidade de tipo
  if (filtros.idComprador){ req.input('idComprador', sql.VarChar, String(filtros.idComprador)); conds.push('V.IDCLI = @idComprador'); }
  if (filtros.defesa)     { req.input('defesa',     sql.Char, filtros.defesa);    conds.push("V.DEFESA = @defesa"); }
  if (filtros.idRacas && filtros.idRacas.length > 0) {
    const placeholders = filtros.idRacas.map((id, i) => {
      req.input(`raca${i}`, sql.Int, id);
      return `@raca${i}`;
    });
    conds.push(`R.ID IN (${placeholders.join(',')})`);
  }

  const where = conds.length ? ' AND ' + conds.join(' AND ') : '';
  const sql_text = BASE_SQL + where + ' ORDER BY TRY_CAST(LO.LOTEXX AS INT), LO.LOTEXX';
  const r = await req.query(sql_text);

  return r.recordset.map((row: any) => ({
    id:                    row.ID,
    codnot:                row.CODNOT,
    idLeilao:              row.IDLEILAO,
    leilao:                row.LEILAO,
    datlan:                row.DATLAN,
    lotexx:                row.LOTEXX,
    deslot:                row.DESLOT,
    rpxxx:                 row.RPXXX,
    sbbxxx:                row.SBBXXX,
    pesoxx:                row.PESOXX,
    idCategoria:           row.IDCATEGORIA,
    descricaoRaca:         row.DESCRICAO,
    especies:              row.ESPECIES,
    raca:                  row.RACA,
    nomeVendedor:          row.NOME_VENDEDOR,
    cpfVendedor:           row.CPF_VENDEDOR,
    endereVendedor:        row.ENDERE_VENDEDOR,
    bairroVendedor:        row.BAIRRO_VENDEDOR,
    cepVendedor:           row.CEP_VENDEDOR,
    celularVendedor:       row.CELULAR_VENDEDOR,
    telresVendedor:        row.TELRES_VENDEDOR,
    cidadeVendedor:        row.CIDADE_VENDEDOR,
    estadoVendedor:        row.ESTADO_VENDEDOR,
    idCli:                 row.IDCLI,
    nomeComprador:         row.NOME_COMPRADOR,
    cpfComprador:          row.CPF_COMPRADOR,
    endereComprador:       row.ENDERE_COMPRADOR,
    bairroComprador:       row.BAIRRO_COMPRADOR,
    cepComprador:          row.CEP_COMPRADOR,
    celularComprador:      row.CELULAR_COMPRADOR,
    cidadeComprador:       row.CIDADE_COMPRADOR,
    estadoComprador:       row.ESTADO_COMPRADOR,
    inscricao:             row.INSCRICAO,
    nomePropriedade:       row.NOME_PROPRIEDADE,
    localidade:            row.LOCALIDADE,
    cidadePropriedade:     row.CIDADE_PROPRIEDADE,
    estadoPropriedade:     row.ESTADO_PROPRIEDADE,
    desfin:                row.DESFIN,
    qtdxxx:                row.QTDXXX,
    valorUnidade:          row.VALOR_UNIDADE,
    parcelaInicial:        row.PARCELAINICIAL,
    primeiroVencimentoData: row.PRIMEIRO_VENCIMENTO_DATA,
    primeiroVencimentoValor: row.PRIMEIRO_VENCIMENTO_VALOR,
    valorPagar:            row.VALORPAGAR,
    valorComissao:         row.VALORCOMISSAO,
    valorDesconto:         row.VALORDESCONTO,
    valorLiquido:          row.VALOR_LIQUIDO,
    valorComissaoVendedor: row.VALORCOMISSAOVENDEDOR,
    comissaoVendedor:      row.COMISSAOVENDEDOR,
    defesa:                row.DEFESA,
  }));
}

export async function racasPorLeilao(idLeilao: number) {
  const pool = await getPool();
  const r = await pool.request()
    .input('idLeilao', sql.Int, idLeilao)
    .query(`
      SELECT DISTINCT R.ID, R.DESCRICAO, R.ESPECIES
      FROM LOTES LO
      LEFT JOIN RACAS R ON R.ID = LO.RACAXX
      WHERE LO.IDLEILAO = @idLeilao AND R.ID IS NOT NULL
      ORDER BY R.DESCRICAO
    `);
  return r.recordset.map((row: any) => ({ id: row.ID, descricao: row.DESCRICAO, especies: row.ESPECIES }));
}

export async function lotesPorLeilao(idLeilao: number) {
  const pool = await getPool();
  const r = await pool.request()
    .input('idLeilao', sql.Int, idLeilao)
    .query(`
      SELECT ID, LOTEXX, DESLOT, CODVEN
      FROM LOTES
      WHERE IDLEILAO = @idLeilao
      ORDER BY TRY_CAST(LOTEXX AS INT), LOTEXX
    `);
  return r.recordset.map((row: any) => ({ id: row.ID, lotexx: row.LOTEXX, deslot: row.DESLOT, codven: row.CODVEN }));
}
