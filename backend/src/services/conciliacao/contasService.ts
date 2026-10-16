import { getPool, sql } from '../../config/database';
import { garantirTabelasConciliacao } from './schema';
import { ConciliacaoError } from './acessoService';

export interface ContaBancaria {
  id?: number;
  banco: string;
  agencia?: string | null;
  conta?: string | null;
  acctid: string;
  cnpjTitular?: string | null;
  descricao?: string | null;
  ativa?: boolean;
}

const mapConta = (r: any): ContaBancaria => ({
  id: r.ID, banco: r.BANCO, agencia: r.AGENCIA, conta: r.CONTA, acctid: r.ACCTID,
  cnpjTitular: r.CNPJ_TITULAR, descricao: r.DESCRICAO, ativa: r.ATIVA === 'S',
});

export async function listarContas(): Promise<ContaBancaria[]> {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const r = await pool.request().query(`SELECT * FROM CONC_CONTAS ORDER BY ATIVA DESC, DESCRICAO, ID`);
  return r.recordset.map(mapConta);
}

export async function buscarContaPorAcctid(bancoId: string | null, acctid: string): Promise<ContaBancaria | null> {
  const pool = await getPool();
  const r = await pool.request()
    .input('acctid', sql.VarChar, acctid)
    .input('banco', sql.VarChar, bancoId || '')
    .query(`SELECT TOP 1 * FROM CONC_CONTAS
            WHERE ACCTID = @acctid AND (@banco = '' OR BANCO = @banco)
            ORDER BY ATIVA DESC, ID`);
  return r.recordset[0] ? mapConta(r.recordset[0]) : null;
}

async function validar(c: ContaBancaria, id?: number) {
  if (!c.banco?.trim() || !c.acctid?.trim()) throw new ConciliacaoError(400, 'Informe o banco e o número da conta como vem no extrato (ACCTID)');
  const pool = await getPool();
  const dup = await pool.request()
    .input('acctid', sql.VarChar, c.acctid.trim())
    .input('banco', sql.VarChar, c.banco.trim())
    .input('id', sql.Int, id ?? 0)
    .query(`SELECT ID FROM CONC_CONTAS WHERE ACCTID = @acctid AND BANCO = @banco AND ID <> @id`);
  if (dup.recordset.length) throw new ConciliacaoError(409, 'Esta conta já está cadastrada');
}

const inputs = (req: sql.Request, c: ContaBancaria) => req
  .input('banco', sql.VarChar, c.banco.trim())
  .input('agencia', sql.VarChar, c.agencia || null)
  .input('conta', sql.VarChar, c.conta || null)
  .input('acctid', sql.VarChar, c.acctid.trim())
  .input('cnpj', sql.VarChar, c.cnpjTitular ? c.cnpjTitular.replace(/\D/g, '') : null)
  .input('descricao', sql.VarChar, c.descricao || null)
  .input('ativa', sql.Char, c.ativa === false ? 'N' : 'S');

export async function criarConta(c: ContaBancaria): Promise<number> {
  await garantirTabelasConciliacao();
  await validar(c);
  const pool = await getPool();
  const r = await inputs(pool.request(), c).query(`
    INSERT INTO CONC_CONTAS (BANCO, AGENCIA, CONTA, ACCTID, CNPJ_TITULAR, DESCRICAO, ATIVA)
    OUTPUT INSERTED.ID
    VALUES (@banco, @agencia, @conta, @acctid, @cnpj, @descricao, @ativa)`);
  return r.recordset[0].ID;
}

export async function atualizarConta(id: number, c: ContaBancaria): Promise<void> {
  await garantirTabelasConciliacao();
  await validar(c, id);
  const pool = await getPool();
  await inputs(pool.request(), c).input('id', sql.Int, id).query(`
    UPDATE CONC_CONTAS SET BANCO=@banco, AGENCIA=@agencia, CONTA=@conta, ACCTID=@acctid,
      CNPJ_TITULAR=@cnpj, DESCRICAO=@descricao, ATIVA=@ativa
    WHERE ID=@id`);
}
