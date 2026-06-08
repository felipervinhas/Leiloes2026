import { getPool, sql } from '../config/database';
import { Lote } from '../models/lote';

function mapRow(c: any): Lote {
  return {
    id: c.ID, lotexx: c.LOTEXX, deslot: c.DESLOT, rpxxx: c.RPXXX, sbbxxx: c.SBBXXX,
    pesoxx: c.PESOXX, tatxxx: c.TATXXX, racaxx: c.RACAXX, idleilao: c.IDLEILAO,
    codven: c.CODVEN, ordem: c.ORDEM, catego: c.CATEGO, vlrins: c.VLRINS,
    pelage: c.PELAGE, datnas: c.DATNAS, obslot: c.OBSLOT, filiacao: c.FILIACAO,
    lanmax: c.LANMAX, urlvideo: c.URLVideo, comentario: c.Comentario,
    multiplo: c.MULTIPLO, vendido: c.VENDIDO, publica: c.PUBLICA,
    tipoSecao: c.TIPO_SECAO, condic: c.CONDIC,
    nomeRaca: c.DESCRICAO, nomeVendedor: c.NOMEXX, nomeLeilao: c.LEILAO,
  };
}

export async function listarLotes(idLeilao?: number, busca?: string): Promise<Lote[]> {
  const pool = await getPool();
  const req = pool.request();
  const filtros: string[] = [];
  if (idLeilao) { req.input('idLeilao', sql.Int, idLeilao); filtros.push(`L.IDLEILAO = @idLeilao`); }
  if (busca) { req.input('busca', sql.VarChar, `%${busca}%`); filtros.push(`(L.DESLOT LIKE @busca OR L.LOTEXX LIKE @busca)`); }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const r = await req.query(`
    SELECT L.*, R.DESCRICAO, C.NOMEXX, LEI.LEILAO
    FROM Lotes L
    LEFT JOIN Racas R ON R.ID = L.RACAXX
    LEFT JOIN Clientes C ON C.ID = L.CODVEN
    LEFT JOIN Leiloes LEI ON LEI.ID = L.IDLEILAO
    ${where} ORDER BY L.IDLEILAO, TRY_CAST(L.LOTEXX AS INT), L.LOTEXX`);
  return r.recordset.map(mapRow);
}

export async function buscarLotePorId(id: number): Promise<Lote | null> {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`
    SELECT L.*, R.DESCRICAO, C.NOMEXX, LEI.LEILAO
    FROM Lotes L
    LEFT JOIN Racas R ON R.ID = L.RACAXX
    LEFT JOIN Clientes C ON C.ID = L.CODVEN
    LEFT JOIN Leiloes LEI ON LEI.ID = L.IDLEILAO
    WHERE L.ID=@id`);
  if (!r.recordset.length) return null;
  return mapRow(r.recordset[0]);
}

export async function criarLote(d: Lote): Promise<number> {
  const pool = await getPool();
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
    .input('condic', sql.Int, d.condic||null)
    .query(`INSERT INTO Lotes (LOTEXX,DESLOT,RPXXX,SBBXXX,PESOXX,TATXXX,RACAXX,IDLEILAO,CODVEN,ORDEM,CATEGO,VLRINS,PELAGE,DATNAS,OBSLOT,FILIACAO,LANMAX,URLVideo,Comentario,MULTIPLO,VENDIDO,PUBLICA,CONDIC)
      OUTPUT INSERTED.ID
      VALUES (@lotexx,@deslot,@rpxxx,@sbbxxx,@pesoxx,@tatxxx,@racaxx,@idleilao,@codven,@ordem,@catego,@vlrins,@pelage,@datnas,@obslot,@filiacao,@lanmax,@urlvideo,@comentario,@multiplo,@vendido,@publica,@condic)`);
  return r.recordset[0].ID;
}

export async function atualizarLote(id: number, d: Lote): Promise<void> {
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
    .query(`UPDATE Lotes SET LOTEXX=@lotexx,DESLOT=@deslot,RPXXX=@rpxxx,SBBXXX=@sbbxxx,PESOXX=@pesoxx,
      TATXXX=@tatxxx,RACAXX=@racaxx,IDLEILAO=@idleilao,CODVEN=@codven,ORDEM=@ordem,CATEGO=@catego,
      VLRINS=@vlrins,PELAGE=@pelage,DATNAS=@datnas,OBSLOT=@obslot,FILIACAO=@filiacao,LANMAX=@lanmax,
      URLVideo=@urlvideo,Comentario=@comentario,MULTIPLO=@multiplo,VENDIDO=@vendido,PUBLICA=@publica,
      CONDIC=@condic WHERE ID=@id`);
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
      (DESLOT,RPXXX,SBBXXX,TATXXX,FILIACAO,DATNAS,CATEGO,RACAXX,OBSLOT,PELAGE,URLVideo,ID_DUPLICADO,VENDIDO,PUBLICA)
      OUTPUT INSERTED.ID
      VALUES
      (@deslot,@rpxxx,@sbbxxx,@tatxxx,@filiacao,@datnas,@catego,@racaxx,@obslot,@pelage,@urlvideo,@iddup,'N','N')`);
  return nr.recordset[0].ID;
}
