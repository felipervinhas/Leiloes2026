import { getPool, sql } from '../config/database';
import { Cliente } from '../models/cliente';

let colunaSolicitadoPorCriada = false;
async function garantirColunaSolicitadoPor() {
  if (colunaSolicitadoPorCriada) return;
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='Clientes' AND COLUMN_NAME='ID_SOLICITADO_POR'
    )
    ALTER TABLE Clientes ADD ID_SOLICITADO_POR INT NULL
  `);
  colunaSolicitadoPorCriada = true;
}

function mapRow(c: any): Cliente {
  return {
    id: c.ID, nomexx: c.NOMEXX, endere: c.ENDERE, bairro: c.BAIRRO, cepxxx: c.CEPXXX,
    cpfxxx: c.CPFXXX, cnpjxx: c.CNPJXX, telres: c.TELRES, telcom: c.TELCOM,
    celu1: c.CELU_1, celu2: c.CELU_2, rgxxxx: c.RGXXXX,
    orgem: c.ORG_EM, emissa: c.EMISSA,
    datnas: c.DATNAS,
    emailx: c.EMAILX, email2: c.EMAIL2,
    paixxx: c.PAIXXX, maexxx: c.MAEXXX,
    cidade: c.CIDADE,
    nomeCidade: c.NOMECIDADE, nomeEstado: c.NOMEESTADO,
    comple: c.COMPLE, profiss: c.PROFISS, empres: c.EMPRES, rendax: c.RENDAX,
    bancox: c.BANCOX, agenci: c.AGENCI, contax: c.CONTAX, pix: c.PIX,
    banco1: c.BANCO1, agencia1: c.AGENCIA1, conta1: c.CONTA1, pix1: c.PIX1,
    banco2: c.BANCO2, agencia2: c.AGENCIA2, conta2: c.CONTA2, pix2: c.PIX2,
    refer1: c.REFER1, telrefere1: c.TELREFERE1, refer2: c.REFER2, telrefere2: c.TELREFERE2,
    obsxxx: c.OBSXXX, ocorrencias: c.OCORRENCIAS,
    ativox: c.ATIVOX, blocli: c.BLOCLI, adm: c.ADM, acessoApp: c.ACESSO_APP,
    senhax: c.SENHAX, limcre: c.LIMCRE, classificacao: c.CLASSIFICACAO, codcla: c.CODCLA,
    estciv: c.ESTCIV, datcad: c.DATCAD, datalt: c.DATALT,
    idSolicitadoPor: c.ID_SOLICITADO_POR ? Number(c.ID_SOLICITADO_POR) : null,
    nomeSolicitadoPor: c.NOME_SOLICITADO_POR ?? null,
    comprovante1: c.COMPROVANTE1, comprovante2: c.COMPROVANTE2, comprovante3: c.COMPROVANTE3,
    // Permissões de Dashboard
    verComissoes: c.VER_COMISSOES, verValoresLiquidos: c.VER_VALORES_LIQUIDOS,
    verInfoFinanceira: c.VER_INFO_FINANCEIRA, verTopCompradores: c.VER_TOP_COMPRADORES,
    verTopVendedores: c.VER_TOP_VENDEDORES, verVencimentos: c.VER_VENCIMENTOS,
  };
}

export async function listarClientesFaturamento(busca?: string, filtro?: string, filtroValor?: string) {
  const pool = await getPool();
  const req = pool.request();
  const conditions: string[] = [];
  if (busca && filtro) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    const col: Record<string, string> = {
      nome: 'C.NOMEXX', cpf: 'C.CPFXXX', cnpj: 'C.CNPJXX', email: 'C.EMAILX',
    };
    conditions.push(`${col[filtro] || 'C.NOMEXX'} LIKE @busca`);
  }
  const tot = `(ISNULL(COMP.TOTAL, 0) + ISNULL(VEN.TOTAL, 0))`;
  if (filtroValor === 'ate10k')   conditions.push(`${tot} BETWEEN 1 AND 10000`);
  if (filtroValor === 'ate20k')   conditions.push(`${tot} BETWEEN 1 AND 20000`);
  if (filtroValor === 'acima30k') conditions.push(`${tot} > 30000`);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const r = await req.query(`
    SELECT TOP 500
      C.ID, C.NOMEXX, C.CPFXXX, C.CNPJXX, C.EMAILX, C.CELU_1, C.ATIVOX, C.DATCAD,
      CID.CIDADE AS NOMECIDADE, CID.ESTADO AS NOMEESTADO,
      ISNULL(COMP.QTD,   0) AS QTD_COMPRAS,
      ISNULL(COMP.TOTAL, 0) AS VLR_COMPRAS,
      ISNULL(VEN.QTD,    0) AS QTD_VENDAS,
      ISNULL(VEN.TOTAL,  0) AS VLR_VENDAS,
      ISNULL(LAN.QTD,    0) AS QTD_LANCES,
      ISNULL(LAN.VLR,    0) AS VLR_LANCES
    FROM Clientes C
    LEFT JOIN Cidades CID ON CID.ID = C.CIDADE
    LEFT JOIN (
      SELECT TRY_CAST(IDCLI AS INT) AS IDCLI,
             COUNT(*)                           AS QTD,
             SUM(ISNULL(VALORPAGAR, 0))         AS TOTAL
      FROM MOVIMENTO_COMPRADOR
      WHERE TRY_CAST(IDCLI AS INT) IS NOT NULL
      GROUP BY TRY_CAST(IDCLI AS INT)
    ) COMP ON COMP.IDCLI = C.ID
    LEFT JOIN (
      SELECT CODVEN,
             COUNT(*)                    AS QTD,
             SUM(ISNULL(VLRTOT, 0))      AS TOTAL
      FROM MOVIMENTO_LOTE
      WHERE CODVEN IS NOT NULL
      GROUP BY CODVEN
    ) VEN ON VEN.CODVEN = C.ID
    LEFT JOIN (
      SELECT IDCLIENTE,
             COUNT(*)                    AS QTD,
             SUM(ISNULL(VALOR, 0))       AS VLR
      FROM LOTES_LANCES
      WHERE IDCLIENTE IS NOT NULL
      GROUP BY IDCLIENTE
    ) LAN ON LAN.IDCLIENTE = C.ID
    ${where}
    ORDER BY ISNULL(COMP.TOTAL, 0) DESC, C.NOMEXX
  `);
  return r.recordset.map((c: any) => ({
    id: c.ID, nomexx: c.NOMEXX, cpfxxx: c.CPFXXX, cnpjxx: c.CNPJXX,
    emailx: c.EMAILX, celu1: c.CELU_1, ativox: c.ATIVOX, datcad: c.DATCAD,
    nomeCidade: c.NOMECIDADE, nomeEstado: c.NOMEESTADO,
    qtdCompras: c.QTD_COMPRAS, vlrCompras: c.VLR_COMPRAS,
    qtdVendas:  c.QTD_VENDAS,  vlrVendas:  c.VLR_VENDAS,
    qtdLances:  c.QTD_LANCES,  vlrLances:  c.VLR_LANCES,
  }));
}

export async function listarClientes(busca?: string, filtro?: string, filtroValor?: string): Promise<Cliente[]> {
  const pool = await getPool();
  const req = pool.request();
  const conditions: string[] = [];

  if (busca && filtro) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    const col: Record<string, string> = {
      nome: 'C.NOMEXX', cpf: 'C.CPFXXX', cnpj: 'C.CNPJXX', email: 'C.EMAILX',
    };
    conditions.push(`${col[filtro] || 'C.NOMEXX'} LIKE @busca`);
  }

  const tot = `(ISNULL(COMP_V.TOTAL, 0) + ISNULL(VEN_V.TOTAL, 0))`;
  let joinValor = '';
  if (filtroValor) {
    joinValor = `
      LEFT JOIN (
        SELECT TRY_CAST(IDCLI AS INT) AS IDCLI, SUM(ISNULL(VALORPAGAR,0)) AS TOTAL
        FROM MOVIMENTO_COMPRADOR WHERE TRY_CAST(IDCLI AS INT) IS NOT NULL
        GROUP BY TRY_CAST(IDCLI AS INT)
      ) COMP_V ON COMP_V.IDCLI = C.ID
      LEFT JOIN (
        SELECT CODVEN, SUM(ISNULL(VLRTOT,0)) AS TOTAL
        FROM MOVIMENTO_LOTE WHERE CODVEN IS NOT NULL
        GROUP BY CODVEN
      ) VEN_V ON VEN_V.CODVEN = C.ID`;
    if (filtroValor === 'ate10k')   conditions.push(`${tot} BETWEEN 1 AND 10000`);
    if (filtroValor === 'ate20k')   conditions.push(`${tot} BETWEEN 1 AND 20000`);
    if (filtroValor === 'acima30k') conditions.push(`${tot} > 30000`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const r = await req.query(`
    SELECT TOP 500 C.ID,C.NOMEXX,C.CPFXXX,C.CNPJXX,C.EMAILX,C.CELU_1,
      C.ATIVOX,C.BLOCLI,C.ADM,C.ACESSO_APP,C.DATCAD,C.CIDADE,
      ISNULL(C.VER_COMISSOES, 'S') AS VER_COMISSOES,
      ISNULL(C.VER_VALORES_LIQUIDOS, 'S') AS VER_VALORES_LIQUIDOS,
      ISNULL(C.VER_INFO_FINANCEIRA, 'S') AS VER_INFO_FINANCEIRA,
      ISNULL(C.VER_TOP_COMPRADORES, 'S') AS VER_TOP_COMPRADORES,
      ISNULL(C.VER_TOP_VENDEDORES, 'S') AS VER_TOP_VENDEDORES,
      ISNULL(C.VER_VENCIMENTOS, 'S') AS VER_VENCIMENTOS,
      CID.CIDADE AS NOMECIDADE, CID.ESTADO AS NOMEESTADO
    FROM Clientes C
    LEFT JOIN Cidades CID ON CID.ID = C.CIDADE
    ${joinValor}
    ${where} ORDER BY C.NOMEXX`);
  return r.recordset.map(mapRow);
}

export async function buscarClientePorId(id: number): Promise<Cliente | null> {
  await garantirColunaSolicitadoPor();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`
    SELECT C.*, CID.CIDADE AS NOMECIDADE, CID.ESTADO AS NOMEESTADO,
           SOLIC.NOMEXX AS NOME_SOLICITADO_POR
    FROM Clientes C
    LEFT JOIN Cidades CID ON CID.ID = C.CIDADE
    LEFT JOIN Clientes SOLIC ON SOLIC.ID = C.ID_SOLICITADO_POR
    WHERE C.ID=@id`);
  if (!r.recordset.length) return null;
  return mapRow(r.recordset[0]);
}

export async function criarCliente(d: Cliente): Promise<number> {
  await garantirColunaSolicitadoPor();
  const pool = await getPool();
  const r = await pool.request()
    .input('nomexx', sql.VarChar, d.nomexx||null).input('endere', sql.VarChar, d.endere||null)
    .input('bairro', sql.VarChar, d.bairro||null).input('cepxxx', sql.VarChar, d.cepxxx||null)
    .input('cpfxxx', sql.VarChar, d.cpfxxx||null).input('cnpjxx', sql.VarChar, d.cnpjxx||null)
    .input('telres', sql.VarChar, d.telres||null).input('telcom', sql.VarChar, d.telcom||null)
    .input('celu1', sql.VarChar, d.celu1||null).input('celu2', sql.VarChar, d.celu2||null)
    .input('rgxxxx', sql.VarChar, d.rgxxxx||null).input('datnas', sql.Date, d.datnas||null)
    .input('emailx', sql.VarChar, d.emailx||null).input('email2', sql.VarChar, d.email2||null)
    .input('cidade', sql.Int, d.cidade||null).input('comple', sql.VarChar, d.comple||null)
    .input('profiss', sql.VarChar, d.profiss||null).input('empres', sql.VarChar, d.empres||null)
    .input('rendax', sql.VarChar, d.rendax||null).input('senhax', sql.VarChar, d.senhax||null)
    .input('ativox', sql.VarChar, d.ativox||'S').input('blocli', sql.VarChar, d.blocli||'Não')
    .input('adm', sql.Char, d.adm||'N').input('acessoApp', sql.VarChar, d.acessoApp||null)
    .input('limcre', sql.VarChar, d.limcre||null).input('classificacao', sql.Int, d.classificacao||null)
    .input('codcla', sql.Char, d.codcla||'F')
    .input('estciv', sql.VarChar, d.estciv||null).input('obsxxx', sql.VarChar, d.obsxxx||null)
    .input('datcad', sql.Date, new Date())
    .input('bancox', sql.VarChar, d.bancox||null).input('agenci', sql.VarChar, d.agenci||null)
    .input('contax', sql.VarChar, d.contax||null).input('pix', sql.VarChar, d.pix||null)
    .input('banco1', sql.VarChar, d.banco1||null).input('agencia1', sql.VarChar, d.agencia1||null)
    .input('conta1', sql.VarChar, d.conta1||null).input('pix1', sql.VarChar, d.pix1||null)
    .input('banco2', sql.VarChar, d.banco2||null).input('agencia2', sql.VarChar, d.agencia2||null)
    .input('conta2', sql.VarChar, d.conta2||null).input('pix2', sql.VarChar, d.pix2||null)
    .input('refer1', sql.VarChar, d.refer1||null).input('telrefere1', sql.VarChar, d.telrefere1||null)
    .input('refer2', sql.VarChar, d.refer2||null).input('telrefere2', sql.VarChar, d.telrefere2||null)
    .input('idSolicitadoPor', sql.Int, d.idSolicitadoPor||null)
    .query(`INSERT INTO Clientes (NOMEXX,ENDERE,BAIRRO,CEPXXX,CPFXXX,CNPJXX,TELRES,TELCOM,CELU_1,CELU_2,RGXXXX,DATNAS,EMAILX,EMAIL2,CIDADE,COMPLE,PROFISS,EMPRES,RENDAX,SENHAX,ATIVOX,BLOCLI,ADM,ACESSO_APP,LIMCRE,CLASSIFICACAO,CODCLA,ESTCIV,OBSXXX,DATCAD,BANCOX,AGENCI,CONTAX,PIX,BANCO1,AGENCIA1,CONTA1,PIX1,BANCO2,AGENCIA2,CONTA2,PIX2,REFER1,TELREFERE1,REFER2,TELREFERE2,ID_SOLICITADO_POR)
      OUTPUT INSERTED.ID
      VALUES (@nomexx,@endere,@bairro,@cepxxx,@cpfxxx,@cnpjxx,@telres,@telcom,@celu1,@celu2,@rgxxxx,@datnas,@emailx,@email2,@cidade,@comple,@profiss,@empres,@rendax,@senhax,@ativox,@blocli,@adm,@acessoApp,@limcre,@classificacao,@codcla,@estciv,@obsxxx,@datcad,@bancox,@agenci,@contax,@pix,@banco1,@agencia1,@conta1,@pix1,@banco2,@agencia2,@conta2,@pix2,@refer1,@telrefere1,@refer2,@telrefere2,@idSolicitadoPor)`);
  return r.recordset[0].ID;
}

export async function atualizarCliente(id: number, d: Cliente): Promise<void> {
  await garantirColunaSolicitadoPor();
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('nomexx', sql.VarChar, d.nomexx||null).input('endere', sql.VarChar, d.endere||null)
    .input('bairro', sql.VarChar, d.bairro||null).input('cepxxx', sql.VarChar, d.cepxxx||null)
    .input('cpfxxx', sql.VarChar, d.cpfxxx||null).input('cnpjxx', sql.VarChar, d.cnpjxx||null)
    .input('telres', sql.VarChar, d.telres||null).input('telcom', sql.VarChar, d.telcom||null)
    .input('celu1', sql.VarChar, d.celu1||null).input('celu2', sql.VarChar, d.celu2||null)
    .input('rgxxxx', sql.VarChar, d.rgxxxx||null).input('datnas', sql.Date, d.datnas||null)
    .input('emailx', sql.VarChar, d.emailx||null).input('email2', sql.VarChar, d.email2||null)
    .input('cidade', sql.Int, d.cidade||null).input('comple', sql.VarChar, d.comple||null)
    .input('profiss', sql.VarChar, d.profiss||null).input('empres', sql.VarChar, d.empres||null)
    .input('rendax', sql.VarChar, d.rendax||null).input('ativox', sql.VarChar, d.ativox||'S')
    .input('blocli', sql.VarChar, d.blocli||'Não')
    .input('acessoApp', sql.VarChar, d.acessoApp||null).input('limcre', sql.VarChar, d.limcre||null)
    .input('classificacao', sql.Int, d.classificacao||null).input('codcla', sql.Char, d.codcla||'F')
    .input('estciv', sql.VarChar, d.estciv||null)
    .input('obsxxx', sql.VarChar, d.obsxxx||null).input('datalt', sql.Date, new Date())
    .input('bancox', sql.VarChar, d.bancox||null).input('agenci', sql.VarChar, d.agenci||null)
    .input('contax', sql.VarChar, d.contax||null).input('pix', sql.VarChar, d.pix||null)
    .input('banco1', sql.VarChar, d.banco1||null).input('agencia1', sql.VarChar, d.agencia1||null)
    .input('conta1', sql.VarChar, d.conta1||null).input('pix1', sql.VarChar, d.pix1||null)
    .input('banco2', sql.VarChar, d.banco2||null).input('agencia2', sql.VarChar, d.agencia2||null)
    .input('conta2', sql.VarChar, d.conta2||null).input('pix2', sql.VarChar, d.pix2||null)
    .input('refer1', sql.VarChar, d.refer1||null).input('telrefere1', sql.VarChar, d.telrefere1||null)
    .input('refer2', sql.VarChar, d.refer2||null).input('telrefere2', sql.VarChar, d.telrefere2||null)
    .input('idSolicitadoPor', sql.Int, d.idSolicitadoPor||null)
    .query(`UPDATE Clientes SET NOMEXX=@nomexx,ENDERE=@endere,BAIRRO=@bairro,CEPXXX=@cepxxx,
      CPFXXX=@cpfxxx,CNPJXX=@cnpjxx,TELRES=@telres,TELCOM=@telcom,CELU_1=@celu1,CELU_2=@celu2,
      RGXXXX=@rgxxxx,DATNAS=@datnas,EMAILX=@emailx,EMAIL2=@email2,CIDADE=@cidade,COMPLE=@comple,
      PROFISS=@profiss,EMPRES=@empres,RENDAX=@rendax,ATIVOX=@ativox,BLOCLI=@blocli,
      ACESSO_APP=@acessoApp,LIMCRE=@limcre,CLASSIFICACAO=@classificacao,CODCLA=@codcla,ESTCIV=@estciv,
      OBSXXX=@obsxxx,DATALT=@datalt,BANCOX=@bancox,AGENCI=@agenci,CONTAX=@contax,PIX=@pix,
      BANCO1=@banco1,AGENCIA1=@agencia1,CONTA1=@conta1,PIX1=@pix1,
      BANCO2=@banco2,AGENCIA2=@agencia2,CONTA2=@conta2,PIX2=@pix2,
      REFER1=@refer1,TELREFERE1=@telrefere1,REFER2=@refer2,TELREFERE2=@telrefere2,
      ID_SOLICITADO_POR=@idSolicitadoPor
      WHERE ID=@id`);
}

export async function deletarCliente(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`DELETE FROM Clientes WHERE ID=@id`);
}

export async function alterarSenhaCliente(id: number, senhax: string): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).input('senhax', sql.VarChar, senhax)
    .query(`UPDATE Clientes SET SENHAX=@senhax WHERE ID=@id`);
}

export async function listarClientesPendentes(): Promise<any[]> {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT C.ID, C.NOMEXX, C.CPFXXX, C.CNPJXX, C.EMAILX, C.CELU_1, C.DATCAD,
      CID.CIDADE AS NOMECIDADE, CID.ESTADO AS NOMEESTADO
    FROM Clientes C
    LEFT JOIN Cidades CID ON CID.ID = C.CIDADE
    WHERE C.ACESSO_APP = '3 - Pendente'
    ORDER BY C.DATCAD DESC
  `);
  return r.recordset.map((c: any) => ({
    id: c.ID, nomexx: c.NOMEXX, cpfxxx: c.CPFXXX, cnpjxx: c.CNPJXX,
    emailx: c.EMAILX, celu1: c.CELU_1, datcad: c.DATCAD,
    nomeCidade: c.NOMECIDADE, nomeEstado: c.NOMEESTADO,
  }));
}

export async function contarClientesPendentes(): Promise<number> {
  const pool = await getPool();
  const r = await pool.request().query(
    `SELECT COUNT(*) AS TOTAL FROM Clientes WHERE ACESSO_APP = '3 - Pendente'`
  );
  return r.recordset[0]?.TOTAL ?? 0;
}

export async function aprovarCliente(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('datalt', sql.DateTime, new Date())
    .query(`UPDATE Clientes SET ACESSO_APP='1 - Liberado', ATIVOX='S', DATALT=@datalt WHERE ID=@id`);
}

export async function recusarCliente(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('datalt', sql.DateTime, new Date())
    .query(`UPDATE Clientes SET ACESSO_APP='4 - Reprovado', DATALT=@datalt WHERE ID=@id`);
}

export async function analisarCliente(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .input('datalt', sql.DateTime, new Date())
    .query(`UPDATE Clientes SET ACESSO_APP='2 - Em Análise', DATALT=@datalt WHERE ID=@id`);
}
