import { getPool, sql } from '../config/database';

let tabelaCriada = false;

async function garantirTabela() {
  if (tabelaCriada) return;
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PREFERENCIAS_USUARIO' AND xtype='U')
    CREATE TABLE PREFERENCIAS_USUARIO (
      ID       INT IDENTITY(1,1) PRIMARY KEY,
      IDUSUARIO INT NOT NULL,
      CHAVE    NVARCHAR(100) NOT NULL,
      VALOR    NVARCHAR(MAX),
      DATALT   DATETIME DEFAULT GETDATE(),
      CONSTRAINT UQ_PREF_USUARIO_CHAVE UNIQUE (IDUSUARIO, CHAVE)
    )
  `);
  tabelaCriada = true;
}

export async function getPreferencia(idUsuario: number, chave: string): Promise<any> {
  await garantirTabela();
  const pool = await getPool();
  const r = await pool.request()
    .input('idusuario', sql.Int, idUsuario)
    .input('chave', sql.NVarChar, chave)
    .query(`SELECT VALOR FROM PREFERENCIAS_USUARIO WHERE IDUSUARIO=@idusuario AND CHAVE=@chave`);
  if (!r.recordset.length) return null;
  try { return JSON.parse(r.recordset[0].VALOR); } catch { return r.recordset[0].VALOR; }
}

export async function setPreferencia(idUsuario: number, chave: string, valor: any): Promise<void> {
  await garantirTabela();
  const pool = await getPool();
  const valorStr = typeof valor === 'string' ? valor : JSON.stringify(valor);
  await pool.request()
    .input('idusuario', sql.Int, idUsuario)
    .input('chave', sql.NVarChar, chave)
    .input('valor', sql.NVarChar, valorStr)
    .query(`
      MERGE PREFERENCIAS_USUARIO AS t
      USING (VALUES (@idusuario, @chave, @valor, GETDATE()))
        AS s (IDUSUARIO, CHAVE, VALOR, DATALT)
      ON t.IDUSUARIO = s.IDUSUARIO AND t.CHAVE = s.CHAVE
      WHEN MATCHED THEN
        UPDATE SET VALOR = s.VALOR, DATALT = s.DATALT
      WHEN NOT MATCHED THEN
        INSERT (IDUSUARIO, CHAVE, VALOR, DATALT)
        VALUES (s.IDUSUARIO, s.CHAVE, s.VALOR, s.DATALT);
    `);
}
