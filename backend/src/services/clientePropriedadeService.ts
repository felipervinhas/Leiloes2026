import { getPool, sql } from '../config/database';

export interface ClientePropriedade {
  idCliente: number;
  inscricao?: string;
  nomePropriedade?: string;
  cidade?: string;
  estado?: string;
  localidade?: string;
  codigoPropriedade?: string;
}

export async function listarPropriedades(idCliente: number) {
  const pool = await getPool();
  const r = await pool.request()
    .input('idCliente', sql.Int, idCliente)
    .query(`SELECT * FROM CLIENTES_PROPRIEDADES WHERE ID_CLIENTE=@idCliente ORDER BY NOME_PROPRIEDADE`);
  return r.recordset.map((row: any) => ({
    id: row.ID,
    idCliente: row.ID_CLIENTE,
    inscricao: row.INSCRICAO,
    nomePropriedade: row.NOME_PROPRIEDADE,
    cidade: row.CIDADE,
    estado: row.ESTADO,
    localidade: row.LOCALIDADE,
    codigoPropriedade: row.CODIGO_PROPRIEDADE,
  }));
}

export async function criarPropriedade(d: ClientePropriedade): Promise<number> {
  const pool = await getPool();
  const r = await pool.request()
    .input('idCliente', sql.Int, d.idCliente)
    .input('inscricao', sql.VarChar, d.inscricao || null)
    .input('nomePropriedade', sql.VarChar, d.nomePropriedade || null)
    .input('cidade', sql.VarChar, d.cidade || null)
    .input('estado', sql.VarChar, d.estado || null)
    .input('localidade', sql.VarChar, d.localidade || null)
    .input('codigoPropriedade', sql.VarChar, d.codigoPropriedade || null)
    .query(`INSERT INTO CLIENTES_PROPRIEDADES (ID_CLIENTE,INSCRICAO,NOME_PROPRIEDADE,CIDADE,ESTADO,LOCALIDADE,CODIGO_PROPRIEDADE)
      OUTPUT INSERTED.ID
      VALUES (@idCliente,@inscricao,@nomePropriedade,@cidade,@estado,@localidade,@codigoPropriedade)`);
  return r.recordset[0].ID;
}

export async function atualizarPropriedade(id: number, d: ClientePropriedade): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('inscricao', sql.VarChar, d.inscricao || null)
    .input('nomePropriedade', sql.VarChar, d.nomePropriedade || null)
    .input('cidade', sql.VarChar, d.cidade || null)
    .input('estado', sql.VarChar, d.estado || null)
    .input('localidade', sql.VarChar, d.localidade || null)
    .input('codigoPropriedade', sql.VarChar, d.codigoPropriedade || null)
    .query(`UPDATE CLIENTES_PROPRIEDADES SET
      INSCRICAO=@inscricao, NOME_PROPRIEDADE=@nomePropriedade, CIDADE=@cidade,
      ESTADO=@estado, LOCALIDADE=@localidade, CODIGO_PROPRIEDADE=@codigoPropriedade
      WHERE ID=@id`);
}

export async function deletarPropriedade(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM CLIENTES_PROPRIEDADES WHERE ID=@id`);
}
