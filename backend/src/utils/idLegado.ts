import { getPool, sql } from '../config/database';
import { getBanco } from '../config/bancoContext';

/**
 * Tabelas legadas do Delphi em que a coluna ID nem sempre é IDENTITY — varia por
 * banco (ex.: Clientes é IDENTITY na Knorr/Macedo/G2, mas no LoteRural o ID é
 * atribuído pela aplicação). Um INSERT sem ID falha com "Cannot insert NULL into
 * column 'ID'" onde não é IDENTITY; e informar o ID falha onde É IDENTITY. Por isso
 * o INSERT precisa saber, por banco, qual é o caso.
 */
const cache = new Map<string, boolean>();

export async function idEhIdentity(tabela: string): Promise<boolean> {
  const chave = `${getBanco()}:${tabela.toUpperCase()}`;
  const emCache = cache.get(chave);
  if (emCache !== undefined) return emCache;
  const pool = await getPool();
  const r = await pool.request().input('tabela', sql.VarChar, tabela).query(`
    SELECT c.is_identity FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(@tabela) AND c.name = 'ID'`);
  const identity = !!r.recordset[0]?.is_identity;
  cache.set(chave, identity);
  return identity;
}

/**
 * Trechos pra montar o INSERT: `coluna` vai na lista de colunas e `valor` em VALUES.
 * Vazios quando o banco gera o ID; senão calcula MAX(ID)+1 com trava (UPDLOCK,
 * HOLDLOCK) pra dois cadastros simultâneos não pegarem o mesmo número.
 */
export async function idParaInsert(tabela: string): Promise<{ coluna: string; valor: string }> {
  if (await idEhIdentity(tabela)) return { coluna: '', valor: '' };
  return {
    coluna: 'ID,',
    valor: `(SELECT ISNULL(MAX(ID), 0) + 1 FROM ${tabela} WITH (UPDLOCK, HOLDLOCK)),`,
  };
}
