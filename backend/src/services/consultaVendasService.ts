import { getPool, sql } from '../config/database';
import { garantirColunaMovCompPisteiro, buscarParcelasPorMovLote } from './vendaService';

export interface FiltrosConsulta {
  idLeilao?: number;
  idLote?: number;
  idVendedor?: number;
  idComprador?: number;
  /** Usuário PISTEIRO gravado na venda (MOVIMENTO_COMPRADOR.ID_PISTEIRO) */
  idPisteiro?: number;
  idRacas?: number[];
  ano?: number; // ano da data do leilão
  defesa?: 'S' | 'N'; // S=vendido, N=não vendido
}

/** Filtro por ano do leilão em faixa de datas (usa índice de DATLEI, ao contrário de YEAR()). */
function condicaoAno(req: any, ano?: number): string | null {
  if (!ano) return null;
  req.input('anoIni', sql.Date, `${ano}-01-01`);
  req.input('anoFim', sql.Date, `${ano + 1}-01-01`);
  return 'L.DATLEI >= @anoIni AND L.DATLEI < @anoFim';
}

const BASE_SQL = `
  SELECT
    V.ID,
    MC.ID AS ID_MC,
    MC.IDMOVLOTE AS ID_MOVLOTE,
    V.CODNOT,
    /* MC = MOVIMENTO_COMPRADOR: VWVendas expõe V.ID = MOVIMENTO.ID (não é único por comprador
       quando o lote é rateado entre vários compradores); recuperamos aqui o ID real de
       MOVIMENTO_COMPRADOR, necessário para agrupar a Fatura Unificada corretamente. */
    V.IDLEILAO,
    L.LEILAO,
    L.DATLEI,
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
    VEN.CNPJXX  AS CNPJ_VENDEDOR,
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
    COM.CNPJXX  AS CNPJ_COMPRADOR,
    COM.ENDERE  AS ENDERE_COMPRADOR,
    COM.BAIRRO  AS BAIRRO_COMPRADOR,
    COM.CEPXXX  AS CEP_COMPRADOR,
    COM.CELU_1  AS CELULAR_COMPRADOR,
    COM.CELU_2  AS CELULAR2_COMPRADOR,
    COM.TELCOM  AS TELCOM_COMPRADOR,
    COM.TELRES  AS TELRES_COMPRADOR,
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
    /* Parcela inicial / 1º vencimento saem das parcelas buscadas depois, em
       consultarVendas — MOVIMENTO_PARCELAMENTO não tem índice em IDMOV, e 3
       subqueries correlacionadas por linha custavam ~10ms cada (varredura de
       128 mil linhas), deixando consultas de centenas de vendas em 10s+. */
    V.VALORORIGINAL  AS VALORPAGAR,
    V.VALORCOMISSAO,
    V.VALORDESCONTO,
    V.VALOR_DESCONTO_FIDELIDADE,
    V.VALORPAGAR AS VALOR_LIQUIDO,
    V.VALORCOMISSAOVENDEDOR,
    V.COMISSAOVENDEDOR,
    V.DEFESA,
    MC.ID_PISTEIRO,
    PIST.NOMEXX AS NOME_PISTEIRO
  FROM VWVendas V
  LEFT JOIN Leiloes L              ON L.ID  = V.IDLEILAO
  LEFT JOIN Lotes LO               ON LO.ID = V.IDLOTE
  LEFT JOIN Racas R                ON R.ID  = LO.RACAXX
  LEFT JOIN Clientes VEN           ON VEN.ID = LO.CODVEN
  LEFT JOIN CondicaoPagtos PG      ON PG.ID  = V.IDCONDPAGTO
  LEFT JOIN Clientes COM           ON COM.ID = V.IDCLI
  LEFT JOIN Movimento_Comprador MC ON MC.IDMOV = V.ID AND MC.IDCLI = V.IDCLI
  LEFT JOIN Clientes PIST          ON PIST.ID = MC.ID_PISTEIRO
  /* Quando a venda não teve propriedade de destino selecionada, cai pra
     propriedade cadastrada no próprio comprador (a mais antiga, se houver
     mais de uma) em vez de deixar Localidade/Propriedade/Inscrição em branco. */
  LEFT JOIN (SELECT ID_CLIENTE, MIN(ID) AS ID FROM Clientes_Propriedades GROUP BY ID_CLIENTE) CPPAD
                                   ON CPPAD.ID_CLIENTE = COM.ID
  LEFT JOIN Clientes_Propriedades CP ON CP.ID = ISNULL(V.ID_PROPRIEDADE, CPPAD.ID)
  LEFT JOIN Cidades CIDVEN         ON CIDVEN.ID = VEN.CIDADE
  LEFT JOIN Cidades CIDCOM         ON CIDCOM.ID = COM.CIDADE
  WHERE V.ID > 0 AND V.VALORPAGAR >= 0
`;

export async function consultarVendas(filtros: FiltrosConsulta) {
  await garantirColunaMovCompPisteiro();
  const pool = await getPool();
  const req  = pool.request();
  const conds: string[] = [];

  if (filtros.idLeilao)   { req.input('idLeilao',   sql.Int, filtros.idLeilao);   conds.push('V.IDLEILAO = @idLeilao'); }
  if (filtros.idLote)     { req.input('idLote',     sql.Int, filtros.idLote);     conds.push('V.IDLOTE = @idLote'); }
  if (filtros.idVendedor) { req.input('idVendedor', sql.Int,     filtros.idVendedor);              conds.push('LO.CODVEN = @idVendedor'); }
  // V.IDCLI em VWVendas é VARCHAR — passamos como string para evitar incompatibilidade de tipo
  if (filtros.idComprador){ req.input('idComprador', sql.VarChar, String(filtros.idComprador)); conds.push('V.IDCLI = @idComprador'); }
  if (filtros.idPisteiro) { req.input('idPisteiro', sql.Int, filtros.idPisteiro); conds.push('MC.ID_PISTEIRO = @idPisteiro'); }
  if (filtros.defesa)     { req.input('defesa',     sql.Char, filtros.defesa);    conds.push("V.DEFESA = @defesa"); }
  if (filtros.idRacas && filtros.idRacas.length > 0) {
    const placeholders = filtros.idRacas.map((id, i) => {
      req.input(`raca${i}`, sql.Int, id);
      return `@raca${i}`;
    });
    conds.push(`R.ID IN (${placeholders.join(',')})`);
  }
  const condAno = condicaoAno(req, filtros.ano);
  if (condAno) conds.push(condAno);

  const where = conds.length ? ' AND ' + conds.join(' AND ') : '';
  // MAX_GRANT_PERCENT: o join COM.ID (int) = V.IDCLI (varchar) faz o otimizador
  // estimar centenas de milhares de linhas mesmo em banco pequeno, e o Sort pede
  // ~64 MB de memória para usar ~3 MB. No SQL Express (memória curta, dividida
  // entre todos os bancos) a consulta ficava 30s+ na fila esperando essa reserva
  // (GrantWaitTime) e estourava o timeout — ex.: G2 por comprador, 13 linhas.
  const sql_text = BASE_SQL + where + ' ORDER BY L.DATLEI DESC, TRY_CAST(LO.LOTEXX AS INT), LO.LOTEXX OPTION (MAX_GRANT_PERCENT = 5)';
  const r = await req.query(sql_text);

  const idMovLotes = [...new Set(r.recordset.map((row: any) => row.ID_MOVLOTE).filter((v: any) => v != null))] as number[];
  // Chave composta IDMOVLOTE+IDCLI: quando o lote é rateado entre vários
  // compradores, todos compartilham o mesmo IDMOVLOTE — agrupar só por
  // IDMOVLOTE juntava as parcelas de todos os compradores numa lista só,
  // duplicando vencimentos no relatório (chamado #61).
  const parcelasPorMovLote = await buscarParcelasPorMovLote(idMovLotes);

  return r.recordset.map((row: any) => {
    const parcelas = parcelasPorMovLote[`${row.ID_MOVLOTE}_${row.IDCLI}`] || [];
    const inicial = parcelas.find(p => p.pripar === 'S');
    return {
    id:                    row.ID,
    idMovimentoComprador:  row.ID_MC,
    codnot:                row.CODNOT,
    idLeilao:              row.IDLEILAO,
    leilao:                row.LEILAO,
    datlei:                row.DATLEI,
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
    cnpjVendedor:          row.CNPJ_VENDEDOR,
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
    cnpjComprador:         row.CNPJ_COMPRADOR,
    endereComprador:       row.ENDERE_COMPRADOR,
    bairroComprador:       row.BAIRRO_COMPRADOR,
    cepComprador:          row.CEP_COMPRADOR,
    celularComprador:      row.CELULAR_COMPRADOR,
    celular2Comprador:     row.CELULAR2_COMPRADOR,
    telcomComprador:       row.TELCOM_COMPRADOR,
    telresComprador:       row.TELRES_COMPRADOR,
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
    parcelaInicial:        inicial?.vlrpar ?? null,
    primeiroVencimentoData: inicial?.datven ?? null,
    primeiroVencimentoValor: inicial?.vlrpar ?? null,
    valorPagar:            row.VALORPAGAR,
    valorComissao:         row.VALORCOMISSAO,
    valorDesconto:         row.VALORDESCONTO,
    valorDescontoFidelidade: row.VALOR_DESCONTO_FIDELIDADE,
    valorLiquido:          row.VALOR_LIQUIDO,
    valorComissaoVendedor: row.VALORCOMISSAOVENDEDOR,
    comissaoVendedor:      row.COMISSAOVENDEDOR,
    defesa:                row.DEFESA,
    idPisteiro:            row.ID_PISTEIRO,
    nomePisteiro:          row.NOME_PISTEIRO,
    parcelas,
  };
  });
}

/**
 * Raças presentes nas vendas que a consulta vai devolver (leilão, vendedor e/ou
 * comprador) — permite filtrar por raça sem escolher leilão, ex.: o que um
 * comprador arrematou de uma raça em todos os leilões.
 */
export async function racasDasVendas(f: { idLeilao?: number; idVendedor?: number; idComprador?: number; ano?: number }) {
  const pool = await getPool();
  const req = pool.request();
  const conds: string[] = [];
  if (f.idLeilao)    { req.input('idLeilao', sql.Int, f.idLeilao); conds.push('V.IDLEILAO = @idLeilao'); }
  if (f.idVendedor)  { req.input('idVendedor', sql.Int, f.idVendedor); conds.push('LO.CODVEN = @idVendedor'); }
  // V.IDCLI em VWVendas é VARCHAR (ver consultarVendas)
  if (f.idComprador) { req.input('idComprador', sql.VarChar, String(f.idComprador)); conds.push('V.IDCLI = @idComprador'); }
  const condAno = condicaoAno(req, f.ano);
  if (condAno) conds.push(condAno);
  // Sem filtro nenhum: todas as raças que já tiveram venda (consulta leve, só DISTINCT)
  const r = await req.query(`
    SELECT DISTINCT R.ID, R.DESCRICAO, R.ESPECIES
    FROM VWVendas V
    INNER JOIN Lotes LO  ON LO.ID = V.IDLOTE
    INNER JOIN Racas R   ON R.ID  = LO.RACAXX
    LEFT JOIN Leiloes L  ON L.ID  = V.IDLEILAO
    WHERE V.ID > 0 AND V.VALORPAGAR >= 0${conds.length ? ' AND ' + conds.join(' AND ') : ''}
    ORDER BY R.DESCRICAO
  `);
  return r.recordset.map((row: any) => ({ id: row.ID, descricao: row.DESCRICAO, especies: row.ESPECIES }));
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

/**
 * Médias por categoria num período (data do leilão): soma por categoria (raça do lote) e
 * leilão — a tela marca/desmarca categorias e refaz os totais sem nova consulta. Mesma conta
 * do mapa de médias da Consulta de Vendas: quantidade = animais da parte de cada comprador,
 * valor = valor original, média = valor ÷ quantidade; média por kg só com os lotes que têm
 * peso (peso do lote = qtd × peso por cabeça, ou só o peso se qtd = 0).
 */
export async function mediasPorCategoria(f: { de: string; ate: string; defesa?: 'S' | 'N' }) {
  const pool = await getPool();
  const req = pool.request().input('de', sql.Date, f.de).input('ate', sql.Date, f.ate);
  const conds = ['L.DATLEI >= @de', 'L.DATLEI < DATEADD(DAY, 1, @ate)'];
  if (f.defesa) { req.input('defesa', sql.Char, f.defesa); conds.push('V.DEFESA = @defesa'); }
  const r = await req.query(`
    WITH B AS (
      SELECT R.ID AS IDR, R.DESCRICAO, R.ESPECIES, V.IDLEILAO, L.LEILAO, L.DATLEI, V.IDLOTE,
             ISNULL(V.QTDXXX, 0) * (ISNULL(V.PERCEN, 100) / 100.0) AS QTD,
             ISNULL(V.VALORORIGINAL, 0) AS VALOR,
             ISNULL(LO.PESOXX, 0) AS PESO
      FROM VWVendas V
      LEFT JOIN Leiloes L ON L.ID = V.IDLEILAO
      LEFT JOIN Lotes LO  ON LO.ID = V.IDLOTE
      LEFT JOIN Racas R   ON R.ID = LO.RACAXX
      WHERE V.ID > 0 AND V.VALORPAGAR >= 0 AND ${conds.join(' AND ')}
    )
    SELECT IDR, DESCRICAO, ESPECIES, IDLEILAO, LEILAO, DATLEI,
           SUM(QTD) AS QTD, SUM(VALOR) AS VALOR, COUNT(DISTINCT IDLOTE) AS LOTES,
           SUM(CASE WHEN PESO > 0 AND VALOR > 0 THEN CASE WHEN QTD > 0 THEN QTD * PESO ELSE PESO END ELSE 0 END) AS PESO_KG,
           SUM(CASE WHEN PESO > 0 AND VALOR > 0 THEN VALOR ELSE 0 END) AS VALOR_COM_PESO
    FROM B
    GROUP BY IDR, DESCRICAO, ESPECIES, IDLEILAO, LEILAO, DATLEI
    ORDER BY DESCRICAO, DATLEI
    OPTION (MAX_GRANT_PERCENT = 5)`);
  return r.recordset.map((x: any) => ({
    idCategoria: x.IDR ?? 0,
    categoria: [x.DESCRICAO, x.ESPECIES].map((v: any) => (v ? String(v).trim() : '')).filter(Boolean).join(' / ') || 'Sem categoria',
    idLeilao: x.IDLEILAO, leilao: x.LEILAO ? String(x.LEILAO).trim() : null, datlei: x.DATLEI,
    qtd: Number(x.QTD) || 0, valor: Number(x.VALOR) || 0, lotes: x.LOTES,
    pesoKg: Number(x.PESO_KG) || 0, valorComPeso: Number(x.VALOR_COM_PESO) || 0,
  }));
}
