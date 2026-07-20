import { getPool, sql } from '../config/database';
import { getBanco } from '../config/bancoContext';
import { Chamado } from '../models/chamado';
import { urlS3 } from './s3Service';

const bancosComTabela = new Set<string>();

async function garantirTabela() {
  const banco = getBanco();
  if (bancosComTabela.has(banco)) return;
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CHAMADOS' AND xtype='U')
    CREATE TABLE CHAMADOS (
      ID           INT IDENTITY(1,1) PRIMARY KEY,
      TIPO         VARCHAR(20) NOT NULL,
      TITULO       VARCHAR(200) NOT NULL,
      DESCRICAO    NVARCHAR(MAX) NOT NULL,
      STATUS       VARCHAR(20) NOT NULL DEFAULT 'Pendente',
      ID_USUARIO   INT NULL,
      NOME_USUARIO VARCHAR(200) NULL,
      IMAGEM_KEY   VARCHAR(300) NULL,
      RESPOSTA     NVARCHAR(MAX) NULL,
      DATCRI       DATETIME NOT NULL DEFAULT GETDATE(),
      DATRESP      DATETIME NULL
    )
  `);
  bancosComTabela.add(banco);
}

function mapRow(c: any): Chamado {
  return {
    id: c.ID,
    tipo: c.TIPO,
    titulo: c.TITULO,
    descricao: c.DESCRICAO,
    status: c.STATUS,
    idUsuario: c.ID_USUARIO,
    nomeUsuario: c.NOME_USUARIO,
    imagemKey: c.IMAGEM_KEY,
    imagemUrl: c.IMAGEM_KEY ? urlS3(c.IMAGEM_KEY) : undefined,
    resposta: c.RESPOSTA,
    datcri: c.DATCRI,
    datresp: c.DATRESP,
  };
}

export async function listarChamados(busca?: string, status?: string): Promise<Chamado[]> {
  await garantirTabela();
  const pool = await getPool();
  const req = pool.request();
  const wheres: string[] = [];
  if (busca) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    wheres.push('(TITULO LIKE @busca OR DESCRICAO LIKE @busca OR NOME_USUARIO LIKE @busca)');
  }
  if (status) {
    req.input('status', sql.VarChar, status);
    wheres.push('STATUS=@status');
  }
  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const r = await req.query(`SELECT * FROM CHAMADOS ${where} ORDER BY DATCRI DESC`);
  return r.recordset.map(mapRow);
}

export async function buscarChamadoPorId(id: number): Promise<Chamado | null> {
  await garantirTabela();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query('SELECT * FROM CHAMADOS WHERE ID=@id');
  if (!r.recordset.length) return null;
  return mapRow(r.recordset[0]);
}

export async function criarChamado(d: {
  tipo: string;
  titulo: string;
  descricao: string;
  idUsuario?: number;
  nomeUsuario?: string;
}): Promise<number> {
  await garantirTabela();
  const pool = await getPool();
  const r = await pool.request()
    .input('tipo', sql.VarChar, d.tipo)
    .input('titulo', sql.VarChar, d.titulo)
    .input('descricao', sql.NVarChar, d.descricao)
    .input('idUsuario', sql.Int, d.idUsuario || null)
    .input('nomeUsuario', sql.VarChar, d.nomeUsuario || null)
    .query(`INSERT INTO CHAMADOS (TIPO, TITULO, DESCRICAO, ID_USUARIO, NOME_USUARIO)
            OUTPUT INSERTED.ID
            VALUES (@tipo, @titulo, @descricao, @idUsuario, @nomeUsuario)`);
  return r.recordset[0].ID;
}

export async function definirImagemChamado(id: number, imagemKey: string): Promise<void> {
  await garantirTabela();
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('key', sql.VarChar, imagemKey)
    .query('UPDATE CHAMADOS SET IMAGEM_KEY=@key WHERE ID=@id');
}

export async function atualizarStatusChamado(id: number, status: string, resposta?: string): Promise<void> {
  await garantirTabela();
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('status', sql.VarChar, status)
    .input('resposta', sql.NVarChar, resposta || null)
    .query('UPDATE CHAMADOS SET STATUS=@status, RESPOSTA=@resposta, DATRESP=GETDATE() WHERE ID=@id');
}

export async function deletarChamado(id: number): Promise<void> {
  await garantirTabela();
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query('DELETE FROM CHAMADOS WHERE ID=@id');
}
