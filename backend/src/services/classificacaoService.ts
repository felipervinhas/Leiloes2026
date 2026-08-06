import { getPool, sql } from '../config/database';
import { getBanco } from '../config/bancoContext';
import { Classificacao } from '../models/classificacao';

const tabelasCriadasPorBanco = new Set<string>();
export async function garantirTabelasClassificacao() {
  await garantirTabelas();
}
async function garantirTabelas() {
  const banco = getBanco();
  if (tabelasCriadasPorBanco.has(banco)) return;
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='Classificacoes')
      CREATE TABLE Classificacoes (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        DESCRICAO VARCHAR(100) NOT NULL
      );
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='CLIENTES_CLASSIFICACOES')
      CREATE TABLE CLIENTES_CLASSIFICACOES (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        ID_CLIENTE INT NOT NULL,
        ID_CLASSIFICACAO INT NOT NULL,
        CONSTRAINT UQ_CLIENTE_CLASSIFICACAO UNIQUE (ID_CLIENTE, ID_CLASSIFICACAO)
      );
  `);
  tabelasCriadasPorBanco.add(banco);
}

export async function listarClassificacoes(busca?: string): Promise<Classificacao[]> {
  await garantirTabelas();
  const pool = await getPool();
  const req = pool.request();
  let where = '';
  if (busca) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    where = 'WHERE DESCRICAO LIKE @busca';
  }
  const r = await req.query(`SELECT ID, DESCRICAO FROM Classificacoes ${where} ORDER BY DESCRICAO`);
  return r.recordset.map(c => ({ id: c.ID, descricao: c.DESCRICAO }));
}

export async function buscarClassificacaoPorId(id: number): Promise<Classificacao | null> {
  await garantirTabelas();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id)
    .query(`SELECT ID, DESCRICAO FROM Classificacoes WHERE ID=@id`);
  if (!r.recordset.length) return null;
  const c = r.recordset[0];
  return { id: c.ID, descricao: c.DESCRICAO };
}

export async function criarClassificacao(dados: Omit<Classificacao, 'id'>): Promise<number> {
  await garantirTabelas();
  const pool = await getPool();
  const r = await pool.request()
    .input('descricao', sql.VarChar, dados.descricao)
    .query(`INSERT INTO Classificacoes (DESCRICAO) OUTPUT INSERTED.ID VALUES (@descricao)`);
  return r.recordset[0].ID;
}

export async function atualizarClassificacao(id: number, dados: Omit<Classificacao, 'id'>): Promise<void> {
  await garantirTabelas();
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('descricao', sql.VarChar, dados.descricao)
    .query(`UPDATE Classificacoes SET DESCRICAO=@descricao WHERE ID=@id`);
}

export async function deletarClassificacao(id: number): Promise<void> {
  await garantirTabelas();
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id)
    .query(`DELETE FROM CLIENTES_CLASSIFICACOES WHERE ID_CLASSIFICACAO=@id; DELETE FROM Classificacoes WHERE ID=@id`);
}

export async function listarClassificacoesDoCliente(idCliente: number): Promise<number[]> {
  await garantirTabelas();
  const pool = await getPool();
  const r = await pool.request().input('idCliente', sql.Int, idCliente)
    .query(`SELECT ID_CLASSIFICACAO FROM CLIENTES_CLASSIFICACOES WHERE ID_CLIENTE=@idCliente`);
  return r.recordset.map((row: any) => row.ID_CLASSIFICACAO);
}

export async function salvarClassificacoesDoCliente(idCliente: number, idsClassificacao: number[]): Promise<void> {
  await garantirTabelas();
  const pool = await getPool();
  await pool.request().input('idCliente', sql.Int, idCliente)
    .query(`DELETE FROM CLIENTES_CLASSIFICACOES WHERE ID_CLIENTE=@idCliente`);
  for (const idClassificacao of idsClassificacao) {
    await pool.request()
      .input('idCliente', sql.Int, idCliente)
      .input('idClassificacao', sql.Int, idClassificacao)
      .query(`INSERT INTO CLIENTES_CLASSIFICACOES (ID_CLIENTE, ID_CLASSIFICACAO) VALUES (@idCliente, @idClassificacao)`);
  }
}
