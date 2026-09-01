import { getPool, sql } from '../config/database';

// ─── helpers ────────────────────────────────────────────────────────────────

// Colunas DATE-only do SQL Server chegam como meia-noite UTC. Usar getters/setters
// locais aqui (getMonth/setFullYear) reinterpreta esse instante no fuso do servidor
// (America/Sao_Paulo, UTC-3) e recua um dia antes de fazer a conta do mês — em
// cadeias de incMonth (parcelas SALPAR, uma chamada em cima da anterior) esse
// desvio composto chega a pular o mês de fevereiro inteiro. Precisa operar em UTC.
function incMonth(date: Date, months = 1): Date {
  const d = new Date(date);
  const targetMonth = d.getUTCMonth() + months;
  const year  = d.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const day   = d.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  d.setUTCFullYear(year, month, Math.min(day, lastDay));
  return d;
}

function ord2(n: number, total: number): string {
  const a = n <= 9 ? `0${n}` : `${n}`;
  const b = String(total);
  return `${a}/${b}`;
}

// ─── tipos ──────────────────────────────────────────────────────────────────

export interface FiltrosListagem {
  busca?: string;
  tipoBusca?: string; // 'todos'|'codigo'|'boleto'|'lote'|'leilao'|'comprador'|'vendedor'
  idLeilao?: number;
}

export interface DadosMovimento {
  idLeilao: number;
  codnot: string;
  defesa?: 'S' | 'N';
}

export interface DadosLote {
  idLote: number;
  qtdxxx: number;
  vlrpar: number;
  vlrtot: number;
  vlrdes: number;
  qtdpar: number;
  comiss?: number;
  comissVendedor?: number;
}

export interface DadosComprador {
  idCli: number;
  idCondPagto: number;
  percen: number;
  formaPagamento: string;
  idPropriedade?: number | null;
  idPisteiro?: number | null;
  tipoDescontoFidelidade?: 'P' | 'V' | null;
  descontoFidelidade?: number;
}

export interface GerarParcelasParams {
  pMovimento: number;
  pCliente: number;
  pCondicaoPagto: number;
  pLeilao: number;
  pClienteVendedor: number;
  pLote: number;       // LOTES.ID — usado pra ler a condição de pagto do lote e como CODLOT
  pIdMovLote: number;  // MOVIMENTO_LOTE.ID — FK real de MOVIMENTO_PARCELAMENTO.IDMOVLOTE
  pLoteNumero: string;
  pDataBase: string;       // 'YYYY-MM-DD'
  pDataLeilao: string;     // 'YYYY-MM-DD'
  pValorOriginal: number;
  pPercentual: number;
  pValorDesconto: number;
  pValorPagar: number;
  pInvertQtd: number;
  pInvertValor: number;
  pTipoDescontoFidelidade?: 'P' | 'V' | null;
  pDescontoFidelidade?: number;
}

// ─── listagem ───────────────────────────────────────────────────────────────

export async function listarVendas(filtros: FiltrosListagem) {
  const pool = await getPool();
  const req  = pool.request();
  let where = 'WHERE V.ID > 0';

  const { busca, tipoBusca, idLeilao } = filtros;

  if (tipoBusca === 'codigo' && busca) {
    req.input('busca', sql.VarChar, busca);
    where += ' AND V.ID = @busca';
  } else if (tipoBusca === 'boleto' && busca) {
    req.input('busca', sql.VarChar, busca);
    where += ' AND V.CODNOT = @busca';
  } else if (tipoBusca === 'lote' && busca) {
    req.input('busca', sql.VarChar, busca);
    where += ' AND V.LOTEXX = @busca';
  } else if (tipoBusca === 'comprador' && busca) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    where += ' AND V.NOMEXX LIKE @busca';
  } else if (tipoBusca === 'vendedor' && busca) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    where += ' AND CV.NOMEXX LIKE @busca';
  } else if (tipoBusca === 'leilao' && idLeilao) {
    req.input('idLeilao', sql.Int, idLeilao);
    where += ' AND V.IDLEILAO = @idLeilao';
  }

  const r = await req.query(`
    SELECT V.*, L.LEILAO
    FROM VWVendas V
    LEFT JOIN Leiloes L ON L.ID = V.IDLEILAO
    LEFT JOIN LOTES LOV ON LOV.ID = V.IDLOTE
    LEFT JOIN CLIENTES CV ON CV.ID = LOV.CODVEN
    ${where}
    ORDER BY V.DATLAN DESC, V.ID DESC
  `);

  return r.recordset.map((row: any) => ({
    id:           row.ID,
    idLeilao:     row.IDLEILAO,
    leilao:       row.LEILAO,
    codnot:       row.CODNOT,
    datlan:       row.DATLAN,
    defesa:       row.DEFESA,
    idLote:       row.IDLOTE,
    lotexx:       row.LOTEXX,
    deslot:       row.DESLOT,
    idcli:        Number(row.IDCLI),
    nomexx:       row.NOMEXX,
    qtdxxx:       row.QTDXXX,
    vlrpar:       row.VLRPAR,
    // VLRTOT vem de Movimento_Lote (valor do lote inteiro) — quando o lote é
    // rateado entre vários compradores, cada linha do view repete o mesmo
    // VLRTOT, parecendo um valor duplicado. VALORORIGINAL é a parte de cada
    // comprador (já vem certo mesmo sem rateio) e é o que a listagem exibe.
    vlrtot:       row.VALORORIGINAL ?? row.VLRTOT,
    status:       row.STATUS,
    stComissao:   row.ST_COMISSAO,
    stParcela:    row.ST_PARCELA,
    stContrato:   row.ST_CONTRATO,
    stEmbarque:   row.ST_EMBARQUE,
  }));
}

// ─── movimento (cabeçalho) ───────────────────────────────────────────────────

export async function criarMovimento(d: DadosMovimento): Promise<number> {
  const pool = await getPool();

  // Usa a data do leilão como DATLAN (mesmo comportamento do Delphi)
  const lRes = await pool.request()
    .input('id', sql.Int, d.idLeilao)
    .query(`SELECT ISNULL(DATLEI, CAST(GETDATE() AS DATE)) AS DATLAN FROM LEILOES WHERE ID=@id`);
  const datlan: Date = lRes.recordset[0]?.DATLAN ?? new Date();

  const r = await pool.request()
    .input('idLeilao', sql.Int,     d.idLeilao)
    .input('codnot',   sql.VarChar, d.codnot)
    .input('datlan',   sql.Date,    datlan)
    .input('defesa',   sql.Char,    d.defesa || 'S')
    .query(`
      INSERT INTO MOVIMENTO (IDLEILAO, CODNOT, DATLAN, DEFESA)
      OUTPUT INSERTED.ID
      VALUES (@idLeilao, @codnot, @datlan, @defesa)
    `);
  return r.recordset[0].ID;
}

export async function atualizarMovimento(id: number, d: DadosMovimento): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id',       sql.Int,     id)
    .input('idLeilao', sql.Int,     d.idLeilao)
    .input('codnot',   sql.VarChar, d.codnot)
    .input('defesa',   sql.Char,    d.defesa || 'S')
    .query(`UPDATE MOVIMENTO SET IDLEILAO=@idLeilao, CODNOT=@codnot, DEFESA=@defesa WHERE ID=@id`);
}

export async function buscarMovimento(id: number) {
  const pool = await getPool();
  const r = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      SELECT M.*, L.LEILAO, L.DATLEI, L.CONDIC, L.COMCOM, L.COMVEN, L.DATA_SALDO,
             CP.QTDPAR
      FROM MOVIMENTO M
      LEFT JOIN LEILOES L ON L.ID = M.IDLEILAO
      LEFT JOIN CONDICAOPAGTOS CP ON CP.ID = L.CONDIC
      WHERE M.ID = @id
    `);
  if (!r.recordset.length) return null;
  const row = r.recordset[0];
  return {
    id:         row.ID,
    idLeilao:   row.IDLEILAO,
    codnot:     row.CODNOT,
    datlan:     row.DATLAN,
    defesa:     row.DEFESA,
    leilao:     row.LEILAO,
    datlei:     row.DATLEI,
    condic:     row.CONDIC,
    comcom:     row.COMCOM,
    comven:     row.COMVEN,
    qtdpar:     row.QTDPAR,
    dataSaldo:  row.DATA_SALDO,
  };
}

export async function excluirVenda(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id)
    .query(`DELETE FROM DESPESAS WHERE IDMOVCOMPRADOR IN (SELECT ID FROM MOVIMENTO_COMPRADOR WHERE IDMOV=@id)`);
  await pool.request().input('id', sql.Int, id)
    .query(`DELETE FROM MOVIMENTO_PARCELAMENTO WHERE IDMOV=@id`);
  await pool.request().input('id', sql.Int, id)
    .query(`DELETE FROM MOVIMENTO_COMPRADOR WHERE IDMOV=@id`);
  await pool.request().input('id', sql.Int, id)
    .query(`DELETE FROM MOVIMENTO_LOTE WHERE IDMOV=@id`);
  await pool.request().input('id', sql.Int, id)
    .query(`DELETE FROM MOVIMENTO WHERE ID=@id`);
}

// ─── lotes disponíveis ───────────────────────────────────────────────────────

/**
 * Um lote com QTDANIMAIS preenchido (quantidade total de animais que o
 * compõem) pode ser vendido em vendas separadas até esgotar essa
 * quantidade (ex.: lote de 10 animais, um comprador leva 5, outro leva os
 * 5 restantes numa venda diferente) — continua "disponível" enquanto a
 * soma vendida (MOVIMENTO_LOTE.QTDXXX de todas as vendas desse lote) for
 * menor que o total. Lotes sem QTDANIMAIS preenchido mantêm o
 * comportamento antigo: somem da lista assim que qualquer venda existir
 * (não dá pra saber "quanto resta" sem saber o total).
 * Agrega direto em MOVIMENTO_LOTE (não via VWVendas) porque VWVendas
 * multiplica a linha por comprador quando o lote é rateado — somar por ali
 * contaria o mesmo QTDXXX várias vezes.
 */
export async function lotesDisponiveis(idLeilao: number) {
  const pool = await getPool();
  const r = await pool.request()
    .input('idLeilao', sql.Int, idLeilao)
    .query(`
      SELECT L.*, C.NOMEXX, R.DESCRICAO AS DESCRICAORACA, R.ESPECIES, R.RACA,
             CP.DESFIN AS CONDICAO_DESFIN, CP.QTDPAR AS CONDICAO_QTDPAR, ISNULL(MLV.QTD_VENDIDA, 0) AS QTD_VENDIDA
      FROM LOTES L
      LEFT JOIN CLIENTES C   ON C.ID = L.CODVEN
      LEFT JOIN RACAS R      ON R.ID = L.RACAXX
      LEFT JOIN CONDICAOPAGTOS CP ON CP.ID = L.CONDIC
      LEFT JOIN (
        SELECT IDLOTE, SUM(ISNULL(QTDXXX, 0)) AS QTD_VENDIDA
        FROM MOVIMENTO_LOTE
        GROUP BY IDLOTE
      ) MLV ON MLV.IDLOTE = L.ID
      WHERE L.IDLEILAO = @idLeilao
        AND (
          MLV.QTD_VENDIDA IS NULL
          OR (L.QTDANIMAIS IS NOT NULL AND MLV.QTD_VENDIDA < L.QTDANIMAIS)
        )
      ORDER BY TRY_CAST(L.ORDEM AS INT), L.ORDEM
    `);
  return r.recordset.map((row: any) => ({
    id:          row.ID,
    lotexx:      row.LOTEXX,
    deslot:      row.DESLOT,
    rpxxx:       row.RPXXX,
    sbbxxx:      row.SBBXXX,
    pesoxx:      row.PESOXX,
    codven:      row.CODVEN,
    nomeVendedor: row.NOMEXX,
    pelagem:     row.PELAGE,
    datnas:      row.DATNAS,
    racaxx:      row.RACAXX,
    descricaoRaca: row.DESCRICAORACA,
    especies:    row.ESPECIES,
    raca:        row.RACA,
    condic:      row.CONDIC,
    condicaoDesfin: row.CONDICAO_DESFIN,
    condicaoQtdpar: row.CONDICAO_QTDPAR,
    vlrins:      row.VLRINS,
    filiacoa:    row.FILIACAO,
    ordem:       row.ORDEM,
    obslot:      row.OBSLOT,
    qtdAnimais:  row.QTDANIMAIS,
    qtdVendida:  row.QTD_VENDIDA,
    qtdRestante: row.QTDANIMAIS != null ? row.QTDANIMAIS - row.QTD_VENDIDA : undefined,
  }));
}

// ─── lote do movimento ───────────────────────────────────────────────────────

export async function salvarLote(idMov: number, d: DadosLote, datlan: string): Promise<number> {
  const pool = await getPool();
  const existe = await pool.request()
    .input('idMov', sql.Int, idMov)
    .query(`SELECT ID FROM MOVIMENTO_LOTE WHERE IDMOV=@idMov`);

  if (existe.recordset.length) {
    const idLoteRow = existe.recordset[0].ID;
    await pool.request()
      .input('id',             sql.Int,     idLoteRow)
      .input('idLote',         sql.Int,     d.idLote)
      .input('qtdxxx',         sql.Decimal, d.qtdxxx)
      .input('qtdpar',         sql.VarChar, String(d.qtdpar ?? 1))
      .input('vlrpar',         sql.Decimal(18, 2), d.vlrpar)
      .input('vlrtot',         sql.Decimal(18, 2), d.vlrtot)
      .input('vlrdes',         sql.Decimal(18, 2), d.vlrdes)
      .input('comiss',         sql.Decimal(18, 2), d.comiss || 0)
      .input('comissVendedor', sql.Decimal(18, 2), d.comissVendedor || 0)
      .input('datlan',         sql.Date,    datlan)
      .query(`
        UPDATE MOVIMENTO_LOTE
        SET IDLOTE=@idLote, QTDXXX=@qtdxxx, QTDPAR=@qtdpar, VLRPAR=@vlrpar, VLRTOT=@vlrtot,
            VLRDES=@vlrdes, COMISS=@comiss,
            COMISS_VENDEDOR=@comissVendedor, DATLAN=@datlan
        WHERE ID=@id
      `);
    return idLoteRow;
  }

  // busca lotexx para gravar
  const loteInfo = await pool.request()
    .input('idLote', sql.Int, d.idLote)
    .query(`SELECT LOTEXX, CODVEN FROM LOTES WHERE ID=@idLote`);
  const lotexx = loteInfo.recordset[0]?.LOTEXX ?? '';
  const codven = loteInfo.recordset[0]?.CODVEN ?? null;

  const r = await pool.request()
    .input('idMov',          sql.Int,     idMov)
    .input('idLote',         sql.Int,     d.idLote)
    .input('lotexx',         sql.VarChar, lotexx)
    .input('codven',         sql.Int,     codven)
    .input('qtdxxx',         sql.Decimal, d.qtdxxx)
    .input('qtdpar',         sql.Int,     d.qtdpar || 1)
    .input('vlrpar',         sql.Decimal(18, 2), d.vlrpar)
    .input('vlrtot',         sql.Decimal(18, 2), d.vlrtot)
    .input('vlrdes',         sql.Decimal(18, 2), d.vlrdes)
    .input('comiss',         sql.Decimal(18, 2), d.comiss || 0)
    .input('comissVendedor', sql.Decimal(18, 2), d.comissVendedor || 0)
    .input('datlan',         sql.Date,    datlan)
    .query(`
      INSERT INTO MOVIMENTO_LOTE (IDMOV,IDLOTE,LOTEXX,CODVEN,QTDXXX,QTDPAR,VLRPAR,VLRTOT,VLRDES,COMISS,COMISS_VENDEDOR,DATLAN)
      OUTPUT INSERTED.ID
      VALUES (@idMov,@idLote,@lotexx,@codven,@qtdxxx,@qtdpar,@vlrpar,@vlrtot,@vlrdes,@comiss,@comissVendedor,@datlan)
    `);
  return r.recordset[0].ID;
}

export async function buscarLoteMovimento(idMov: number) {
  const pool = await getPool();
  const r = await pool.request()
    .input('idMov', sql.Int, idMov)
    .query(`
      SELECT
        ML.ID, ML.IDMOV, ML.IDLOTE, ML.DATLAN,
        ML.VLRPAR, ML.QTDPAR, ML.VLRTOT, ML.COMISS, ML.VLRDES,
        ML.QTDXXX, ML.CODVEN AS CODVEN_ML, ML.LOTEXX AS LOTEXX_ML,
        ML.COMISS_VENDEDOR,
        L.LOTEXX, L.DESLOT, L.RPXXX, L.SBBXXX, L.PESOXX,
        L.PELAGE, L.DATNAS, L.RACAXX, L.CODVEN, L.QTDANIMAIS,
        C.NOMEXX AS NOME_VENDEDOR,
        R.DESCRICAO AS DESCRICAORACA, R.ESPECIES
      FROM MOVIMENTO_LOTE ML
      LEFT JOIN LOTES L    ON L.ID = ML.IDLOTE
      LEFT JOIN CLIENTES C ON C.ID = ML.CODVEN
      LEFT JOIN RACAS R    ON R.ID = L.RACAXX
      WHERE ML.IDMOV = @idMov
    `);
  if (!r.recordset.length) return null;
  const row = r.recordset[0];

  // Quanto essa venda pode ter em QTDXXX sem estourar o total do lote —
  // soma tudo que já foi vendido do mesmo lote (outras vendas) e subtrai
  // do total cadastrado; a própria quantidade desta venda não conta como
  // "consumida" pra esse cálculo, senão o teto encolheria a cada edição.
  let qtdRestante: number | undefined;
  if (row.QTDANIMAIS != null && row.IDLOTE != null) {
    const rSoma = await pool.request()
      .input('idLote', sql.Int, row.IDLOTE)
      .input('idMov', sql.Int, idMov)
      .query(`
        SELECT SUM(ISNULL(QTDXXX, 0)) AS QTD_OUTRAS
        FROM MOVIMENTO_LOTE WHERE IDLOTE = @idLote AND IDMOV <> @idMov
      `);
    const vendidoPorOutras = rSoma.recordset[0]?.QTD_OUTRAS || 0;
    qtdRestante = row.QTDANIMAIS - vendidoPorOutras;
  }

  return {
    id:            row.ID,
    idMov:         row.IDMOV,
    idLote:        row.IDLOTE,
    lotexx:        row.LOTEXX ?? row.LOTEXX_ML ?? '',
    deslot:        row.DESLOT,
    rpxxx:         row.RPXXX,
    sbbxxx:        row.SBBXXX,
    pesoxx:        row.PESOXX,
    pelagem:       row.PELAGE,
    datnas:        row.DATNAS,
    codven:        row.CODVEN ?? row.CODVEN_ML,
    nomeVendedor:  row.NOME_VENDEDOR,
    descricaoRaca: row.DESCRICAORACA,
    especies:      row.ESPECIES,
    qtdxxx:        row.QTDXXX,
    vlrpar:        row.VLRPAR,
    vlrtot:        row.VLRTOT,
    vlrdes:        row.VLRDES,
    qtdpar:        row.QTDPAR,
    comiss:        row.COMISS,
    comissVendedor: row.COMISS_VENDEDOR,
    datlan:        row.DATLAN,
    qtdAnimais:    row.QTDANIMAIS,
    qtdRestante,
  };
}

// ─── compradores ─────────────────────────────────────────────────────────────

let colunaPisteiroMovComp = false;
async function garantirColunaMovCompPisteiro() {
  if (colunaPisteiroMovComp) return;
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='MOVIMENTO_COMPRADOR' AND COLUMN_NAME='ID_PISTEIRO'
    )
    ALTER TABLE MOVIMENTO_COMPRADOR ADD ID_PISTEIRO INT NULL
  `);
  colunaPisteiroMovComp = true;
}

export async function listarCompradores(idMov: number) {
  await garantirColunaMovCompPisteiro();
  const pool = await getPool();
  const r = await pool.request()
    .input('idMov', sql.Int, idMov)
    .query(`
      SELECT MC.*, C.NOMEXX, C.CPFXXX, CP.DESFIN,
             CP_PROP.NOME_PROPRIEDADE, CP_PROP.CIDADE, CP_PROP.ESTADO,
             PIST.NOMEXX AS NOME_PISTEIRO
      FROM MOVIMENTO_COMPRADOR MC
      LEFT JOIN CLIENTES C ON C.ID = MC.IDCLI
      LEFT JOIN CONDICAOPAGTOS CP ON CP.ID = MC.IDCONDPAGTO
      LEFT JOIN CLIENTES_PROPRIEDADES CP_PROP ON CP_PROP.ID = MC.ID_PROPRIEDADE
      LEFT JOIN CLIENTES PIST ON PIST.ID = MC.ID_PISTEIRO
      WHERE MC.IDMOV = @idMov
      ORDER BY MC.ID
    `);
  return r.recordset.map((row: any) => ({
    id:                row.ID,
    idMov:             row.IDMOV,
    idMovLote:         row.IDMOVLOTE,
    idCli:             Number(row.IDCLI),
    nomexx:            row.NOMEXX,
    cpfxxx:            row.CPFXXX,
    idCondPagto:       row.IDCONDPAGTO,
    desfin:            row.DESFIN,
    percen:            row.PERCEN,
    valorOriginal:     row.VALORORIGINAL,
    valorPagar:        row.VALORPAGAR,
    valorDesconto:     row.VALORDESCONTO,
    valorComissao:     row.VALORCOMISSAO,
    comissao:          row.COMISSAO,
    valorBaseComissao: row.VALORBASECOMISSAO,
    valorComissaoVendedor: row.VALORCOMISSAOVENDEDOR,
    comissaoVendedor:  row.COMISSAOVENDEDOR,
    valorBaseComissaoVendedor: row.VALORBASECOMISSAOVENDEDOR,
    formaPagamento:    row.FORMA_PAGAMENTO,
    idPropriedade:     row.ID_PROPRIEDADE,
    nomePropriedade:   row.NOME_PROPRIEDADE,
    cidadePropriedade: row.CIDADE,
    estadoPropriedade: row.ESTADO,
    idPisteiro:        row.ID_PISTEIRO ? Number(row.ID_PISTEIRO) : null,
    nomePisteiro:      row.NOME_PISTEIRO ?? null,
    tipoDescontoFidelidade:  row.TIPO_DESCONTO_FIDELIDADE ?? null,
    descontoFidelidade:      row.DESCONTO_FIDELIDADE,
    valorDescontoFidelidade: row.VALOR_DESCONTO_FIDELIDADE,
  }));
}

type MovLoteBase = { vlrtot: number; vlrdes: number; comiss: number; comissVendedor: number; lotexx: string; datlan: string; qtdxxx: number };

function calcularValoresComprador(
  movLote: MovLoteBase,
  percenPct: number,
  fidelidade?: { tipo: 'P' | 'V' | null; valor: number },
) {
  const percen = percenPct / 100;
  const valorOriginal = (movLote.vlrtot + movLote.vlrdes) * percen;
  const valorDesconto = movLote.vlrdes * percen;
  let valorPagar = movLote.vlrtot * percen;

  // Desconto de fidelidade — aditivo/separado do desconto de lote (VALORDESCONTO).
  // Valor provisório: neste estágio o desconto de condição de pagamento ainda não
  // foi aplicado (isso só acontece em gerarParcelas), o mesmo comportamento que
  // VALORDESCONTO/VALORPAGAR já têm hoje antes das parcelas serem geradas.
  const tipoFid = fidelidade?.tipo ?? null;
  const brutoFid = fidelidade?.valor ?? 0;
  let valorDescontoFidelidade = 0;
  if (tipoFid === 'P' && brutoFid > 0) {
    valorDescontoFidelidade = valorPagar * (brutoFid / 100);
  } else if (tipoFid === 'V' && brutoFid > 0) {
    valorDescontoFidelidade = brutoFid;
  }
  valorDescontoFidelidade = Math.min(valorDescontoFidelidade, valorPagar);
  valorPagar -= valorDescontoFidelidade;

  const valorBaseComissao         = movLote.vlrtot * percen;
  const valorBaseComissaoVendedor = movLote.vlrtot * percen;
  const valorComissao         = movLote.comiss * percen;
  const valorComissaoVendedor = movLote.comissVendedor * percen;
  const comissao         = valorBaseComissao > 0
    ? (valorComissao / valorBaseComissao) * 100 : 0;
  const comissaoVendedor = valorBaseComissaoVendedor > 0
    ? (valorComissaoVendedor / valorBaseComissaoVendedor) * 100 : 0;

  return {
    valorOriginal, valorDesconto, valorPagar,
    valorBaseComissao, valorBaseComissaoVendedor,
    valorComissao, valorComissaoVendedor,
    comissao, comissaoVendedor,
    tipoDescontoFidelidade: tipoFid,
    descontoFidelidade: brutoFid,
    valorDescontoFidelidade,
  };
}

export async function salvarComprador(
  idMov: number,
  idMovLote: number,
  movLote: MovLoteBase,
  d: DadosComprador,
  leilao: { id: number; comcom: number; comven: number; condic: number; codnot: string },
): Promise<number> {
  const pool = await getPool();

  const {
    valorOriginal, valorDesconto, valorPagar,
    valorBaseComissao, valorBaseComissaoVendedor,
    valorComissao, valorComissaoVendedor,
    comissao, comissaoVendedor,
    valorDescontoFidelidade,
  } = calcularValoresComprador(movLote, d.percen, {
    tipo: d.tipoDescontoFidelidade ?? null,
    valor: d.descontoFidelidade ?? 0,
  });

  await garantirColunaMovCompPisteiro();
  const r = await pool.request()
    .input('idMov',                       sql.Int,     idMov)
    .input('idMovLote',                   sql.Int,     idMovLote)
    .input('idLeilao',                    sql.Int,     leilao.id)
    .input('codnot',                      sql.VarChar, leilao.codnot)
    .input('idCli',                       sql.Int,     d.idCli)
    .input('idCondPagto',                 sql.Int,     d.idCondPagto)
    .input('percen',                      sql.Decimal(9, 4), d.percen)
    .input('valorOriginal',               sql.Decimal(18, 2), valorOriginal)
    .input('valorPagar',                  sql.Decimal(18, 2), valorPagar)
    .input('valorDesconto',               sql.Decimal(18, 2), valorDesconto)
    .input('valorComissao',               sql.Decimal(18, 2), valorComissao)
    .input('comissao',                    sql.Decimal(9, 4), comissao)
    .input('valorComissaoVendedor',       sql.Decimal(18, 2), valorComissaoVendedor)
    .input('comissaoVendedor',            sql.Decimal(9, 4), comissaoVendedor)
    .input('valorBaseComissao',           sql.Decimal(18, 2), valorBaseComissao)
    .input('valorBaseComissaoVendedor',   sql.Decimal(18, 2), valorBaseComissaoVendedor)
    .input('formaPagamento',              sql.VarChar, d.formaPagamento)
    .input('idPropriedade',               sql.Int,     d.idPropriedade || null)
    .input('idPisteiro',                  sql.Int,     d.idPisteiro || null)
    .input('tipoDescontoFidelidade',      sql.Char(1), d.tipoDescontoFidelidade ?? null)
    .input('descontoFidelidade',          sql.Decimal(18, 2), d.descontoFidelidade ?? 0)
    .input('valorDescontoFidelidade',     sql.Decimal(18, 2), valorDescontoFidelidade)
    .query(`
      INSERT INTO MOVIMENTO_COMPRADOR
        (IDMOV,IDMOVLOTE,IDLEILAO,CODNOT,IDCLI,IDCONDPAGTO,PERCEN,
         VALORORIGINAL,VALORPAGAR,VALORDESCONTO,VALORCOMISSAO,COMISSAO,
         VALORCOMISSAOVENDEDOR,COMISSAOVENDEDOR,
         VALORBASECOMISSAO,VALORBASECOMISSAOVENDEDOR,
         FORMA_PAGAMENTO,ID_PROPRIEDADE,ID_PISTEIRO,
         TIPO_DESCONTO_FIDELIDADE,DESCONTO_FIDELIDADE,VALOR_DESCONTO_FIDELIDADE)
      OUTPUT INSERTED.ID
      VALUES
        (@idMov,@idMovLote,@idLeilao,@codnot,@idCli,@idCondPagto,@percen,
         @valorOriginal,@valorPagar,@valorDesconto,@valorComissao,@comissao,
         @valorComissaoVendedor,@comissaoVendedor,
         @valorBaseComissao,@valorBaseComissaoVendedor,
         @formaPagamento,@idPropriedade,@idPisteiro,
         @tipoDescontoFidelidade,@descontoFidelidade,@valorDescontoFidelidade)
    `);

  return r.recordset[0].ID;
}

export async function atualizarComprador(
  idComp: number,
  movLote: MovLoteBase,
  d: DadosComprador,
): Promise<void> {
  const pool = await getPool();

  const {
    valorOriginal, valorDesconto, valorPagar,
    valorBaseComissao, valorBaseComissaoVendedor,
    valorComissao, valorComissaoVendedor,
    comissao, comissaoVendedor,
    valorDescontoFidelidade,
  } = calcularValoresComprador(movLote, d.percen, {
    tipo: d.tipoDescontoFidelidade ?? null,
    valor: d.descontoFidelidade ?? 0,
  });

  await pool.request()
    .input('id',                          sql.Int,     idComp)
    .input('idCondPagto',                 sql.Int,     d.idCondPagto)
    .input('percen',                      sql.Decimal(9, 4), d.percen)
    .input('valorOriginal',               sql.Decimal(18, 2), valorOriginal)
    .input('valorPagar',                  sql.Decimal(18, 2), valorPagar)
    .input('valorDesconto',               sql.Decimal(18, 2), valorDesconto)
    .input('valorComissao',               sql.Decimal(18, 2), valorComissao)
    .input('comissao',                    sql.Decimal(9, 4), comissao)
    .input('valorComissaoVendedor',       sql.Decimal(18, 2), valorComissaoVendedor)
    .input('comissaoVendedor',            sql.Decimal(9, 4), comissaoVendedor)
    .input('valorBaseComissao',           sql.Decimal(18, 2), valorBaseComissao)
    .input('valorBaseComissaoVendedor',   sql.Decimal(18, 2), valorBaseComissaoVendedor)
    .input('formaPagamento',              sql.VarChar, d.formaPagamento)
    .input('idPropriedade',               sql.Int,     d.idPropriedade || null)
    .input('idPisteiro',                  sql.Int,     d.idPisteiro || null)
    .input('tipoDescontoFidelidade',      sql.Char(1), d.tipoDescontoFidelidade ?? null)
    .input('descontoFidelidade',          sql.Decimal(18, 2), d.descontoFidelidade ?? 0)
    .input('valorDescontoFidelidade',     sql.Decimal(18, 2), valorDescontoFidelidade)
    .query(`
      UPDATE MOVIMENTO_COMPRADOR SET
        IDCONDPAGTO=@idCondPagto, PERCEN=@percen,
        VALORORIGINAL=@valorOriginal, VALORPAGAR=@valorPagar, VALORDESCONTO=@valorDesconto,
        VALORCOMISSAO=@valorComissao, COMISSAO=@comissao,
        VALORCOMISSAOVENDEDOR=@valorComissaoVendedor, COMISSAOVENDEDOR=@comissaoVendedor,
        VALORBASECOMISSAO=@valorBaseComissao, VALORBASECOMISSAOVENDEDOR=@valorBaseComissaoVendedor,
        FORMA_PAGAMENTO=@formaPagamento, ID_PROPRIEDADE=@idPropriedade, ID_PISTEIRO=@idPisteiro,
        TIPO_DESCONTO_FIDELIDADE=@tipoDescontoFidelidade, DESCONTO_FIDELIDADE=@descontoFidelidade,
        VALOR_DESCONTO_FIDELIDADE=@valorDescontoFidelidade
      WHERE ID=@id
    `);
}

export async function atualizarComissaoManual(
  idComp: number, valorComissao: number, valorComissaoVendedor: number,
): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id',                    sql.Int,     idComp)
    .input('valorComissao',         sql.Decimal(18, 2), valorComissao)
    .input('valorComissaoVendedor', sql.Decimal(18, 2), valorComissaoVendedor)
    .query(`
      UPDATE MOVIMENTO_COMPRADOR
      SET VALORCOMISSAO=@valorComissao,
          COMISSAO = CASE WHEN VALORBASECOMISSAO > 0 THEN (@valorComissao / VALORBASECOMISSAO) * 100 ELSE 0 END,
          VALORCOMISSAOVENDEDOR=@valorComissaoVendedor,
          COMISSAOVENDEDOR = CASE WHEN VALORBASECOMISSAOVENDEDOR > 0 THEN (@valorComissaoVendedor / VALORBASECOMISSAOVENDEDOR) * 100 ELSE 0 END
      WHERE ID=@id
    `);
}

export async function excluirComprador(idMov: number, idComp: number): Promise<void> {
  const pool = await getPool();
  const comp = await pool.request()
    .input('id', sql.Int, idComp)
    .query(`SELECT IDCLI, IDMOVLOTE FROM MOVIMENTO_COMPRADOR WHERE ID=@id`);
  if (!comp.recordset.length) return;
  const { IDCLI, IDMOVLOTE } = comp.recordset[0];

  await pool.request()
    .input('idMov',     sql.Int, idMov)
    .input('idCli',     sql.Int, IDCLI)
    .input('idMovLote', sql.Int, IDMOVLOTE)
    .query(`DELETE FROM MOVIMENTO_PARCELAMENTO WHERE IDMOV=@idMov AND IDCLI=@idCli AND IDMOVLOTE=@idMovLote`);
  await pool.request()
    .input('id', sql.Int, idComp)
    .query(`DELETE FROM DESPESAS WHERE IDMOVCOMPRADOR=@id`);
  await pool.request()
    .input('id', sql.Int, idComp)
    .query(`DELETE FROM MOVIMENTO_COMPRADOR WHERE ID=@id`);
}

// ─── parcelas ────────────────────────────────────────────────────────────────

export async function listarParcelas(idMov: number, idCli?: number) {
  const pool = await getPool();
  const req  = pool.request().input('idMov', sql.Int, idMov);
  let where = 'WHERE MP.IDMOV=@idMov';
  if (idCli) {
    req.input('idCli', sql.Int, idCli);
    where += ' AND MP.IDCLI=@idCli';
  }
  const r = await req.query(`
    SELECT MP.*, C.NOMEXX
    FROM MOVIMENTO_PARCELAMENTO MP
    LEFT JOIN CLIENTES C ON C.ID = MP.IDCLI
    ${where}
    ORDER BY MP.DATVEN, MP.ORDXXX
  `);
  return r.recordset.map((row: any) => ({
    id:     row.ID,
    idMov:  row.IDMOV,
    idCli:  row.IDCLI,
    nomexx: row.NOMEXX,
    lotexx: row.LOTEXX,
    datlan: row.DATLAN,
    datven: row.DATVEN,
    vlrpar: row.VLRPAR,
    ordxxx: row.ORDXXX,
    pripar: row.PRIPAR,
  }));
}

export async function gerarParcelas(p: GerarParcelasParams): Promise<void> {
  const pool = await getPool();

  // 1. DATA_SALDO do leilão
  const lRes = await pool.request()
    .input('id', sql.Int, p.pLeilao)
    .query(`SELECT DATA_SALDO, DATLEI FROM LEILOES WHERE ID=@id`);
  const dataSaldoSafra: Date | null = lRes.recordset[0]?.DATA_SALDO
    ? new Date(lRes.recordset[0].DATA_SALDO) : null;
  const dataLeilao = p.pDataLeilao
    ? new Date(p.pDataLeilao)
    : (lRes.recordset[0]?.DATLEI ? new Date(lRes.recordset[0].DATLEI) : new Date());

  // 2. Condição de pagamento: sempre a escolhida pelo comprador (MOVIMENTO_COMPRADOR),
  // é ela que define como o cliente vai efetivamente pagar (ex.: à vista com desconto).
  // A CONDIC do lote/leilão é usada só como multiplicador de QTDPAR pra precificar o
  // lote (VLRTOT = VLRPAR * QTDPAR, já resolvido no frontend ao selecionar o lote) —
  // não deve ser usada aqui pra decidir o parcelamento do contrato.
  const condId = p.pCondicaoPagto;

  const cRes = await pool.request()
    .input('id', sql.Int, condId)
    .query(`SELECT * FROM CONDICAOPAGTOS WHERE ID=@id`);
  if (!cRes.recordset.length) throw new Error('Condição de pagamento não encontrada');
  const cond = cRes.recordset[0];

  const qtdpar  = parseInt(cond.QTDPAR) || 1;
  const salpar  = parseInt(cond.SALPAR) || 0;
  const avista  = cond.AVISTA === 'S';
  const invert  = cond.INVERT === 'S';
  const safrax  = cond.SAFRAX === 'S';
  const descon  = parseFloat(cond.DESCON) || 0;
  const entrad  = cond.ENTRAD === 'S';

  // 3. Excluir parcelas existentes
  await pool.request()
    .input('idMov',     sql.Int, p.pMovimento)
    .input('idCli',     sql.Int, p.pCliente)
    .input('idMovLote', sql.Int, p.pIdMovLote)
    .query(`DELETE FROM MOVIMENTO_PARCELAMENTO WHERE IDMOV=@idMov AND IDCLI=@idCli AND IDMOVLOTE=@idMovLote`);

  // 4. Totpar
  let totpar = 0;
  for (let i = 1; i <= 15; i++) {
    const k = i <= 9 ? `PARC0${i}` : `PARC${i}`;
    totpar += parseFloat(cond[k]) || 0;
  }

  // 5. Desconto do lote (manual, campo "Desconto (R$)" da venda) + Desconto da condição
  // de pagamento (%) + Fidelidade — compostos em sequência sobre o valor bruto.
  // pValorPagar sempre recomeça do bruto (pValorOriginal) — gerarParcelas pode
  // rodar mais de uma vez pro mesmo comprador (reemitir parcelamento), e usar o
  // p.pValorPagar recebido (que já pode ter os descontos aplicados uma vez pelo
  // cálculo provisório de salvarComprador/atualizarComprador) duplicaria o desconto.
  const { pValorOriginal } = p;
  const valorDescontoLote = p.pValorDesconto || 0;
  let pValorPagar = pValorOriginal - valorDescontoLote;
  let valorDescontoCondicao = 0;
  if (descon > 0) {
    valorDescontoCondicao = pValorPagar * (descon / 100);
    pValorPagar -= valorDescontoCondicao;
  }

  let valorDescontoFidelidade = 0;
  if (p.pTipoDescontoFidelidade === 'P' && (p.pDescontoFidelidade || 0) > 0) {
    valorDescontoFidelidade = pValorPagar * ((p.pDescontoFidelidade as number) / 100);
  } else if (p.pTipoDescontoFidelidade === 'V' && (p.pDescontoFidelidade || 0) > 0) {
    valorDescontoFidelidade = p.pDescontoFidelidade as number;
  }
  valorDescontoFidelidade = Math.min(valorDescontoFidelidade, pValorPagar);
  pValorPagar -= valorDescontoFidelidade;

  {
    const valorDescontoTotal = valorDescontoLote + valorDescontoCondicao;
    await pool.request()
      .input('idMov',     sql.Int,     p.pMovimento)
      .input('idCli',     sql.Int,     p.pCliente)
      .input('idMovLote', sql.Int,     p.pIdMovLote)
      .input('desc',      sql.Decimal(18, 2), valorDescontoTotal)
      .input('fid',       sql.Decimal(18, 2), valorDescontoFidelidade)
      .input('pagar',     sql.Decimal(18, 2), pValorPagar)
      .query(`UPDATE MOVIMENTO_COMPRADOR
              SET VALORDESCONTO=@desc, VALOR_DESCONTO_FIDELIDADE=@fid, VALORPAGAR=@pagar
              WHERE IDMOV=@idMov AND IDCLI=@idCli AND IDMOVLOTE=@idMovLote`);
  }

  // Comissão (comprador e vendedor) vira despesa de verdade em DESPESAS — só
  // assim existe lançamento editável com recibo pra ela, em vez de ficar só
  // guardada em MOVIMENTO_COMPRADOR sem aparecer em lugar nenhum. Sincroniza
  // aqui (apaga e recria) toda vez que o parcelamento é (re)gerado, em vez de
  // tentar manter em dia a cada ponto onde a comissão pode mudar.
  {
    const rComp = await pool.request()
      .input('idMov',     sql.Int, p.pMovimento)
      .input('idCli',     sql.Int, p.pCliente)
      .input('idMovLote', sql.Int, p.pIdMovLote)
      .query(`
        SELECT ID, VALORCOMISSAO, COMISSAO, VALORCOMISSAOVENDEDOR, COMISSAOVENDEDOR
        FROM MOVIMENTO_COMPRADOR
        WHERE IDMOV=@idMov AND IDCLI=@idCli AND IDMOVLOTE=@idMovLote
      `);
    const compRow = rComp.recordset[0];
    if (compRow) {
      await pool.request().input('id', sql.Int, compRow.ID)
        .query(`DELETE FROM DESPESAS WHERE IDMOVCOMPRADOR=@id`);

      const fmtPct = (v: number) => (Number(v) || 0).toFixed(2).replace(/\.?0+$/, '');
      const inserirDespesaComissao = async (
        codigoCliente: number | null, tipo: 'COMISSAO_COMPRADOR' | 'COMISSAO_VENDEDOR', valor: number, pct: number,
      ) => {
        if (!(valor > 0.01) || !codigoCliente) return;
        await pool.request()
          .input('codLei',         sql.Int,     p.pLeilao)
          .input('codigoCliente',  sql.Int,     codigoCliente)
          .input('valor',          sql.Float,   valor)
          .input('observacoes',    sql.VarChar,
            `COMISSÃO ${tipo === 'COMISSAO_VENDEDOR' ? 'VENDEDOR' : 'COMPRADOR'} ${fmtPct(pct)}% - ${p.pLoteNumero}`)
          .input('idMovComprador', sql.Int,     compRow.ID)
          .input('tipoOrigem',     sql.VarChar, tipo)
          .input('dataInclusao',   sql.Date,    new Date())
          .input('dataAlteracao',  sql.Date,    new Date())
          .query(`
            INSERT INTO DESPESAS
              (CODLEI, CODIGO_CLIENTE, D_C, VALOR, OBSERVACOES, IDMOVCOMPRADOR, TIPO_ORIGEM, DATA_INCLUSAO, DATA_ALTERACAO)
            VALUES
              (@codLei, @codigoCliente, 'D', @valor, @observacoes, @idMovComprador, @tipoOrigem, @dataInclusao, @dataAlteracao)
          `);
      };

      await inserirDespesaComissao(p.pCliente,        'COMISSAO_COMPRADOR', compRow.VALORCOMISSAO || 0,         compRow.COMISSAO);
      await inserirDespesaComissao(p.pClienteVendedor, 'COMISSAO_VENDEDOR',  compRow.VALORCOMISSAOVENDEDOR || 0, compRow.COMISSAOVENDEDOR);
    }
  }

  // 6. Safra
  let valorEntrada = 0, valorSaldo = 0, descontoEntrada = 0, descontoSaldo = 0;
  if (safrax) {
    valorEntrada   = pValorPagar * ((parseFloat(cond.ENTRADA_SAFRA) || 0) / 100);
    valorSaldo     = pValorPagar * ((parseFloat(cond.SALDO_SAFRA)   || 0) / 100);
    descontoEntrada = valorEntrada * ((parseFloat(cond.DESCONTO_ENTRADA_SAFRA) || 0) / 100);
    descontoSaldo   = valorSaldo   * ((parseFloat(cond.DESCONTO_SALDO_SAFRA)   || 0) / 100);
  }

  const baseDate = new Date(p.pDataBase);
  const datlan   = new Date(p.pDataBase);

  // ── coleta parcelas em memória → 1 INSERT em batch no final ────────────
  type ParcelaRow = { ordxxx: string; datven: Date; vlrpar: number; pripar: 'S' | 'N' };
  const rows: ParcelaRow[] = [];
  const addParcela = (ordxxx: string, datven: Date, vlrpar: number, pripar: 'S' | 'N') => {
    if (vlrpar > 0.01) rows.push({ ordxxx, datven, vlrpar, pripar });
  };

  const flushParcelas = async () => {
    if (rows.length === 0) return;
    const req = pool.request();
    const vals = rows.map((row, i) => {
      req.input(`im${i}`,  sql.Int,     p.pMovimento);
      req.input(`ic${i}`,  sql.Int,     p.pCliente);
      req.input(`lx${i}`,  sql.VarChar, p.pLoteNumero);
      req.input(`dl${i}`,  sql.Date,    datlan);
      req.input(`cv${i}`,  sql.Int,     p.pClienteVendedor || null);
      req.input(`cl${i}`,  sql.Int,     p.pLeilao);
      req.input(`pp${i}`,  sql.Char,    row.pripar);
      req.input(`cd${i}`,  sql.Int,     p.pLote);
      req.input(`ml${i}`,  sql.Int,     p.pIdMovLote);
      req.input(`dv${i}`,  sql.Date,    row.datven);
      req.input(`vp${i}`,  sql.Decimal(18, 2), row.vlrpar);
      req.input(`ox${i}`,  sql.VarChar, row.ordxxx);
      return `(@im${i},@ic${i},@lx${i},@dl${i},@cv${i},@cl${i},@pp${i},@cd${i},@ml${i},@dv${i},@vp${i},@ox${i})`;
    });
    await req.query(`
      INSERT INTO MOVIMENTO_PARCELAMENTO
        (IDMOV,IDCLI,LOTEXX,DATLAN,CODVEN,CODLEI,PRIPAR,CODLOT,IDMOVLOTE,DATVEN,VLRPAR,ORDXXX)
      VALUES ${vals.join(',')}
    `);
  };

  // ── modo AVISTA ─────────────────────────────────────────────────────────
  if (avista) {
    let venc = new Date(baseDate);
    let isFirst = true;
    for (let x = 1; x <= 15; x++) {
      const k      = x <= 9 ? `PARC0${x}` : `PARC${x}`;
      const parcVal = parseInt(cond[k]) || 0;
      if (parcVal <= 0) continue;

      if (isFirst) {
        venc = entrad ? new Date(baseDate) : incMonth(baseDate, x);
        isFirst = false;
      } else {
        venc = incMonth(venc, 1);
      }

      const ordxxx = ord2(parcVal, qtdpar);
      const vlrpar = totpar > 0 ? (pValorPagar / totpar) * parcVal : 0;
      addParcela(ordxxx, venc, vlrpar, x === 1 ? 'S' : 'N');
    }
    await flushParcelas();

    // Atualiza VLRPAR do lote com valor da 1ª parcela (disponível em memória)
    if (rows.length > 0) {
      await pool.request()
        .input('idMov',  sql.Int,     p.pMovimento)
        .input('vlrpar', sql.Decimal(18, 2), rows[0].vlrpar)
        .query(`UPDATE MOVIMENTO_LOTE SET VLRPAR=@vlrpar WHERE IDMOV=@idMov`);
    }
    return;
  }

  // ── modo INVERT (qtd/valor livres) ──────────────────────────────────────
  if (invert && p.pInvertQtd > 0) {
    let venc = new Date(baseDate);
    for (let x = 1; x <= p.pInvertQtd; x++) {
      if (x > 1) venc = incMonth(venc, 1);
      const ordxxx = ord2(x, p.pInvertQtd);
      addParcela(ordxxx, venc, p.pInvertValor, 'S');
    }
    await flushParcelas();
    return;
  }

  // ── modo NORMAL (PARC01..15 + SALPAR) ───────────────────────────────────
  let format = 0;
  for (let x = 1; x <= 15; x++) {
    const k       = x <= 9 ? `PARC0${x}` : `PARC${x}`;
    const parcVal = parseInt(cond[k]) || 0;
    if (parcVal <= 0) continue;

    format = x * parcVal;
    const ordxxx = ord2(format, qtdpar);

    const vlrcalc = pValorPagar; // já líquido de condição de pagamento + fidelidade
    const parcela = safrax ? (valorEntrada - descontoEntrada) : (vlrcalc / qtdpar);
    const vlrpar  = parcela * parcVal;

    // Datas: primeiras 2 parcelas usam baseDate, restantes incrementam
    let datven: Date;
    if (ordxxx.startsWith('01/') || ordxxx.startsWith('02/')) {
      datven = new Date(baseDate);
    } else {
      datven = incMonth(baseDate, x - 1);
    }

    addParcela(ordxxx, datven, vlrpar, x === 1 ? 'S' : 'N');
  }

  // SALPAR — saldo restante
  if (salpar > 0 && !invert) {
    // Soma das PARC01-15 já coletadas em memória (sem round-trip ao DB)
    const soma = rows.reduce((acc, r) => acc + r.vlrpar, 0);

    const vlrcalc = pValorPagar; // já líquido de condição de pagamento + fidelidade
    let parcela = (vlrcalc - soma) / salpar;
    if (safrax) parcela = valorSaldo - descontoSaldo;

    // Última data das PARC01-15 já em memória, convertida em "quantos meses
    // depois da baseDate" ela cai. As parcelas do saldo continuam contando
    // meses a partir dessa MESMA baseDate — nunca incrementando a partir da
    // parcela anterior, porque incMonth clampa pro último dia do mês de
    // destino: encadear (mês a mês, a partir do resultado anterior) faz a
    // data "travar" no dia 28 depois de atravessar um fevereiro e nunca mais
    // voltar pro dia 31 nos meses que têm 31 dias.
    const lastDate = rows.length > 0
      ? rows.reduce((max, r) => r.datven > max ? r.datven : max, rows[0].datven)
      : new Date(dataLeilao);
    const mesesBase = (lastDate.getUTCFullYear() - baseDate.getUTCFullYear()) * 12
      + (lastDate.getUTCMonth() - baseDate.getUTCMonth());

    let cont = format;
    for (let x = 1; x <= salpar; x++) {
      const venc = (safrax && dataSaldoSafra)
        ? new Date(dataSaldoSafra)
        : incMonth(baseDate, mesesBase + x);
      cont++;
      addParcela(ord2(cont, qtdpar), venc, parcela, 'N');
    }
  }

  await flushParcelas();
}

// ─── atualizar parcela (data/valor) ─────────────────────────────────────────

export async function atualizarParcela(
  id: number, datven?: string, vlrpar?: number,
): Promise<void> {
  const pool = await getPool();
  const req  = pool.request().input('id', sql.Int, id);
  const sets: string[] = [];
  if (datven  !== undefined) { req.input('datven',  sql.Date,       datven);  sets.push('DATVEN=@datven');  }
  if (vlrpar  !== undefined) { req.input('vlrpar',  sql.Decimal(18, 2), vlrpar); sets.push('VLRPAR=@vlrpar');  }
  if (!sets.length) return;
  await req.query(`UPDATE MOVIMENTO_PARCELAMENTO SET ${sets.join(',')} WHERE ID=@id`);
}

// ─── propriedades do comprador ───────────────────────────────────────────────

export { listarPropriedades } from './clientePropriedadeService';

export async function salvarPropriedadeComprador(
  idMov: number, idCli: number, idPropriedade: number,
): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('idMov',          sql.Int, idMov)
    .input('idCli',          sql.Int, idCli)
    .input('idPropriedade',  sql.Int, idPropriedade)
    .query(`UPDATE MOVIMENTO_COMPRADOR SET ID_PROPRIEDADE=@idPropriedade
            WHERE IDMOV=@idMov AND IDCLI=@idCli`);
}

// ─── fatura de compras ──────────────────────────────────────────────────────

export async function dadosFatura(idMov: number) {
  const pool = await getPool();

  const rMov = await pool.request().input('id', sql.Int, idMov).query(`
    SELECT M.ID, M.IDLEILAO, M.CODNOT, M.DATLAN, M.DEFESA,
           L.LEILAO, L.DATLEI, L.COMCOM, L.COMVEN,
           CIDLEI.CIDADE AS CIDADE_LEILAO, CIDLEI.ESTADO AS ESTADO_LEILAO
    FROM MOVIMENTO M
    LEFT JOIN LEILOES L ON L.ID = M.IDLEILAO
    LEFT JOIN CIDADES CIDLEI ON CIDLEI.ID = L.CODCID
    WHERE M.ID = @id
  `);
  if (!rMov.recordset.length) return null;
  const mov = rMov.recordset[0];

  const rLote = await pool.request().input('id', sql.Int, idMov).query(`
    SELECT ML.QTDXXX, ML.VLRPAR, ML.VLRTOT, ML.VLRDES, ML.QTDPAR, ML.COMISS, ML.COMISS_VENDEDOR,
           LO.LOTEXX, LO.DESLOT, LO.RPXXX, LO.SBBXXX, LO.PESOXX, LO.DATNAS, LO.OBSLOT,
           LO.PELAGE, LO.FILIACAO, LO.CATEGO,
           R.DESCRICAO AS DESCRICAORACA, R.ESPECIES,
           VEN.NOMEXX  AS NOME_VENDEDOR,  VEN.CPFXXX  AS CPF_VENDEDOR,
           VEN.ENDERE  AS ENDERE_VENDEDOR, VEN.BAIRRO AS BAIRRO_VENDEDOR,
           VEN.CEPXXX  AS CEP_VENDEDOR,   VEN.CELU_1  AS CELULAR_VENDEDOR,
           VEN.TELRES  AS TELRES_VENDEDOR, VEN.EMAILX  AS EMAIL_VENDEDOR,
           CIDVEN.CIDADE AS CIDADE_VENDEDOR, CIDVEN.ESTADO AS ESTADO_VENDEDOR
    FROM MOVIMENTO_LOTE ML
    LEFT JOIN LOTES LO       ON LO.ID  = ML.IDLOTE
    LEFT JOIN RACAS R        ON R.ID   = LO.RACAXX
    LEFT JOIN CLIENTES VEN   ON VEN.ID = LO.CODVEN
    LEFT JOIN CIDADES CIDVEN ON CIDVEN.ID = VEN.CIDADE
    WHERE ML.IDMOV = @id
  `);

  const rComp = await pool.request().input('id', sql.Int, idMov).query(`
    SELECT MC.ID, MC.IDCLI, MC.IDMOVLOTE, MC.PERCEN, MC.VALORORIGINAL, MC.VALORPAGAR,
           MC.VALORDESCONTO, MC.VALORCOMISSAO, MC.COMISSAO, MC.FORMA_PAGAMENTO,
           MC.VALORCOMISSAOVENDEDOR, MC.COMISSAOVENDEDOR,
           MC.TIPO_DESCONTO_FIDELIDADE, MC.DESCONTO_FIDELIDADE, MC.VALOR_DESCONTO_FIDELIDADE,
           MC.IDCONDPAGTO,
           C.NOMEXX, C.CPFXXX, C.ENDERE, C.BAIRRO, C.CEPXXX, C.CELU_1, C.EMAILX,
           CIDC.CIDADE  AS NOMECIDADE,    CIDC.ESTADO  AS ESTADO,
           CP.DESFIN, CP.QTDPAR AS COND_QTDPAR,
           CPR.NOME_PROPRIEDADE, CPR.CIDADE AS CIDADE_PROP, CPR.ESTADO AS ESTADO_PROP
    FROM MOVIMENTO_COMPRADOR MC
    LEFT JOIN CLIENTES C        ON C.ID   = MC.IDCLI
    LEFT JOIN CIDADES CIDC      ON CIDC.ID = C.CIDADE
    LEFT JOIN CONDICAOPAGTOS CP ON CP.ID   = MC.IDCONDPAGTO
    LEFT JOIN CLIENTES_PROPRIEDADES CPR ON CPR.ID = MC.ID_PROPRIEDADE
    WHERE MC.IDMOV = @id
    ORDER BY MC.ID
  `);

  const rParc = await pool.request().input('id', sql.Int, idMov).query(`
    SELECT IDMOVLOTE, IDCLI, ORDXXX, FORMAT(DATVEN,'dd/MM/yyyy') AS DATVEN_F, VLRPAR, PRIPAR
    FROM MOVIMENTO_PARCELAMENTO
    WHERE IDMOV = @id
    ORDER BY IDMOVLOTE, DATVEN, ORDXXX
  `);

  // Chave composta IDMOVLOTE+IDCLI: quando o lote é rateado entre vários
  // compradores, todos compartilham o mesmo IDMOVLOTE — agrupar só por
  // IDMOVLOTE juntava as parcelas de todos os compradores (chamado #62).
  const parcelasPorMovLote: Record<string, any[]> = {};
  for (const p of rParc.recordset) {
    const key = `${p.IDMOVLOTE}_${p.IDCLI}`;
    if (!parcelasPorMovLote[key]) parcelasPorMovLote[key] = [];
    parcelasPorMovLote[key].push({
      ordxxx: p.ORDXXX,
      datven: p.DATVEN_F,
      vlrpar: p.VLRPAR,
      pripar: p.PRIPAR,
    });
  }

  const l = rLote.recordset[0] || null;

  return {
    id:       mov.ID,
    codnot:   mov.CODNOT,
    datlan:   mov.DATLAN ? new Date(mov.DATLAN).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—',
    leilao:   mov.LEILAO,
    datlei:   mov.DATLEI ? new Date(mov.DATLEI).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—',
    cidadeLeilao: mov.CIDADE_LEILAO,
    estadoLeilao: mov.ESTADO_LEILAO,
    lote: l ? {
      lotexx:        l.LOTEXX,
      deslot:        l.DESLOT,
      rpxxx:         l.RPXXX,
      sbbxxx:        l.SBBXXX,
      pesoxx:        l.PESOXX,
      catego:        l.CATEGO,
      descricaoRaca: l.DESCRICAORACA,
      especies:      l.ESPECIES,
      qtdxxx:        l.QTDXXX,
      vlrpar:        l.VLRPAR,
      vlrtot:        l.VLRTOT,
      vlrdes:        l.VLRDES,
      comiss:        l.COMISS,
      comissVendedor: l.COMISS_VENDEDOR,
      datnas:        l.DATNAS ? new Date(l.DATNAS).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
      obslot:        l.OBSLOT,
      pelagem:       l.PELAGE,
      nomeVendedor:  l.NOME_VENDEDOR,
      cpfVendedor:   l.CPF_VENDEDOR,
      endereVendedor:  l.ENDERE_VENDEDOR,
      bairroVendedor:  l.BAIRRO_VENDEDOR,
      cepVendedor:     l.CEP_VENDEDOR,
      celularVendedor: l.CELULAR_VENDEDOR,
      telresVendedor:  l.TELRES_VENDEDOR,
      emailVendedor:   l.EMAIL_VENDEDOR,
      cidadeVendedor:  l.CIDADE_VENDEDOR,
      estadoVendedor:  l.ESTADO_VENDEDOR,
    } : null,
    compradores: rComp.recordset.map((c: any) => ({
      id:             c.ID,
      idCli:          c.IDCLI,
      nomexx:         c.NOMEXX,
      cpfxxx:         c.CPFXXX,
      endere:         c.ENDERE,
      bairro:         c.BAIRRO,
      cepxxx:         c.CEPXXX,
      celu1:          c.CELU_1,
      emailx:         c.EMAILX,
      nomeCidade:     c.NOMECIDADE,
      nomeEstado:     c.ESTADO,
      percen:         c.PERCEN,
      valorOriginal:  c.VALORORIGINAL,
      valorPagar:     c.VALORPAGAR,
      valorDesconto:  c.VALORDESCONTO,
      valorComissao:  c.VALORCOMISSAO,
      comissao:       c.COMISSAO,
      valorComissaoVendedor: c.VALORCOMISSAOVENDEDOR,
      comissaoVendedor:      c.COMISSAOVENDEDOR,
      tipoDescontoFidelidade:  c.TIPO_DESCONTO_FIDELIDADE,
      descontoFidelidade:      c.DESCONTO_FIDELIDADE,
      valorDescontoFidelidade: c.VALOR_DESCONTO_FIDELIDADE,
      formaPagamento: c.FORMA_PAGAMENTO,
      desfin:         c.DESFIN,
      qtdparCond:     c.COND_QTDPAR != null ? Number(c.COND_QTDPAR) : null,
      nomePropriedade: c.NOME_PROPRIEDADE,
      cidadeProp:      c.CIDADE_PROP,
      estadoProp:      c.ESTADO_PROP,
      parcelas:        parcelasPorMovLote[`${c.IDMOVLOTE}_${c.IDCLI}`] || [],
    })),
  };
}

// ─── fatura unificada (N lotes agrupados por leilão + comprador+vendedor, ──
// ─── só vendedor, ou só comprador — ver `modo`) ─────────────────────────────

export type ModoFaturaUnificada = 'par' | 'vendedor' | 'comprador';

export interface FaturaUnificadaLote {
  idMc: number;
  idMov: number;
  idMovLote: number;
  codnot?: string;
  datlan: string;
  lotexx?: string;
  deslot?: string;
  rpxxx?: string;
  sbbxxx?: string;
  pesoxx?: number;
  catego?: string;
  descricaoRaca?: string;
  especies?: string;
  qtdxxx?: number;
  valorOriginal: number;
  valorPagar: number;
  valorDesconto: number;
  valorDescontoFidelidade: number;
  tipoDescontoFidelidade: 'P' | 'V' | null;
  descontoFidelidade: number;
  valorComissao: number;
  comissao: number;
  formaPagamento?: string;
  desfin?: string;
  qtdparCond: number;
  parcelas: Array<{ ordxxx?: string; datven?: string; vlrpar?: number; pripar?: string }>;
  // Preenchidos só quando modo !== 'par' — identifica a contraparte (comprador
  // quando modo='vendedor', vendedor quando modo='comprador') daquele lote.
  idContraparte?: number;
  nomeContraparte?: string;
  documentoContraparte?: string;
  comissaoVendedor?: number;
  valorComissaoVendedor: number;
}

export interface FaturaUnificadaParte {
  id: number;
  nomexx?: string;
  cpfxxx?: string;
  cnpjxx?: string;
  totalSinal: number;
  totalComissao: number;
}

export interface FaturaUnificadaGrupo {
  idLeilao: number;
  leilao?: string;
  datlei?: string;
  modo: ModoFaturaUnificada;
  // null quando modo='comprador' (o vendedor varia por lote, ver lotes[].nomeContraparte / contrapartes)
  vendedor: {
    id: number; nomexx?: string; cpfxxx?: string; cnpjxx?: string;
    endere?: string; bairro?: string; cepxxx?: string;
    celu1?: string; telres?: string; emailx?: string;
    nomeCidade?: string; nomeEstado?: string;
  } | null;
  // null quando modo='vendedor' (o comprador varia por lote)
  comprador: {
    id: number; nomexx?: string; cpfxxx?: string; cnpjxx?: string;
    endere?: string; bairro?: string; cepxxx?: string;
    celu1?: string; celu2?: string; telcom?: string; telres?: string; emailx?: string;
    nomeCidade?: string; nomeEstado?: string; nomePropriedade?: string;
  } | null;
  // Lista da parte que varia (compradores quando modo='vendedor', vendedores
  // quando modo='comprador'); vazio quando modo='par'.
  contrapartes: FaturaUnificadaParte[];
  lotes: FaturaUnificadaLote[];
  totais: {
    totalCompra: number;
    totalAVista: number;
    totalPromissorias: number;
    totalSinal: number;
    totalComissao: number;
    totalDesconto: number;
    totalDescontoFidelidade: number;
    totalComissaoVendedor: number;
    totalLiquidoVendedor: number;
  };
}

export async function dadosFaturaUnificada(ids: number[], modo: ModoFaturaUnificada = 'par'): Promise<FaturaUnificadaGrupo[]> {
  if (!ids.length) return [];
  const pool = await getPool();
  const req = pool.request();
  const placeholders = ids.map((id, i) => { req.input(`id${i}`, sql.Int, id); return `@id${i}`; });

  const rMc = await req.query(`
    SELECT MC.ID, MC.IDMOV, MC.IDMOVLOTE, MC.IDCLI, MC.VALORORIGINAL, MC.VALORPAGAR,
           MC.VALORDESCONTO, MC.VALORCOMISSAO, MC.COMISSAO, MC.FORMA_PAGAMENTO, MC.IDCONDPAGTO,
           MC.VALORCOMISSAOVENDEDOR, MC.COMISSAOVENDEDOR,
           MC.TIPO_DESCONTO_FIDELIDADE, MC.DESCONTO_FIDELIDADE, MC.VALOR_DESCONTO_FIDELIDADE,
           M.IDLEILAO, M.CODNOT, M.DATLAN,
           LEI.LEILAO, LEI.DATLEI,
           ML.QTDXXX, ML.CODVEN AS ID_VENDEDOR,
           LO.LOTEXX, LO.DESLOT, LO.RPXXX, LO.SBBXXX, LO.PESOXX, LO.CATEGO,
           R.DESCRICAO AS DESCRICAORACA, R.ESPECIES,
           VEN.NOMEXX AS NOME_VENDEDOR, VEN.CPFXXX AS CPF_VENDEDOR, VEN.CNPJXX AS CNPJ_VENDEDOR,
           VEN.ENDERE AS ENDERE_VENDEDOR, VEN.BAIRRO AS BAIRRO_VENDEDOR, VEN.CEPXXX AS CEP_VENDEDOR,
           VEN.CELU_1 AS CELULAR_VENDEDOR, VEN.TELRES AS TELRES_VENDEDOR, VEN.EMAILX AS EMAIL_VENDEDOR,
           CIDVEN.CIDADE AS CIDADE_VENDEDOR, CIDVEN.ESTADO AS ESTADO_VENDEDOR,
           C.NOMEXX, C.CPFXXX, C.CNPJXX, C.ENDERE, C.BAIRRO, C.CEPXXX,
           C.CELU_1, C.CELU_2, C.TELCOM, C.TELRES, C.EMAILX,
           CIDC.CIDADE AS NOMECIDADE, CIDC.ESTADO AS ESTADO,
           CP.DESFIN, CP.QTDPAR AS COND_QTDPAR,
           CPR.NOME_PROPRIEDADE
    FROM MOVIMENTO_COMPRADOR MC
    LEFT JOIN MOVIMENTO M       ON M.ID  = MC.IDMOV
    LEFT JOIN LEILOES LEI       ON LEI.ID = M.IDLEILAO
    LEFT JOIN MOVIMENTO_LOTE ML ON ML.ID  = MC.IDMOVLOTE
    LEFT JOIN LOTES LO          ON LO.ID  = ML.IDLOTE
    LEFT JOIN RACAS R           ON R.ID   = LO.RACAXX
    LEFT JOIN CLIENTES VEN      ON VEN.ID = ML.CODVEN
    LEFT JOIN CIDADES CIDVEN    ON CIDVEN.ID = VEN.CIDADE
    LEFT JOIN CLIENTES C        ON C.ID   = MC.IDCLI
    LEFT JOIN CIDADES CIDC      ON CIDC.ID = C.CIDADE
    LEFT JOIN CONDICAOPAGTOS CP ON CP.ID   = MC.IDCONDPAGTO
    LEFT JOIN CLIENTES_PROPRIEDADES CPR ON CPR.ID = MC.ID_PROPRIEDADE
    WHERE MC.ID IN (${placeholders.join(',')})
    ORDER BY M.IDLEILAO, MC.IDCLI, ML.CODVEN, TRY_CAST(LO.LOTEXX AS INT), LO.LOTEXX
  `);

  const idMovLotes = [...new Set(rMc.recordset.map((r: any) => r.IDMOVLOTE).filter((v: any) => v != null))];
  // Chave composta IDMOVLOTE+IDCLI: quando o lote é rateado entre vários
  // compradores, todos compartilham o mesmo IDMOVLOTE — agrupar só por
  // IDMOVLOTE misturava as parcelas de todos os compradores no PDF de cada
  // um (chamado #62, mesma causa do #61 na Consulta de Vendas).
  const parcelasPorMovLote: Record<string, any[]> = {};
  if (idMovLotes.length) {
    const req2 = pool.request();
    const ph2 = idMovLotes.map((id, i) => { req2.input(`ml${i}`, sql.Int, id as number); return `@ml${i}`; });
    const rParc = await req2.query(`
      SELECT IDMOVLOTE, IDCLI, ORDXXX, FORMAT(DATVEN,'dd/MM/yyyy') AS DATVEN_F, VLRPAR, PRIPAR
      FROM MOVIMENTO_PARCELAMENTO
      WHERE IDMOVLOTE IN (${ph2.join(',')})
      ORDER BY IDMOVLOTE, DATVEN, ORDXXX
    `);
    for (const p of rParc.recordset) {
      const key = `${p.IDMOVLOTE}_${p.IDCLI}`;
      if (!parcelasPorMovLote[key]) parcelasPorMovLote[key] = [];
      parcelasPorMovLote[key].push({ ordxxx: p.ORDXXX, datven: p.DATVEN_F, vlrpar: p.VLRPAR, pripar: p.PRIPAR });
    }
  }

  const grupos = new Map<string, FaturaUnificadaGrupo>();
  const contrapartesPorGrupo = new Map<string, Map<number, FaturaUnificadaParte>>();

  for (const r of rMc.recordset) {
    const idVendedor  = Number(r.ID_VENDEDOR);
    const idComprador = Number(r.IDCLI);
    const chave = modo === 'vendedor' ? `${r.IDLEILAO}_V_${idVendedor}`
                : modo === 'comprador' ? `${r.IDLEILAO}_C_${idComprador}`
                : `${r.IDLEILAO}_${idComprador}_${idVendedor}`;

    if (!grupos.has(chave)) {
      const vendedorInfo = {
        id: idVendedor, nomexx: r.NOME_VENDEDOR, cpfxxx: r.CPF_VENDEDOR, cnpjxx: r.CNPJ_VENDEDOR,
        endere: r.ENDERE_VENDEDOR, bairro: r.BAIRRO_VENDEDOR, cepxxx: r.CEP_VENDEDOR,
        celu1: r.CELULAR_VENDEDOR, telres: r.TELRES_VENDEDOR, emailx: r.EMAIL_VENDEDOR,
        nomeCidade: r.CIDADE_VENDEDOR, nomeEstado: r.ESTADO_VENDEDOR,
      };
      const compradorInfo = {
        id: idComprador, nomexx: r.NOMEXX, cpfxxx: r.CPFXXX, cnpjxx: r.CNPJXX,
        endere: r.ENDERE, bairro: r.BAIRRO, cepxxx: r.CEPXXX,
        celu1: r.CELU_1, celu2: r.CELU_2, telcom: r.TELCOM, telres: r.TELRES, emailx: r.EMAILX,
        nomeCidade: r.NOMECIDADE, nomeEstado: r.ESTADO,
        nomePropriedade: r.NOME_PROPRIEDADE,
      };
      grupos.set(chave, {
        idLeilao: r.IDLEILAO,
        leilao: r.LEILAO,
        datlei: r.DATLEI ? new Date(r.DATLEI).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
        modo,
        vendedor: modo === 'comprador' ? null : vendedorInfo,
        comprador: modo === 'vendedor' ? null : compradorInfo,
        contrapartes: [],
        lotes: [],
        totais: {
          totalCompra: 0, totalAVista: 0, totalPromissorias: 0, totalSinal: 0, totalComissao: 0, totalDesconto: 0,
          totalDescontoFidelidade: 0,
          totalComissaoVendedor: 0, totalLiquidoVendedor: 0,
        },
      });
      contrapartesPorGrupo.set(chave, new Map());
    }

    const grupo = grupos.get(chave)!;
    const parcelas = parcelasPorMovLote[`${r.IDMOVLOTE}_${r.IDCLI}`] || [];
    const qtdparCond = r.COND_QTDPAR != null ? Number(r.COND_QTDPAR) : parcelas.length;
    const aVista = qtdparCond <= 1;
    const valorOriginal = r.VALORORIGINAL || 0;
    const valorPagar     = r.VALORPAGAR    || 0;
    const primeiraParcela = parcelas.find(p => p.pripar === 'S');
    const valorSinal = primeiraParcela ? (primeiraParcela.vlrpar || 0) : valorPagar;

    let idContraparte: number | undefined;
    let nomeContraparte: string | undefined;
    let documentoContraparte: string | undefined;
    if (modo === 'vendedor') {
      idContraparte = idComprador;
      nomeContraparte = r.NOMEXX;
      documentoContraparte = r.CNPJXX || r.CPFXXX;
    } else if (modo === 'comprador') {
      idContraparte = idVendedor;
      nomeContraparte = r.NOME_VENDEDOR;
      documentoContraparte = r.CNPJ_VENDEDOR || r.CPF_VENDEDOR;
    }

    grupo.lotes.push({
      idMc: r.ID, idMov: r.IDMOV, idMovLote: r.IDMOVLOTE, codnot: r.CODNOT,
      datlan: r.DATLAN ? new Date(r.DATLAN).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—',
      lotexx: r.LOTEXX, deslot: r.DESLOT, rpxxx: r.RPXXX, sbbxxx: r.SBBXXX, pesoxx: r.PESOXX,
      catego: r.CATEGO, descricaoRaca: r.DESCRICAORACA, especies: r.ESPECIES, qtdxxx: r.QTDXXX,
      valorOriginal, valorPagar,
      valorDesconto: r.VALORDESCONTO || 0, valorDescontoFidelidade: r.VALOR_DESCONTO_FIDELIDADE || 0,
      tipoDescontoFidelidade: r.TIPO_DESCONTO_FIDELIDADE ?? null, descontoFidelidade: r.DESCONTO_FIDELIDADE || 0,
      valorComissao: r.VALORCOMISSAO || 0, comissao: r.COMISSAO || 0,
      formaPagamento: r.FORMA_PAGAMENTO, desfin: r.DESFIN, qtdparCond,
      parcelas,
      idContraparte, nomeContraparte, documentoContraparte,
      comissaoVendedor: r.COMISSAOVENDEDOR, valorComissaoVendedor: r.VALORCOMISSAOVENDEDOR || 0,
    });

    grupo.totais.totalCompra   += valorOriginal;
    grupo.totais.totalComissao += r.VALORCOMISSAO || 0;
    grupo.totais.totalDesconto += r.VALORDESCONTO || 0;
    grupo.totais.totalDescontoFidelidade += r.VALOR_DESCONTO_FIDELIDADE || 0;
    grupo.totais.totalSinal        += valorSinal;
    grupo.totais.totalPromissorias += valorPagar - valorSinal;
    if (aVista) grupo.totais.totalAVista += valorPagar;
    grupo.totais.totalComissaoVendedor += r.VALORCOMISSAOVENDEDOR || 0;
    grupo.totais.totalLiquidoVendedor  += valorOriginal - (r.VALORCOMISSAOVENDEDOR || 0) - (r.VALORDESCONTO || 0) - (r.VALOR_DESCONTO_FIDELIDADE || 0);

    if (idContraparte != null) {
      const mapaContrapartes = contrapartesPorGrupo.get(chave)!;
      const atual = mapaContrapartes.get(idContraparte) || {
        id: idContraparte, nomexx: nomeContraparte,
        cpfxxx: modo === 'vendedor' ? r.CPFXXX : r.CPF_VENDEDOR,
        cnpjxx: modo === 'vendedor' ? r.CNPJXX : r.CNPJ_VENDEDOR,
        totalSinal: 0, totalComissao: 0,
      };
      atual.totalSinal    += valorSinal;
      atual.totalComissao += r.VALORCOMISSAO || 0;
      mapaContrapartes.set(idContraparte, atual);
    }
  }

  for (const [chave, grupo] of grupos) {
    grupo.contrapartes = Array.from(contrapartesPorGrupo.get(chave)!.values())
      .sort((a, b) => (a.nomexx || '').localeCompare(b.nomexx || ''));
  }

  return Array.from(grupos.values());
}

// ─── atualizar status (encaminhamentos) ─────────────────────────────────────

export async function atualizarStatus(
  id: number,
  campo: 'ST_COMISSAO' | 'ST_PARCELA' | 'ST_CONTRATO' | 'ST_EMBARQUE',
  valor: string,
): Promise<void> {
  const pool = await getPool();
  // o campo vem de VWVendas, o update vai em MOVIMENTO ou MOVIMENTO_COMPRADOR conforme o campo
  await pool.request()
    .input('id',    sql.Int,     id)
    .input('valor', sql.VarChar, valor)
    .query(`UPDATE MOVIMENTO_COMPRADOR SET ${campo}=@valor WHERE IDMOV=@id`);
}

export async function atualizarFormaPagamentoMovimento(idMov: number, forma: string): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('idMov', sql.Int,     idMov)
    .input('forma', sql.VarChar, forma)
    .query(`UPDATE MOVIMENTO_COMPRADOR SET FORMA_PAGAMENTO=@forma WHERE IDMOV=@idMov`);
}

// ─── atualizar informações (sincroniza vendedor do lote) ───────────────────

export async function atualizarInfoLote(idMov: number): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('idMov', sql.Int, idMov)
    .query(`
      UPDATE MOVIMENTO_LOTE
      SET CODVEN = (SELECT CODVEN FROM LOTES WHERE ID = MOVIMENTO_LOTE.IDLOTE)
      WHERE IDMOV = @idMov
    `);
}
