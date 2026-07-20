import { getPool, sql } from '../config/database';
import { CondicaoPagto } from '../models/condicaoPagto';

function mapRow(c: any): CondicaoPagto {
  return {
    id: c.ID, desfin: c.DESFIN, przmed: c.PRZMED, qtdpar: c.QTDPAR,
    parc01: c.PARC01, parc02: c.PARC02, parc03: c.PARC03, parc04: c.PARC04,
    parc05: c.PARC05, parc06: c.PARC06, parc07: c.PARC07, parc08: c.PARC08,
    parc09: c.PARC09, parc10: c.PARC10, parc11: c.PARC11, parc12: c.PARC12,
    parc13: c.PARC13, parc14: c.PARC14, parc15: c.PARC15,
    salpar: c.SALPAR, avista: c.AVISTA, entrad: c.ENTRAD,
    invert: c.INVERT, safrax: c.SAFRAX, descon: c.DESCON,
    entradaSafra: c.ENTRADA_SAFRA, descontoEntradaSafra: c.DESCONTO_ENTRADA_SAFRA,
    descontoSaldoSafra: c.DESCONTO_SALDO_SAFRA, saldoSafra: c.SALDO_SAFRA,
  };
}

export async function listarCondicoes(busca?: string): Promise<CondicaoPagto[]> {
  const pool = await getPool();
  const req = pool.request();
  let where = '';
  if (busca) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    where = `WHERE DESFIN LIKE @busca`;
  }
  const r = await req.query(`SELECT * FROM CondicaoPagtos ${where} ORDER BY DESFIN`);
  return r.recordset.map(mapRow);
}

export async function buscarCondicaoPorId(id: number): Promise<CondicaoPagto | null> {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`SELECT * FROM CondicaoPagtos WHERE ID=@id`);
  if (!r.recordset.length) return null;
  return mapRow(r.recordset[0]);
}

type ParcKey = keyof Omit<CondicaoPagto, 'id'>;
const PARC_KEYS = Array.from({ length: 15 }, (_, i) => `parc${String(i + 1).padStart(2, '0')}`) as ParcKey[];

function bindParcelas(req: sql.Request, d: Omit<CondicaoPagto, 'id'>) {
  for (const key of PARC_KEYS) {
    req.input(key, sql.VarChar, (d[key] as string) || null);
  }
}

export async function criarCondicao(d: Omit<CondicaoPagto, 'id'>): Promise<number> {
  const pool = await getPool();
  const req = pool.request()
    .input('desfin', sql.VarChar, d.desfin).input('przmed', sql.Int, d.przmed || null)
    .input('qtdpar', sql.VarChar, d.qtdpar || null).input('avista', sql.VarChar, d.avista || null)
    .input('entrad', sql.VarChar, d.entrad || null).input('invert', sql.VarChar, d.invert || null)
    .input('safrax', sql.VarChar, d.safrax || null).input('descon', sql.VarChar, d.descon || null)
    .input('salpar', sql.VarChar, d.salpar || null)
    .input('entradaSafra', sql.Decimal, d.entradaSafra || null)
    .input('descontoEntradaSafra', sql.Decimal, d.descontoEntradaSafra || null)
    .input('saldoSafra', sql.Decimal, d.saldoSafra || null)
    .input('descontoSaldoSafra', sql.Decimal, d.descontoSaldoSafra || null);
  bindParcelas(req, d);
  const parcCols = PARC_KEYS.map(k => k.toUpperCase()).join(',');
  const parcVals = PARC_KEYS.map(k => `@${k}`).join(',');
  const r = await req.query(`INSERT INTO CondicaoPagtos
      (DESFIN,PRZMED,QTDPAR,AVISTA,ENTRAD,INVERT,SAFRAX,DESCON,SALPAR,
       ENTRADA_SAFRA,DESCONTO_ENTRADA_SAFRA,SALDO_SAFRA,DESCONTO_SALDO_SAFRA,${parcCols})
      OUTPUT INSERTED.ID
      VALUES (@desfin,@przmed,@qtdpar,@avista,@entrad,@invert,@safrax,@descon,@salpar,
              @entradaSafra,@descontoEntradaSafra,@saldoSafra,@descontoSaldoSafra,${parcVals})`);
  return r.recordset[0].ID;
}

export async function atualizarCondicao(id: number, d: Omit<CondicaoPagto, 'id'>): Promise<void> {
  const pool = await getPool();
  const req = pool.request()
    .input('id', sql.Int, id)
    .input('desfin', sql.VarChar, d.desfin).input('przmed', sql.Int, d.przmed || null)
    .input('qtdpar', sql.VarChar, d.qtdpar || null).input('avista', sql.VarChar, d.avista || null)
    .input('entrad', sql.VarChar, d.entrad || null).input('invert', sql.VarChar, d.invert || null)
    .input('safrax', sql.VarChar, d.safrax || null).input('descon', sql.VarChar, d.descon || null)
    .input('salpar', sql.VarChar, d.salpar || null)
    .input('entradaSafra', sql.Decimal, d.entradaSafra || null)
    .input('descontoEntradaSafra', sql.Decimal, d.descontoEntradaSafra || null)
    .input('saldoSafra', sql.Decimal, d.saldoSafra || null)
    .input('descontoSaldoSafra', sql.Decimal, d.descontoSaldoSafra || null);
  bindParcelas(req, d);
  const parcSets = PARC_KEYS.map(k => `${k.toUpperCase()}=@${k}`).join(',');
  await req.query(`UPDATE CondicaoPagtos SET DESFIN=@desfin,PRZMED=@przmed,QTDPAR=@qtdpar,AVISTA=@avista,ENTRAD=@entrad,
      INVERT=@invert,SAFRAX=@safrax,DESCON=@descon,SALPAR=@salpar,
      ENTRADA_SAFRA=@entradaSafra,DESCONTO_ENTRADA_SAFRA=@descontoEntradaSafra,
      SALDO_SAFRA=@saldoSafra,DESCONTO_SALDO_SAFRA=@descontoSaldoSafra,
      ${parcSets}
      WHERE ID=@id`);
}

export async function deletarCondicao(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM CondicaoPagtos WHERE ID=@id`);
}
