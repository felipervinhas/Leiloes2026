import { getPool, sql } from '../config/database';
import { OcorrenciaCliente } from '../models/ocorrenciaCliente';

export async function listarOcorrencias(idCliente: number): Promise<OcorrenciaCliente[]> {
  const pool = await getPool();
  const r = await pool.request()
    .input('idCliente', sql.Int, idCliente)
    .query(`SELECT CODIGO, CODIGO_CLIENTE, DATA_OCORRENCIA, OCORRENCIA
      FROM OCORRENCIAS WHERE CODIGO_CLIENTE=@idCliente ORDER BY DATA_OCORRENCIA DESC, CODIGO DESC`);
  return r.recordset.map((row: any) => ({
    id: row.CODIGO,
    idCliente: row.CODIGO_CLIENTE,
    dataOcorrencia: row.DATA_OCORRENCIA,
    ocorrencia: row.OCORRENCIA,
  }));
}

export async function criarOcorrencia(d: OcorrenciaCliente): Promise<number> {
  const pool = await getPool();
  const r = await pool.request()
    .input('idCliente', sql.Int, d.idCliente)
    .input('dataOcorrencia', sql.Date, d.dataOcorrencia ? new Date(d.dataOcorrencia) : new Date())
    .input('ocorrencia', sql.VarChar, d.ocorrencia || null)
    .query(`INSERT INTO OCORRENCIAS (CODIGO_CLIENTE, DATA_OCORRENCIA, OCORRENCIA)
      OUTPUT INSERTED.CODIGO
      VALUES (@idCliente, @dataOcorrencia, @ocorrencia)`);
  return r.recordset[0].CODIGO;
}

export async function atualizarOcorrencia(id: number, d: OcorrenciaCliente): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('dataOcorrencia', sql.Date, d.dataOcorrencia ? new Date(d.dataOcorrencia) : null)
    .input('ocorrencia', sql.VarChar, d.ocorrencia || null)
    .query(`UPDATE OCORRENCIAS SET DATA_OCORRENCIA=@dataOcorrencia, OCORRENCIA=@ocorrencia WHERE CODIGO=@id`);
}

export async function deletarOcorrencia(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM OCORRENCIAS WHERE CODIGO=@id`);
}
