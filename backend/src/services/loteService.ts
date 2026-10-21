import { getPool, sql } from '../config/database';
import { getBanco } from '../config/bancoContext';
import { Lote } from '../models/lote';
import { resolveBucket, s3PublicUrl, s3Keys, deletarS3 } from './s3Service';

const colunaQtdAnimaisCriadaPorBanco = new Set<string>();
async function garantirColunaQtdAnimais() {
  const banco = getBanco();
  if (colunaQtdAnimaisCriadaPorBanco.has(banco)) return;
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Lotes' AND COLUMN_NAME='QTDANIMAIS')
      ALTER TABLE Lotes ADD QTDANIMAIS INT NULL;
    -- Rascunho: lote criado ao clicar em "Novo Lote", para já ter ID e poder receber fotos.
    -- Fica preenchido até o primeiro Salvar; rascunho abandonado é apagado depois de 1 dia.
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Lotes' AND COLUMN_NAME='RASCUNHO_EM')
      ALTER TABLE Lotes ADD RASCUNHO_EM DATETIME NULL;
    -- Perímetro escrotal (cm) dos touros: antes ia no meio do comentário (chamado #20).
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Lotes' AND COLUMN_NAME='PERIMETRO_ESCROTAL')
      ALTER TABLE Lotes ADD PERIMETRO_ESCROTAL DECIMAL(5,1) NULL;
  `);
  colunaQtdAnimaisCriadaPorBanco.add(banco);
}

function mapRow(c: any, bucket: string): Lote {
  // Lote duplicado (ID_DUPLICADO aponta pro original) herda a foto do
  // original até que alguém faça upload de uma foto própria pra ele —
  // mesma regra do sistema Delphi (unLotes.pas).
  const idImagem = c.ID_DUPLICADO > 0 ? c.ID_DUPLICADO : c.ID;
  return {
    id: c.ID, lotexx: c.LOTEXX, deslot: c.DESLOT, rpxxx: c.RPXXX, sbbxxx: c.SBBXXX,
    pesoxx: c.PESOXX, tatxxx: c.TATXXX, racaxx: c.RACAXX, idleilao: c.IDLEILAO,
    codven: c.CODVEN, ordem: c.ORDEM, catego: c.CATEGO, vlrins: c.VLRINS,
    pelage: c.PELAGE, datnas: c.DATNAS, obslot: c.OBSLOT, filiacao: c.FILIACAO,
    lanmax: c.LANMAX, urlvideo: c.URLVideo, comentario: c.Comentario,
    multiplo: c.MULTIPLO, vendido: c.VENDIDO, publica: c.PUBLICA, qtdAnimais: c.QTDANIMAIS,
    perimetroEscrotal: c.PERIMETRO_ESCROTAL != null ? Number(c.PERIMETRO_ESCROTAL) : null,
    tipoSecao: c.TIPO_SECAO, condic: c.CONDIC, comcom: c.COMCOM, comven: c.COMVEN,
    nomeRaca: c.DESCRICAO, especies: c.ESPECIES, nomeVendedor: c.NOMEXX, estabelecimento: c.ESTABELECIMENTO, nomeLeilao: c.LEILAO,
    dataLeilao: c.LEI_DATLEI, enderecoLeilao: c.LEI_ENDERE,
    horaInicioLeilao: c.LEI_HORA_INICIO, leiloeiro: c.LEI_LEILOE,
    horaFechamentoPreLeilao: c.LEI_HORA_FECHAMENTO_PRE,
    regulamentoLeilao: c.LEI_REGULAMENTO, observacoesLeilao: c.LEI_OBSERVACOES,
    categoriaLeilao: c.LEI_TIPO, tipoLeilao: c.LEI_TIPO_LEILAO,
    transmissaoLeilao: c.LEI_TRANSMISSAO,
    linkTransmissao1Leilao: c.LEI_LINKTRANSMISSAO1, linkTransmissao2Leilao: c.LEI_LINKTRANSMISSAO2,
    urlCatalogoLeilao: c.LEI_URLCATALOGO,
    comissaoVendedorLeilao: c.LEI_COMVEN, comissaoCompradorLeilao: c.LEI_COMCOM,
    qtdParcelasLeilao: c.LEI_QTDPAR, multiploLeilao: c.LEI_MULTIPLO,
    dataSaldoLeilao: c.LEI_DATA_SALDO,
    cidadeLeilao: c.LEI_CIDADE, estadoLeilao: c.LEI_ESTADO,
    condicaoPagamentoLeilao: c.LEI_CONDICAO_DESC,
    imgLote1: s3PublicUrl(bucket, s3Keys.loteImagem(idImagem, 1)),
  };
}

const SELECT_LOTE = `
    SELECT L.*, R.DESCRICAO, R.ESPECIES, C.NOMEXX,
      (SELECT TOP 1 CP.NOME_PROPRIEDADE FROM CLIENTES_PROPRIEDADES CP WHERE CP.ID_CLIENTE = C.ID ORDER BY CP.ID) AS ESTABELECIMENTO,
      LEI.LEILAO,
      LEI.DATLEI AS LEI_DATLEI, LEI.ENDERE AS LEI_ENDERE,
      LEI.HORA_INICIO AS LEI_HORA_INICIO, LEI.LEILOE AS LEI_LEILOE,
      LEI.HORA_FECHAMENTO_PRE AS LEI_HORA_FECHAMENTO_PRE,
      LEI.rEGULAMENTO AS LEI_REGULAMENTO, LEI.OBSERVACOES AS LEI_OBSERVACOES,
      LEI.TIPO AS LEI_TIPO, LEI.TIPO_LEILAO AS LEI_TIPO_LEILAO,
      LEI.TRANSMISSAO AS LEI_TRANSMISSAO,
      LEI.LINKTRANSMISSAO1 AS LEI_LINKTRANSMISSAO1, LEI.LINKTRANSMISSAO2 AS LEI_LINKTRANSMISSAO2,
      LEI.URLCATALOGO AS LEI_URLCATALOGO,
      LEI.COMVEN AS LEI_COMVEN, LEI.COMCOM AS LEI_COMCOM,
      LEICP.QTDPAR AS LEI_QTDPAR, LEI.MULTIPLO AS LEI_MULTIPLO,
      LEI.DATA_SALDO AS LEI_DATA_SALDO,
      LEICID.CIDADE AS LEI_CIDADE, LEICID.ESTADO AS LEI_ESTADO,
      LEICP.DESFIN AS LEI_CONDICAO_DESC
    FROM Lotes L
    LEFT JOIN Racas R ON R.ID = L.RACAXX
    LEFT JOIN Clientes C ON C.ID = L.CODVEN
    LEFT JOIN Leiloes LEI ON LEI.ID = L.IDLEILAO
    LEFT JOIN Cidades LEICID ON LEICID.ID = TRY_CAST(LEI.CODCID AS INT)
    LEFT JOIN CondicaoPagtos LEICP ON LEICP.ID = LEI.CONDIC`;

/** somenteWebNaoVendidos: filtro da Ordem de Entrada do Delphi (TIPO_SECAO = 'W' e não vendido) — só aplicado pelo controller na Macedo. */
/** 0 é um valor válido (ex.: lance máximo zero) — `v || null` o transformava em vazio. */
function numeroOuNulo(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function listarLotes(idLeilao?: number, busca?: string, somenteWebNaoVendidos = false): Promise<Lote[]> {
  await garantirColunaQtdAnimais();
  const pool = await getPool();
  const req = pool.request();
  const filtros: string[] = [];
  filtros.push('L.RASCUNHO_EM IS NULL');
  if (somenteWebNaoVendidos) filtros.push(`L.TIPO_SECAO = 'W' AND ISNULL(L.VENDIDO, 'N') <> 'S'`);
  if (idLeilao) { req.input('idLeilao', sql.Int, idLeilao); filtros.push(`L.IDLEILAO = @idLeilao`); }
  if (busca) { req.input('busca', sql.VarChar, `%${busca}%`); filtros.push(`(L.DESLOT LIKE @busca OR L.LOTEXX LIKE @busca OR L.RPXXX LIKE @busca OR L.SBBXXX LIKE @busca OR C.NOMEXX LIKE @busca)`); }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const [r, bucket] = await Promise.all([
    req.query(`${SELECT_LOTE} ${where} ORDER BY L.IDLEILAO, TRY_CAST(L.LOTEXX AS INT), L.LOTEXX`),
    resolveBucket(),
  ]);
  return r.recordset.map(c => mapRow(c, bucket));
}

/**
 * Versão paginada de listarLotes — a tabela Lotes tem ~17 mil registros e a
 * consulta sem filtro (usada ao abrir a tela sem buscar nada) chegava a levar
 * minutos pra trafegar o resultado inteiro pela rede até o SQL Server na AWS,
 * derrubando o backend por timeout. Só usada pela tela de Lotes (que navega
 * a base toda); as demais telas (Lances, Ordem de Entrada, Editor de
 * Relatórios) sempre filtram por idLeilao e continuam usando listarLotes().
 */
/** Ordenação da tela de Lotes (clique no título da coluna). Lista fechada: vira SQL direto. */
export type OrdenacaoLotes = { campo: 'lotexx' | 'deslot' | 'nomeVendedor'; direcao: 'asc' | 'desc' };

// Parte numérica do início do lote ("101a" → 101), pra lote com letra não ir pro topo
const NUM_LOTE = `TRY_CAST(LEFT(L.LOTEXX, PATINDEX('%[^0-9]%', L.LOTEXX + 'x') - 1) AS INT)`;

function orderByLotes(ord?: OrdenacaoLotes): string {
  if (!ord) return `L.IDLEILAO, ${NUM_LOTE}, L.LOTEXX`;
  const d = ord.direcao === 'desc' ? 'DESC' : 'ASC';
  switch (ord.campo) {
    case 'lotexx':       return `${NUM_LOTE} ${d}, L.LOTEXX ${d}, L.ID`;
    case 'deslot':       return `LTRIM(L.DESLOT) ${d}, ${NUM_LOTE}, L.ID`;
    case 'nomeVendedor': return `LTRIM(C.NOMEXX) ${d}, ${NUM_LOTE}, L.ID`;
  }
}

export async function listarLotesPaginado(
  idLeilao?: number, busca?: string, page = 1, pageSize = 15, ordenacao?: OrdenacaoLotes
): Promise<{ items: Lote[]; total: number }> {
  await garantirColunaQtdAnimais();
  const pool = await getPool();
  const filtros: string[] = ['L.RASCUNHO_EM IS NULL'];
  if (idLeilao) filtros.push(`L.IDLEILAO = @idLeilao`);
  if (busca)    filtros.push(`(L.DESLOT LIKE @busca OR L.LOTEXX LIKE @busca OR L.RPXXX LIKE @busca OR L.SBBXXX LIKE @busca OR C.NOMEXX LIKE @busca)`);
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  const bindFiltros = (r: sql.Request) => {
    if (idLeilao) r.input('idLeilao', sql.Int, idLeilao);
    if (busca)    r.input('busca', sql.VarChar, `%${busca}%`);
    return r;
  };

  const totalResult = await bindFiltros(pool.request()).query(`SELECT COUNT(*) as total FROM Lotes L LEFT JOIN Clientes C ON C.ID = L.CODVEN ${where}`);
  const total = totalResult.recordset[0].total;

  const offset = Math.max(0, (page - 1) * pageSize);
  const [r, bucket] = await Promise.all([
    bindFiltros(pool.request())
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(`
        ${SELECT_LOTE} ${where}
        ORDER BY ${orderByLotes(ordenacao)}
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `),
    resolveBucket(),
  ]);

  return { items: r.recordset.map(c => mapRow(c, bucket)), total };
}

export async function buscarLotePorId(id: number): Promise<Lote | null> {
  await garantirColunaQtdAnimais();
  const pool = await getPool();
  const [r, bucket] = await Promise.all([
    pool.request().input('id', sql.Int, id).query(`${SELECT_LOTE} WHERE L.ID=@id`),
    resolveBucket(),
  ]);
  if (!r.recordset.length) return null;
  return mapRow(r.recordset[0], bucket);
}

export async function criarLote(d: Lote): Promise<number> {
  await garantirColunaQtdAnimais();
  const pool = await getPool();
  // A coluna ID de Lotes não é IDENTITY (tabela legada do Delphi, onde o ID
  // era atribuído manualmente pela aplicação) — precisamos calcular o
  // próximo valor aqui, senão o INSERT grava ID = NULL.
  const r = await pool.request()
    .input('lotexx', sql.VarChar, d.lotexx).input('deslot', sql.VarChar, d.deslot||null)
    .input('rpxxx', sql.VarChar, d.rpxxx||null).input('sbbxxx', sql.VarChar, d.sbbxxx||null)
    .input('pesoxx', sql.Float, d.pesoxx||null).input('tatxxx', sql.VarChar, d.tatxxx||null)
    .input('racaxx', sql.Int, d.racaxx||null).input('idleilao', sql.Int, d.idleilao||null)
    .input('codven', sql.Int, d.codven||null).input('ordem', sql.VarChar, d.ordem||null)
    .input('catego', sql.VarChar, d.catego).input('vlrins', sql.Float, d.vlrins||null)
    .input('pelage', sql.VarChar, d.pelage||null).input('datnas', sql.Date, d.datnas||null)
    .input('obslot', sql.VarChar, d.obslot||null).input('filiacao', sql.VarChar, d.filiacao||null)
    .input('lanmax', sql.Float, numeroOuNulo(d.lanmax)).input('urlvideo', sql.VarChar, d.urlvideo||null)
    .input('comentario', sql.VarChar, d.comentario||null).input('multiplo', sql.Int, d.multiplo||null)
    .input('vendido', sql.Char, d.vendido||'N').input('publica', sql.Char, d.publica||'N')
    .input('condic', sql.Int, d.condic||null).input('qtdAnimais', sql.Int, d.qtdAnimais||null)
    .input('comcom', sql.Decimal(9, 4), d.comcom ?? null).input('comven', sql.Decimal(9, 4), d.comven ?? null)
    .input('tipoSecao', sql.VarChar, d.tipoSecao || null)
    .input('perimetroEscrotal', sql.Decimal(5, 1), numeroOuNulo(d.perimetroEscrotal))
    .query(`INSERT INTO Lotes (ID,LOTEXX,DESLOT,RPXXX,SBBXXX,PESOXX,TATXXX,RACAXX,IDLEILAO,CODVEN,ORDEM,CATEGO,VLRINS,PELAGE,DATNAS,OBSLOT,FILIACAO,LANMAX,URLVideo,Comentario,MULTIPLO,VENDIDO,PUBLICA,CONDIC,QTDANIMAIS,COMCOM,COMVEN,TIPO_SECAO,PERIMETRO_ESCROTAL)
      OUTPUT INSERTED.ID
      VALUES ((SELECT ISNULL(MAX(ID), 0) + 1 FROM Lotes WITH (UPDLOCK, HOLDLOCK)), @lotexx,@deslot,@rpxxx,@sbbxxx,@pesoxx,@tatxxx,@racaxx,@idleilao,@codven,@ordem,@catego,@vlrins,@pelage,@datnas,@obslot,@filiacao,@lanmax,@urlvideo,@comentario,@multiplo,@vendido,@publica,@condic,@qtdAnimais,@comcom,@comven,@tipoSecao,@perimetroEscrotal)`);
  return r.recordset[0].ID;
}

/** Fotos do lote no S3 (lote_1..4_img_<id>.jpg). */
async function apagarFotosLote(id: number) {
  for (const n of [1, 2, 3, 4] as const) {
    try { await deletarS3(s3Keys.loteImagem(id, n)); } catch { /* foto que não existe */ }
  }
}

/**
 * "Novo Lote" já cria o registro como rascunho (sem leilão, número em branco) para ele
 * ter ID e poder receber fotos antes do primeiro Salvar. Aproveita para apagar
 * rascunhos abandonados há mais de 1 dia (janela fechada sem salvar nem cancelar).
 */
export async function criarRascunhoLote(tipoSecao?: string | null): Promise<number> {
  await garantirColunaQtdAnimais();
  const pool = await getPool();
  const velhos = (await pool.request().query(
    `SELECT ID FROM Lotes WHERE RASCUNHO_EM IS NOT NULL AND RASCUNHO_EM < DATEADD(DAY, -1, GETDATE())`)).recordset;
  for (const v of velhos) await descartarRascunhoLote(v.ID);
  const r = await pool.request().input('tipoSecao', sql.VarChar, tipoSecao || null).query(`
    INSERT INTO Lotes (ID, LOTEXX, CATEGO, VENDIDO, PUBLICA, LANMAX, TIPO_SECAO, RASCUNHO_EM)
    OUTPUT INSERTED.ID
    VALUES ((SELECT ISNULL(MAX(ID), 0) + 1 FROM Lotes WITH (UPDLOCK, HOLDLOCK)), '', 'M', 'N', 'N', 0, @tipoSecao, GETDATE())`);
  return r.recordset[0].ID;
}

/** Cancelar o "Novo Lote": apaga o rascunho e as fotos enviadas para ele. Lote já salvo nunca é apagado aqui. */
export async function descartarRascunhoLote(id: number): Promise<boolean> {
  await garantirColunaQtdAnimais();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`
    DECLARE @apagados TABLE (ID INT);
    DELETE FROM Lotes OUTPUT DELETED.ID INTO @apagados WHERE ID = @id AND RASCUNHO_EM IS NOT NULL;
    SELECT COUNT(*) AS N FROM @apagados;`);
  const apagou = (r.recordset[0]?.N ?? 0) > 0;
  if (apagou) await apagarFotosLote(id);
  return apagou;
}

export async function ehRascunhoLote(id: number): Promise<boolean> {
  await garantirColunaQtdAnimais();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`SELECT RASCUNHO_EM FROM Lotes WHERE ID = @id`);
  return r.recordset[0]?.RASCUNHO_EM != null;
}

export async function atualizarLote(id: number, d: Lote): Promise<void> {
  await garantirColunaQtdAnimais();
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id).input('lotexx', sql.VarChar, d.lotexx)
    .input('deslot', sql.VarChar, d.deslot||null).input('rpxxx', sql.VarChar, d.rpxxx||null)
    .input('sbbxxx', sql.VarChar, d.sbbxxx||null).input('pesoxx', sql.Float, d.pesoxx||null)
    .input('tatxxx', sql.VarChar, d.tatxxx||null).input('racaxx', sql.Int, d.racaxx||null)
    .input('idleilao', sql.Int, d.idleilao||null).input('codven', sql.Int, d.codven||null)
    .input('ordem', sql.VarChar, d.ordem||null).input('catego', sql.VarChar, d.catego)
    .input('vlrins', sql.Float, d.vlrins||null).input('pelage', sql.VarChar, d.pelage||null)
    .input('datnas', sql.Date, d.datnas||null).input('obslot', sql.VarChar, d.obslot||null)
    .input('filiacao', sql.VarChar, d.filiacao||null).input('lanmax', sql.Float, numeroOuNulo(d.lanmax))
    .input('urlvideo', sql.VarChar, d.urlvideo||null).input('comentario', sql.VarChar, d.comentario||null)
    .input('multiplo', sql.Int, d.multiplo||null).input('vendido', sql.Char, d.vendido||'N')
    .input('publica', sql.Char, d.publica||'N').input('condic', sql.Int, d.condic||null)
    .input('qtdAnimais', sql.Int, d.qtdAnimais||null)
    .input('comcom', sql.Decimal(9, 4), d.comcom ?? null).input('comven', sql.Decimal(9, 4), d.comven ?? null)
    .input('perimetroEscrotal', sql.Decimal(5, 1), numeroOuNulo(d.perimetroEscrotal))
    .query(`UPDATE Lotes SET LOTEXX=@lotexx,DESLOT=@deslot,RPXXX=@rpxxx,SBBXXX=@sbbxxx,PESOXX=@pesoxx,
      TATXXX=@tatxxx,RACAXX=@racaxx,IDLEILAO=@idleilao,CODVEN=@codven,ORDEM=@ordem,CATEGO=@catego,
      VLRINS=@vlrins,PELAGE=@pelage,DATNAS=@datnas,OBSLOT=@obslot,FILIACAO=@filiacao,LANMAX=@lanmax,
      URLVideo=@urlvideo,Comentario=@comentario,MULTIPLO=@multiplo,VENDIDO=@vendido,PUBLICA=@publica,
      CONDIC=@condic,QTDANIMAIS=@qtdAnimais,COMCOM=@comcom,COMVEN=@comven,PERIMETRO_ESCROTAL=@perimetroEscrotal,RASCUNHO_EM=NULL WHERE ID=@id`);
}

/**
 * Atualização parcial (só Vendido/Público) — usada pelo Painel do Leiloeiro,
 * que não carrega o registro inteiro como o formulário de edição. Diferente
 * de atualizarLote() (substitui todas as colunas), aqui só altera os campos
 * informados, pra não arriscar apagar o resto do lote com um payload parcial.
 */
export async function atualizarStatusLote(id: number, dados: { vendido?: string; publica?: string }): Promise<void> {
  const pool = await getPool();
  const sets: string[] = [];
  const req = pool.request().input('id', sql.Int, id);
  if (dados.vendido !== undefined) { req.input('vendido', sql.Char, dados.vendido); sets.push('VENDIDO=@vendido'); }
  if (dados.publica !== undefined) { req.input('publica', sql.Char, dados.publica); sets.push('PUBLICA=@publica'); }
  if (!sets.length) return;
  await req.query(`UPDATE Lotes SET ${sets.join(', ')} WHERE ID=@id`);
}

export async function salvarOrdensLotes(lotes: Array<{ id: number; ordem: string | null }>): Promise<void> {
  if (!lotes.length) return;
  const pool = await getPool();
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    for (const l of lotes) {
      await transaction.request()
        .input('id', sql.Int, l.id)
        .input('ordem', sql.VarChar(10), l.ordem || null)
        .query(`UPDATE Lotes SET ORDEM = @ordem WHERE ID = @id`);
    }
    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

export class LoteComVendaError extends Error {
  constructor(msg: string) { super(msg); this.name = 'LoteComVendaError'; }
}

/**
 * Não exclui lote que já tem venda: a venda ficava apontando para um lote que não existe
 * (Knorr, 14/10/2026: lote 56 vendido foi excluído e recriado — a venda ficou em branco, o
 * mapa de médias pôs o lote em "sem categoria" e o "Atualizar Informações" apagou o vendedor).
 */
export async function deletarLote(id: number): Promise<void> {
  const pool = await getPool();
  const vendas = (await pool.request().input('id', sql.Int, id).query(`
    SELECT TOP 3 M.CODNOT FROM MOVIMENTO_LOTE ML JOIN MOVIMENTO M ON M.ID = ML.IDMOV WHERE ML.IDLOTE = @id`)).recordset;
  if (vendas.length) {
    const boletos = vendas.map((v: any) => v.CODNOT).filter(Boolean).join(', ');
    throw new LoteComVendaError(
      `Este lote já foi vendido${boletos ? ` (boleto ${boletos})` : ''} e não pode ser excluído. Corrija os dados no próprio lote, ou exclua a venda antes.`);
  }
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM Lotes WHERE ID=@id`);
}

/** tipoSecao: seção do usuário que está duplicando (Macedo); sem ela, a cópia herda a do original. */
export async function duplicarLote(id: number, tipoSecao?: string | null): Promise<number> {
  await garantirColunaQtdAnimais();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`SELECT * FROM Lotes WHERE ID=@id`);
  if (!r.recordset.length) throw new Error('Lote não encontrado');
  const o = r.recordset[0];
  const nr = await pool.request()
    .input('lotexx',   sql.VarChar, o.LOTEXX   || null)
    .input('deslot',   sql.VarChar, o.DESLOT   || null)
    .input('rpxxx',    sql.VarChar, o.RPXXX    || null)
    .input('sbbxxx',   sql.VarChar, o.SBBXXX   || null)
    .input('pesoxx',   sql.Float,   o.PESOXX   || null)
    .input('tatxxx',   sql.VarChar, o.TATXXX   || null)
    .input('filiacao', sql.VarChar, o.FILIACAO || null)
    .input('datnas',   sql.Date,    o.DATNAS   || null)
    .input('catego',   sql.VarChar, o.CATEGO   || null)
    .input('racaxx',   sql.Int,     o.RACAXX   || null)
    .input('idleilao', sql.Int,     o.IDLEILAO || null)
    .input('codven',   sql.Int,     o.CODVEN   || null)
    .input('ordem',    sql.VarChar, o.ORDEM    || null)
    .input('vlrins',   sql.Float,   o.VLRINS   || null)
    .input('lanmax',   sql.Float,   numeroOuNulo(o.LANMAX))
    .input('obslot',   sql.VarChar, o.OBSLOT   || null)
    .input('pelage',   sql.VarChar, o.PELAGE   || null)
    .input('urlvideo', sql.VarChar, o.URLVideo || null)
    .input('comentario', sql.VarChar, o.Comentario || null)
    .input('multiplo', sql.Int,     o.MULTIPLO || null)
    .input('condic',   sql.Int,     o.CONDIC   || null)
    .input('qtdAnimais', sql.Int,   o.QTDANIMAIS || null)
    .input('comcom',   sql.Decimal(9, 4), o.COMCOM ?? null)
    .input('comven',   sql.Decimal(9, 4), o.COMVEN ?? null)
    .input('iddup',    sql.Int,     id)
    .input('tipoSecao', sql.VarChar, tipoSecao || o.TIPO_SECAO || null)
    .input('perimetroEscrotal', sql.Decimal(5, 1), numeroOuNulo(o.PERIMETRO_ESCROTAL))
    .query(`INSERT INTO Lotes
      (ID,LOTEXX,DESLOT,RPXXX,SBBXXX,PESOXX,TATXXX,FILIACAO,DATNAS,CATEGO,RACAXX,IDLEILAO,CODVEN,ORDEM,VLRINS,LANMAX,OBSLOT,PELAGE,URLVideo,Comentario,MULTIPLO,CONDIC,QTDANIMAIS,COMCOM,COMVEN,ID_DUPLICADO,VENDIDO,PUBLICA,TIPO_SECAO,PERIMETRO_ESCROTAL)
      OUTPUT INSERTED.ID
      VALUES
      ((SELECT ISNULL(MAX(ID), 0) + 1 FROM Lotes WITH (UPDLOCK, HOLDLOCK)), @lotexx,@deslot,@rpxxx,@sbbxxx,@pesoxx,@tatxxx,@filiacao,@datnas,@catego,@racaxx,@idleilao,@codven,@ordem,@vlrins,@lanmax,@obslot,@pelage,@urlvideo,@comentario,@multiplo,@condic,@qtdAnimais,@comcom,@comven,@iddup,'N','N',@tipoSecao,@perimetroEscrotal)`);
  return nr.recordset[0].ID;
}
