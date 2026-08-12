import { getPool, sql } from '../config/database';
import { getBanco } from '../config/bancoContext';
import { Lote } from '../models/lote';
import { resolveBucket, s3PublicUrl, s3Keys } from './s3Service';

const colunaQtdAnimaisCriadaPorBanco = new Set<string>();
async function garantirColunaQtdAnimais() {
  const banco = getBanco();
  if (colunaQtdAnimaisCriadaPorBanco.has(banco)) return;
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Lotes' AND COLUMN_NAME='QTDANIMAIS')
      ALTER TABLE Lotes ADD QTDANIMAIS INT NULL
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
    tipoSecao: c.TIPO_SECAO, condic: c.CONDIC,
    nomeRaca: c.DESCRICAO, nomeVendedor: c.NOMEXX, nomeLeilao: c.LEILAO,
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
    SELECT L.*, R.DESCRICAO, C.NOMEXX, LEI.LEILAO,
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

export async function listarLotes(idLeilao?: number, busca?: string): Promise<Lote[]> {
  await garantirColunaQtdAnimais();
  const pool = await getPool();
  const req = pool.request();
  const filtros: string[] = [];
  if (idLeilao) { req.input('idLeilao', sql.Int, idLeilao); filtros.push(`L.IDLEILAO = @idLeilao`); }
  if (busca) { req.input('busca', sql.VarChar, `%${busca}%`); filtros.push(`(L.DESLOT LIKE @busca OR L.LOTEXX LIKE @busca)`); }
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
export async function listarLotesPaginado(
  idLeilao?: number, busca?: string, page = 1, pageSize = 15
): Promise<{ items: Lote[]; total: number }> {
  await garantirColunaQtdAnimais();
  const pool = await getPool();
  const filtros: string[] = [];
  if (idLeilao) filtros.push(`L.IDLEILAO = @idLeilao`);
  if (busca)    filtros.push(`(L.DESLOT LIKE @busca OR L.LOTEXX LIKE @busca)`);
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  const bindFiltros = (r: sql.Request) => {
    if (idLeilao) r.input('idLeilao', sql.Int, idLeilao);
    if (busca)    r.input('busca', sql.VarChar, `%${busca}%`);
    return r;
  };

  const totalResult = await bindFiltros(pool.request()).query(`SELECT COUNT(*) as total FROM Lotes L ${where}`);
  const total = totalResult.recordset[0].total;

  const offset = Math.max(0, (page - 1) * pageSize);
  const [r, bucket] = await Promise.all([
    bindFiltros(pool.request())
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(`
        ${SELECT_LOTE} ${where}
        ORDER BY L.IDLEILAO, TRY_CAST(L.LOTEXX AS INT), L.LOTEXX
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
    .input('lanmax', sql.Float, d.lanmax||null).input('urlvideo', sql.VarChar, d.urlvideo||null)
    .input('comentario', sql.VarChar, d.comentario||null).input('multiplo', sql.Int, d.multiplo||null)
    .input('vendido', sql.Char, d.vendido||'N').input('publica', sql.Char, d.publica||'N')
    .input('condic', sql.Int, d.condic||null).input('qtdAnimais', sql.Int, d.qtdAnimais||null)
    .query(`INSERT INTO Lotes (ID,LOTEXX,DESLOT,RPXXX,SBBXXX,PESOXX,TATXXX,RACAXX,IDLEILAO,CODVEN,ORDEM,CATEGO,VLRINS,PELAGE,DATNAS,OBSLOT,FILIACAO,LANMAX,URLVideo,Comentario,MULTIPLO,VENDIDO,PUBLICA,CONDIC,QTDANIMAIS)
      OUTPUT INSERTED.ID
      VALUES ((SELECT ISNULL(MAX(ID), 0) + 1 FROM Lotes WITH (UPDLOCK, HOLDLOCK)), @lotexx,@deslot,@rpxxx,@sbbxxx,@pesoxx,@tatxxx,@racaxx,@idleilao,@codven,@ordem,@catego,@vlrins,@pelage,@datnas,@obslot,@filiacao,@lanmax,@urlvideo,@comentario,@multiplo,@vendido,@publica,@condic,@qtdAnimais)`);
  return r.recordset[0].ID;
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
    .input('filiacao', sql.VarChar, d.filiacao||null).input('lanmax', sql.Float, d.lanmax||null)
    .input('urlvideo', sql.VarChar, d.urlvideo||null).input('comentario', sql.VarChar, d.comentario||null)
    .input('multiplo', sql.Int, d.multiplo||null).input('vendido', sql.Char, d.vendido||'N')
    .input('publica', sql.Char, d.publica||'N').input('condic', sql.Int, d.condic||null)
    .input('qtdAnimais', sql.Int, d.qtdAnimais||null)
    .query(`UPDATE Lotes SET LOTEXX=@lotexx,DESLOT=@deslot,RPXXX=@rpxxx,SBBXXX=@sbbxxx,PESOXX=@pesoxx,
      TATXXX=@tatxxx,RACAXX=@racaxx,IDLEILAO=@idleilao,CODVEN=@codven,ORDEM=@ordem,CATEGO=@catego,
      VLRINS=@vlrins,PELAGE=@pelage,DATNAS=@datnas,OBSLOT=@obslot,FILIACAO=@filiacao,LANMAX=@lanmax,
      URLVideo=@urlvideo,Comentario=@comentario,MULTIPLO=@multiplo,VENDIDO=@vendido,PUBLICA=@publica,
      CONDIC=@condic,QTDANIMAIS=@qtdAnimais WHERE ID=@id`);
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

export async function deletarLote(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM Lotes WHERE ID=@id`);
}

export async function duplicarLote(id: number): Promise<number> {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`SELECT * FROM Lotes WHERE ID=@id`);
  if (!r.recordset.length) throw new Error('Lote não encontrado');
  const o = r.recordset[0];
  const nr = await pool.request()
    .input('deslot',   sql.VarChar, o.DESLOT   || null)
    .input('rpxxx',    sql.VarChar, o.RPXXX    || null)
    .input('sbbxxx',   sql.VarChar, o.SBBXXX   || null)
    .input('tatxxx',   sql.VarChar, o.TATXXX   || null)
    .input('filiacao', sql.VarChar, o.FILIACAO || null)
    .input('datnas',   sql.Date,    o.DATNAS   || null)
    .input('catego',   sql.VarChar, o.CATEGO   || null)
    .input('racaxx',   sql.Int,     o.RACAXX   || null)
    .input('obslot',   sql.VarChar, o.OBSLOT   || null)
    .input('pelage',   sql.VarChar, o.PELAGE   || null)
    .input('urlvideo', sql.VarChar, o.URLVideo || null)
    .input('iddup',    sql.Int,     id)
    .query(`INSERT INTO Lotes
      (ID,DESLOT,RPXXX,SBBXXX,TATXXX,FILIACAO,DATNAS,CATEGO,RACAXX,OBSLOT,PELAGE,URLVideo,ID_DUPLICADO,VENDIDO,PUBLICA)
      OUTPUT INSERTED.ID
      VALUES
      ((SELECT ISNULL(MAX(ID), 0) + 1 FROM Lotes WITH (UPDLOCK, HOLDLOCK)), @deslot,@rpxxx,@sbbxxx,@tatxxx,@filiacao,@datnas,@catego,@racaxx,@obslot,@pelage,@urlvideo,@iddup,'N','N')`);
  return nr.recordset[0].ID;
}
