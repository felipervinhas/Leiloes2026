import { getPool } from '../config/database';

// ── Inicialização da tabela ──────────────────────────────────────────────────

async function ensureTable() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RELATORIO_LAYOUTS' AND xtype='U')
    CREATE TABLE RELATORIO_LAYOUTS (
      ID       INT IDENTITY(1,1) PRIMARY KEY,
      NOME     VARCHAR(200)    NOT NULL,
      TIPO     VARCHAR(50)     NOT NULL,
      CONTEUDO NVARCHAR(MAX)   NOT NULL,
      ATIVO    BIT             DEFAULT 0,
      DATCRI   DATETIME        DEFAULT GETDATE()
    )
  `);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listarLayouts(tipo?: string) {
  await ensureTable();
  const pool = await getPool();
  const req = pool.request();
  if (tipo) req.input('tipo', tipo);
  const r = await req.query(`
    SELECT ID, NOME, TIPO, ATIVO, FORMAT(DATCRI,'dd/MM/yyyy') AS DATCRI
    FROM RELATORIO_LAYOUTS
    ${tipo ? 'WHERE TIPO = @tipo' : ''}
    ORDER BY NOME
  `);
  return r.recordset.map((t: any) => ({
    id: t.ID,
    nome: t.NOME,
    tipo: t.TIPO,
    ativo: t.ATIVO,
    datcri: t.DATCRI,
  }));
}

export async function buscarLayout(id: number) {
  await ensureTable();
  const pool = await getPool();
  const r = await pool.request()
    .input('id', id)
    .query(`SELECT ID, NOME, TIPO, CONTEUDO, ATIVO FROM RELATORIO_LAYOUTS WHERE ID = @id`);
  const t = r.recordset[0];
  if (!t) throw new Error('Layout não encontrado');
  return { id: t.ID, nome: t.NOME, tipo: t.TIPO, conteudo: JSON.parse(t.CONTEUDO), ativo: t.ATIVO };
}

export async function buscarLayoutAtivo(tipo: string) {
  await ensureTable();
  const pool = await getPool();
  const r = await pool.request()
    .input('tipo', tipo)
    .query(`SELECT TOP 1 ID, NOME, TIPO, CONTEUDO FROM RELATORIO_LAYOUTS WHERE TIPO = @tipo AND ATIVO = 1`);
  const t = r.recordset[0];
  if (!t) return null;
  return { id: t.ID, nome: t.NOME, tipo: t.TIPO, conteudo: JSON.parse(t.CONTEUDO) };
}

export async function criarLayout(nome: string, tipo: string, conteudo: unknown) {
  await ensureTable();
  const pool = await getPool();
  const r = await pool.request()
    .input('nome', nome)
    .input('tipo', tipo)
    .input('conteudo', JSON.stringify(conteudo))
    .query(`
      INSERT INTO RELATORIO_LAYOUTS (NOME, TIPO, CONTEUDO)
      OUTPUT INSERTED.ID
      VALUES (@nome, @tipo, @conteudo)
    `);
  return { id: r.recordset[0].ID };
}

export async function atualizarLayout(id: number, nome: string, conteudo: unknown) {
  await ensureTable();
  const pool = await getPool();
  await pool.request()
    .input('id', id)
    .input('nome', nome)
    .input('conteudo', JSON.stringify(conteudo))
    .query(`
      UPDATE RELATORIO_LAYOUTS
      SET NOME=@nome, CONTEUDO=@conteudo
      WHERE ID=@id
    `);
}

export async function deletarLayout(id: number) {
  await ensureTable();
  const pool = await getPool();
  await pool.request()
    .input('id', id)
    .query(`DELETE FROM RELATORIO_LAYOUTS WHERE ID=@id`);
}

export async function ativarLayout(id: number, tipo: string) {
  await ensureTable();
  const pool = await getPool();
  await pool.request()
    .input('tipo', tipo)
    .query(`UPDATE RELATORIO_LAYOUTS SET ATIVO = 0 WHERE TIPO = @tipo`);
  await pool.request()
    .input('id', id)
    .query(`UPDATE RELATORIO_LAYOUTS SET ATIVO = 1 WHERE ID = @id`);
}
