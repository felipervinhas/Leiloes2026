import { getPool, sql } from '../config/database';
import { Leilao } from '../models/leilao';

function mapRow(c: any): Leilao {
  return {
    id: c.ID, leilao: c.LEILAO, endere: c.ENDERE, codcid: c.CODCID,
    datlei: c.DATLEI, leiloe: c.LEILOE, condic: c.CONDIC,
    comven: c.COMVEN, comcom: c.COMCOM, ativox: c.ATIVOX,
    urlcatalogo: c.URLCATALOGO, linktransmissao1: c.LINKTRANSMISSAO1, linktransmissao2: c.LINKTRANSMISSAO2,
    tipoLeilao: c.TIPO_LEILAO, transmissao: c.TRANSMISSAO,
    horaInicio: c.HORA_INICIO, horaFechamentoPre: c.HORA_FECHAMENTO_PRE,
    regulamento: c.rEGULAMENTO, multiplo: c.MULTIPLO, observacoes: c.OBSERVACOES,
    tipo: c.TIPO, dataSaldo: c.DATA_SALDO,
    nomeCidade: c.NOMECIDADE, nomeEstado: c.NOMEESTADO, descricaoCondicao: c.DESFIN,
  };
}

export async function listarLeiloes(busca?: string, ativo?: string): Promise<Leilao[]> {
  const pool = await getPool();
  const req = pool.request();
  const filtros: string[] = [];
  if (busca) { req.input('busca', sql.VarChar, `%${busca}%`); filtros.push(`L.LEILAO LIKE @busca`); }
  if (ativo) { req.input('ativo', sql.VarChar, ativo); filtros.push(`L.ATIVOX = @ativo`); }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const r = await req.query(`
    SELECT L.*, CID.CIDADE AS NOMECIDADE, CID.ESTADO AS NOMEESTADO, CP.DESFIN
    FROM Leiloes L
    LEFT JOIN Cidades CID ON CID.ID = TRY_CAST(L.CODCID AS INT)
    LEFT JOIN CondicaoPagtos CP ON CP.ID = L.CONDIC
    ${where} ORDER BY L.DATLEI DESC`);
  return r.recordset.map(mapRow);
}

export async function buscarLeilaoPorId(id: number): Promise<Leilao | null> {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`
    SELECT L.*, CID.CIDADE AS NOMECIDADE, CID.ESTADO AS NOMEESTADO, CP.DESFIN
    FROM Leiloes L
    LEFT JOIN Cidades CID ON CID.ID = TRY_CAST(L.CODCID AS INT)
    LEFT JOIN CondicaoPagtos CP ON CP.ID = L.CONDIC
    WHERE L.ID=@id`);
  if (!r.recordset.length) return null;
  return mapRow(r.recordset[0]);
}

export async function criarLeilao(d: Omit<Leilao, 'id' | 'nomeCidade' | 'nomeEstado' | 'descricaoCondicao'>): Promise<number> {
  const pool = await getPool();
  const r = await pool.request()
    .input('leilao', sql.VarChar, d.leilao).input('endere', sql.VarChar, d.endere||null)
    .input('codcid', sql.VarChar, d.codcid||null).input('datlei', sql.Date, d.datlei||null)
    .input('leiloe', sql.VarChar, d.leiloe||null).input('condic', sql.Int, d.condic||null)
    .input('comven', sql.Decimal, d.comven||null).input('comcom', sql.Decimal, d.comcom||null)
    .input('ativox', sql.VarChar, d.ativox||'S').input('horaInicio', sql.VarChar, d.horaInicio||null)
    .input('horaFechamento', sql.VarChar, d.horaFechamentoPre||null)
    .input('tipoLeilao', sql.VarChar, d.tipoLeilao||null).input('multiplo', sql.Int, d.multiplo||null)
    .input('regulamento', sql.VarChar, d.regulamento||null).input('observacoes', sql.VarChar, d.observacoes||null)
    .input('urlcatalogo', sql.VarChar, d.urlcatalogo||null).input('link1', sql.VarChar, d.linktransmissao1||null)
    .input('link2', sql.VarChar, d.linktransmissao2||null).input('dataSaldo', sql.Date, d.dataSaldo||null)
    .query(`INSERT INTO Leiloes (LEILAO,ENDERE,CODCID,DATLEI,LEILOE,CONDIC,COMVEN,COMCOM,ATIVOX,HORA_INICIO,HORA_FECHAMENTO_PRE,TIPO_LEILAO,MULTIPLO,rEGULAMENTO,OBSERVACOES,URLCATALOGO,LINKTRANSMISSAO1,LINKTRANSMISSAO2,DATA_SALDO)
      OUTPUT INSERTED.ID
      VALUES (@leilao,@endere,@codcid,@datlei,@leiloe,@condic,@comven,@comcom,@ativox,@horaInicio,@horaFechamento,@tipoLeilao,@multiplo,@regulamento,@observacoes,@urlcatalogo,@link1,@link2,@dataSaldo)`);
  return r.recordset[0].ID;
}

export async function atualizarLeilao(id: number, d: Omit<Leilao, 'id' | 'nomeCidade' | 'nomeEstado' | 'descricaoCondicao'>): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id).input('leilao', sql.VarChar, d.leilao)
    .input('endere', sql.VarChar, d.endere||null).input('codcid', sql.VarChar, d.codcid||null)
    .input('datlei', sql.Date, d.datlei||null).input('leiloe', sql.VarChar, d.leiloe||null)
    .input('condic', sql.Int, d.condic||null).input('comven', sql.Decimal, d.comven||null)
    .input('comcom', sql.Decimal, d.comcom||null).input('ativox', sql.VarChar, d.ativox||'S')
    .input('horaInicio', sql.VarChar, d.horaInicio||null).input('horaFechamento', sql.VarChar, d.horaFechamentoPre||null)
    .input('tipoLeilao', sql.VarChar, d.tipoLeilao||null).input('multiplo', sql.Int, d.multiplo||null)
    .input('regulamento', sql.VarChar, d.regulamento||null).input('observacoes', sql.VarChar, d.observacoes||null)
    .input('urlcatalogo', sql.VarChar, d.urlcatalogo||null).input('link1', sql.VarChar, d.linktransmissao1||null)
    .input('link2', sql.VarChar, d.linktransmissao2||null).input('dataSaldo', sql.Date, d.dataSaldo||null)
    .query(`UPDATE Leiloes SET LEILAO=@leilao,ENDERE=@endere,CODCID=@codcid,DATLEI=@datlei,LEILOE=@leiloe,
      CONDIC=@condic,COMVEN=@comven,COMCOM=@comcom,ATIVOX=@ativox,HORA_INICIO=@horaInicio,
      HORA_FECHAMENTO_PRE=@horaFechamento,TIPO_LEILAO=@tipoLeilao,MULTIPLO=@multiplo,
      rEGULAMENTO=@regulamento,OBSERVACOES=@observacoes,URLCATALOGO=@urlcatalogo,
      LINKTRANSMISSAO1=@link1,LINKTRANSMISSAO2=@link2,DATA_SALDO=@dataSaldo WHERE ID=@id`);
}

export async function deletarLeilao(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM Leiloes WHERE ID=@id`);
}
