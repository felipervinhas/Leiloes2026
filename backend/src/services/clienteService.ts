import { getPool, sql } from '../config/database';
import { Cliente } from '../models/cliente';
import { listarClassificacoesDoCliente, salvarClassificacoesDoCliente, garantirTabelasClassificacao } from './classificacaoService';

const JOIN_CLASSIFICACOES = `
  LEFT JOIN (
    SELECT CC.ID_CLIENTE, STRING_AGG(CL.DESCRICAO, ', ') AS DESCRICOES
    FROM CLIENTES_CLASSIFICACOES CC
    JOIN Classificacoes CL ON CL.ID = CC.ID_CLASSIFICACAO
    GROUP BY CC.ID_CLIENTE
  ) CLS ON CLS.ID_CLIENTE = C.ID`;

function condicaoClassificacoes(req: any, classificacoes: string | undefined): string | null {
  if (!classificacoes) return null;
  const ids = classificacoes.split(',').map(Number).filter(n => !isNaN(n));
  if (!ids.length) return null;
  const params = ids.map((v, i) => {
    const name = `cls${i}`;
    req.input(name, sql.Int, v);
    return `@${name}`;
  });
  return `EXISTS (SELECT 1 FROM CLIENTES_CLASSIFICACOES CCX WHERE CCX.ID_CLIENTE = C.ID AND CCX.ID_CLASSIFICACAO IN (${params.join(',')}))`;
}

let colunaUsuCriada = false;
async function garantirColunasUsu() {
  if (colunaUsuCriada) return;
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Clientes' AND COLUMN_NAME='USUCAD')
      ALTER TABLE Clientes ADD USUCAD INT NULL;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Clientes' AND COLUMN_NAME='USUALT')
      ALTER TABLE Clientes ADD USUALT INT NULL;
  `);
  colunaUsuCriada = true;
}

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
    usucad: c.USUCAD ? Number(c.USUCAD) : null,
    usualt: c.USUALT ? Number(c.USUALT) : null,
    nomeUsucad: c.NOME_USUCAD ?? null,
    nomeUsualt: c.NOME_USUALT ?? null,
    comprovante1: c.COMPROVANTE1, comprovante2: c.COMPROVANTE2, comprovante3: c.COMPROVANTE3,
    // Permissões de Dashboard
    verComissoes: c.VER_COMISSOES, verValoresLiquidos: c.VER_VALORES_LIQUIDOS,
    verInfoFinanceira: c.VER_INFO_FINANCEIRA, verTopCompradores: c.VER_TOP_COMPRADORES,
    verTopVendedores: c.VER_TOP_VENDEDORES, verVencimentos: c.VER_VENCIMENTOS,
  };
}

export interface FiltrosCliente {
  nome?: string; cpf?: string; cnpj?: string; cidade?: string; estado?: string; situacao?: string;
}

const EXISTS_COMPRAS = `EXISTS (SELECT 1 FROM MOVIMENTO_COMPRADOR MC WHERE TRY_CAST(MC.IDCLI AS INT) = C.ID)`;
const EXISTS_VENDAS  = `EXISTS (SELECT 1 FROM MOVIMENTO_LOTE ML WHERE ML.CODVEN = C.ID)`;

function condicaoFiltrosCliente(req: any, filtros?: FiltrosCliente): string[] {
  const conditions: string[] = [];
  if (filtros?.nome)   { req.input('fnome',   sql.VarChar, `%${filtros.nome}%`);  conditions.push(`C.NOMEXX LIKE @fnome`); }
  if (filtros?.cpf)    { req.input('fcpf',    sql.VarChar, `%${filtros.cpf}%`);   conditions.push(`C.CPFXXX LIKE @fcpf`); }
  if (filtros?.cnpj)   { req.input('fcnpj',   sql.VarChar, `%${filtros.cnpj}%`);  conditions.push(`C.CNPJXX LIKE @fcnpj`); }
  if (filtros?.cidade) { req.input('fcidade', sql.Int, Number(filtros.cidade));   conditions.push(`C.CIDADE = @fcidade`); }
  if (filtros?.estado) { req.input('festado', sql.VarChar, filtros.estado);       conditions.push(`CID.ESTADO = @festado`); }
  if (filtros?.situacao === 'compradores')        conditions.push(EXISTS_COMPRAS);
  if (filtros?.situacao === 'vendedores')         conditions.push(EXISTS_VENDAS);
  if (filtros?.situacao === 'semComercializacao') conditions.push(`NOT ${EXISTS_COMPRAS} AND NOT ${EXISTS_VENDAS}`);
  if (filtros?.situacao === 'bloqueado')          conditions.push(`C.ACESSO_APP = '2 - Bloqueado'`);
  if (filtros?.situacao === 'reprovado')          conditions.push(`C.ACESSO_APP = '4 - Reprovado'`);
  return conditions;
}

const FAIXAS_FATURAMENTO: Record<string, (tot: string) => string> = {
  ate10k:    tot => `${tot} BETWEEN 1 AND 10000`,
  ate20k:    tot => `${tot} BETWEEN 1 AND 20000`,
  ate30k:    tot => `${tot} BETWEEN 1 AND 30000`,
  ate50k:    tot => `${tot} BETWEEN 1 AND 50000`,
  acima50k:  tot => `${tot} > 50000`,
  ate100k:   tot => `${tot} BETWEEN 1 AND 100000`,
  acima100k: tot => `${tot} > 100000`,
};

export async function listarClientesFaturamento(filtros?: FiltrosCliente, filtroValor?: string, classificacoes?: string) {
  await garantirTabelasClassificacao();
  const pool = await getPool();
  const req = pool.request();
  const conditions: string[] = condicaoFiltrosCliente(req, filtros);
  const condClassificacoes = condicaoClassificacoes(req, classificacoes);
  if (condClassificacoes) conditions.push(condClassificacoes);
  const tot = `(ISNULL(COMP.TOTAL, 0) + ISNULL(VEN.TOTAL, 0))`;
  if (filtroValor && FAIXAS_FATURAMENTO[filtroValor]) conditions.push(FAIXAS_FATURAMENTO[filtroValor](tot));
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
      ISNULL(LAN.VLR,    0) AS VLR_LANCES,
      CLS.DESCRICOES AS CLASSIFICACOES_DESC
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
    ${JOIN_CLASSIFICACOES}
    ${where}
    ORDER BY ISNULL(COMP.TOTAL, 0) DESC, C.NOMEXX
  `);
  return r.recordset.map((c: any) => ({
    id: c.ID, nomexx: c.NOMEXX, cpfxxx: c.CPFXXX, cnpjxx: c.CNPJXX,
    emailx: c.EMAILX, celu1: c.CELU_1, ativox: c.ATIVOX, datcad: c.DATCAD,
    nomeCidade: c.NOMECIDADE, nomeEstado: c.NOMEESTADO,
    classificacoesDescricao: c.CLASSIFICACOES_DESC,
    qtdCompras: c.QTD_COMPRAS, vlrCompras: c.VLR_COMPRAS,
    qtdVendas:  c.QTD_VENDAS,  vlrVendas:  c.VLR_VENDAS,
    qtdLances:  c.QTD_LANCES,  vlrLances:  c.VLR_LANCES,
  }));
}

const SELECT_CLIENTE_COLUNAS = `
      C.ID,C.NOMEXX,C.CPFXXX,C.CNPJXX,C.EMAILX,C.CELU_1,
      C.ATIVOX,C.BLOCLI,C.ADM,C.ACESSO_APP,C.DATCAD,C.CIDADE,
      ISNULL(C.VER_COMISSOES, 'S') AS VER_COMISSOES,
      ISNULL(C.VER_VALORES_LIQUIDOS, 'S') AS VER_VALORES_LIQUIDOS,
      ISNULL(C.VER_INFO_FINANCEIRA, 'S') AS VER_INFO_FINANCEIRA,
      ISNULL(C.VER_TOP_COMPRADORES, 'S') AS VER_TOP_COMPRADORES,
      ISNULL(C.VER_TOP_VENDEDORES, 'S') AS VER_TOP_VENDEDORES,
      ISNULL(C.VER_VENCIMENTOS, 'S') AS VER_VENCIMENTOS,
      CID.CIDADE AS NOMECIDADE, CID.ESTADO AS NOMEESTADO,
      CLS.DESCRICOES AS CLASSIFICACOES_DESC`;

const JOIN_VALOR = `
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

function montarWhereClientes(req: any, filtros?: FiltrosCliente, filtroValor?: string, classificacoes?: string): string {
  const conditions = condicaoFiltrosCliente(req, filtros);
  const condClassificacoes = condicaoClassificacoes(req, classificacoes);
  if (condClassificacoes) conditions.push(condClassificacoes);
  if (filtroValor && FAIXAS_FATURAMENTO[filtroValor]) {
    conditions.push(FAIXAS_FATURAMENTO[filtroValor](`(ISNULL(COMP_V.TOTAL, 0) + ISNULL(VEN_V.TOTAL, 0))`));
  }
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}

export async function listarClientes(filtros?: FiltrosCliente, filtroValor?: string, classificacoes?: string): Promise<Cliente[]> {
  await garantirTabelasClassificacao();
  const pool = await getPool();
  const req = pool.request();
  const where = montarWhereClientes(req, filtros, filtroValor, classificacoes);
  const joinValor = filtroValor ? JOIN_VALOR : '';

  const r = await req.query(`
    SELECT TOP 500 ${SELECT_CLIENTE_COLUNAS}
    FROM Clientes C
    LEFT JOIN Cidades CID ON CID.ID = C.CIDADE
    ${JOIN_CLASSIFICACOES}
    ${joinValor}
    ${where} ORDER BY C.NOMEXX`);
  return r.recordset.map((c: any) => ({ ...mapRow(c), classificacoesDescricao: c.CLASSIFICACOES_DESC }));
}

/**
 * Versão paginada de listarClientes — a base de Clientes tem +11 mil
 * registros e o TOP 500 sem paginação cortava resultados incompletos assim
 * que um filtro (Compradores, Bloqueado, Sem Comercializações etc.) batia
 * mais de 500 clientes. Só usada pela tela de Clientes; os demais
 * consumidores de listarClientes() (ex.: Select de vendedor em Lotes)
 * continuam recebendo o array simples de antes.
 */
export async function listarClientesPaginado(
  filtros?: FiltrosCliente, filtroValor?: string, classificacoes?: string, page = 1, pageSize = 20
): Promise<{ items: Cliente[]; total: number }> {
  await garantirTabelasClassificacao();
  const pool = await getPool();
  const joinValor = filtroValor ? JOIN_VALOR : '';

  const reqCount = pool.request();
  const whereCount = montarWhereClientes(reqCount, filtros, filtroValor, classificacoes);
  const totalResult = await reqCount.query(`
    SELECT COUNT(*) AS total
    FROM Clientes C
    LEFT JOIN Cidades CID ON CID.ID = C.CIDADE
    ${JOIN_CLASSIFICACOES}
    ${joinValor}
    ${whereCount}`);
  const total = totalResult.recordset[0].total;

  const offset = Math.max(0, (page - 1) * pageSize);
  const reqSelect = pool.request();
  const whereSelect = montarWhereClientes(reqSelect, filtros, filtroValor, classificacoes);
  reqSelect.input('offset', sql.Int, offset).input('pageSize', sql.Int, pageSize);
  const r = await reqSelect.query(`
    SELECT ${SELECT_CLIENTE_COLUNAS}
    FROM Clientes C
    LEFT JOIN Cidades CID ON CID.ID = C.CIDADE
    ${JOIN_CLASSIFICACOES}
    ${joinValor}
    ${whereSelect}
    ORDER BY C.NOMEXX
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);
  return { items: r.recordset.map((c: any) => ({ ...mapRow(c), classificacoesDescricao: c.CLASSIFICACOES_DESC })), total };
}

export async function buscarClientePorId(id: number): Promise<Cliente | null> {
  await garantirColunaSolicitadoPor();
  await garantirColunasUsu();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`
    SELECT C.*, CID.CIDADE AS NOMECIDADE, CID.ESTADO AS NOMEESTADO,
           SOLIC.NOMEXX  AS NOME_SOLICITADO_POR,
           UCAD.NOMEXX   AS NOME_USUCAD,
           UALT.NOMEXX   AS NOME_USUALT
    FROM Clientes C
    LEFT JOIN Cidades  CID  ON CID.ID  = C.CIDADE
    LEFT JOIN Clientes SOLIC ON SOLIC.ID = C.ID_SOLICITADO_POR
    LEFT JOIN Clientes UCAD  ON UCAD.ID  = C.USUCAD
    LEFT JOIN Clientes UALT  ON UALT.ID  = C.USUALT
    WHERE C.ID=@id`);
  if (!r.recordset.length) return null;
  const cliente = mapRow(r.recordset[0]);
  cliente.classificacoes = await listarClassificacoesDoCliente(id);
  return cliente;
}

export class DuplicidadeError extends Error {
  constructor(msg: string) { super(msg); this.name = 'DuplicidadeError'; }
}

async function verificarDuplicidade(cpf?: string, cnpj?: string, excludeId?: number) {
  const pool = await getPool();
  const norm = (v: string) =>
    `REPLACE(REPLACE(REPLACE(REPLACE(${v},'.',''),'-',''),'/',''),' ','')`;

  if (cpf && cpf.trim()) {
    const req = pool.request().input('cpf', sql.VarChar, cpf);
    let q = `SELECT TOP 1 ID, NOMEXX FROM Clientes
      WHERE ${norm('CPFXXX')} = ${norm('@cpf')}
        AND CPFXXX IS NOT NULL AND CPFXXX <> ''`;
    if (excludeId) { req.input('excId', sql.Int, excludeId); q += ` AND ID <> @excId`; }
    const r = await req.query(q);
    if (r.recordset.length)
      throw new DuplicidadeError(`CPF já cadastrado para: ${r.recordset[0].NOMEXX}`);
  }

  if (cnpj && cnpj.trim()) {
    const req = pool.request().input('cnpj', sql.VarChar, cnpj);
    let q = `SELECT TOP 1 ID, NOMEXX FROM Clientes
      WHERE ${norm('CNPJXX')} = ${norm('@cnpj')}
        AND CNPJXX IS NOT NULL AND CNPJXX <> ''`;
    if (excludeId) { req.input('excId', sql.Int, excludeId); q += ` AND ID <> @excId`; }
    const r = await req.query(q);
    if (r.recordset.length)
      throw new DuplicidadeError(`CNPJ já cadastrado para: ${r.recordset[0].NOMEXX}`);
  }
}

export async function criarCliente(d: Cliente): Promise<number> {
  await verificarDuplicidade(d.cpfxxx, d.cnpjxx);
  await garantirColunaSolicitadoPor();
  await garantirColunasUsu();
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
    .input('ocorrencias', sql.VarChar, d.ocorrencias||null)
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
    .input('usucad', sql.Int, d.usucad||null)
    .query(`INSERT INTO Clientes (NOMEXX,ENDERE,BAIRRO,CEPXXX,CPFXXX,CNPJXX,TELRES,TELCOM,CELU_1,CELU_2,RGXXXX,DATNAS,EMAILX,EMAIL2,CIDADE,COMPLE,PROFISS,EMPRES,RENDAX,SENHAX,ATIVOX,BLOCLI,ADM,ACESSO_APP,LIMCRE,CLASSIFICACAO,CODCLA,ESTCIV,OBSXXX,OCORRENCIAS,DATCAD,BANCOX,AGENCI,CONTAX,PIX,BANCO1,AGENCIA1,CONTA1,PIX1,BANCO2,AGENCIA2,CONTA2,PIX2,REFER1,TELREFERE1,REFER2,TELREFERE2,ID_SOLICITADO_POR,USUCAD)
      OUTPUT INSERTED.ID
      VALUES (@nomexx,@endere,@bairro,@cepxxx,@cpfxxx,@cnpjxx,@telres,@telcom,@celu1,@celu2,@rgxxxx,@datnas,@emailx,@email2,@cidade,@comple,@profiss,@empres,@rendax,@senhax,@ativox,@blocli,@adm,@acessoApp,@limcre,@classificacao,@codcla,@estciv,@obsxxx,@ocorrencias,@datcad,@bancox,@agenci,@contax,@pix,@banco1,@agencia1,@conta1,@pix1,@banco2,@agencia2,@conta2,@pix2,@refer1,@telrefere1,@refer2,@telrefere2,@idSolicitadoPor,@usucad)`);
  const id = r.recordset[0].ID;
  await salvarClassificacoesDoCliente(id, d.classificacoes || []);
  return id;
}

export async function atualizarCliente(id: number, d: Cliente): Promise<void> {
  await verificarDuplicidade(d.cpfxxx, d.cnpjxx, id);
  await garantirColunaSolicitadoPor();
  await garantirColunasUsu();
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
    .input('obsxxx', sql.VarChar, d.obsxxx||null).input('ocorrencias', sql.VarChar, d.ocorrencias||null)
    .input('datalt', sql.Date, new Date())
    .input('bancox', sql.VarChar, d.bancox||null).input('agenci', sql.VarChar, d.agenci||null)
    .input('contax', sql.VarChar, d.contax||null).input('pix', sql.VarChar, d.pix||null)
    .input('banco1', sql.VarChar, d.banco1||null).input('agencia1', sql.VarChar, d.agencia1||null)
    .input('conta1', sql.VarChar, d.conta1||null).input('pix1', sql.VarChar, d.pix1||null)
    .input('banco2', sql.VarChar, d.banco2||null).input('agencia2', sql.VarChar, d.agencia2||null)
    .input('conta2', sql.VarChar, d.conta2||null).input('pix2', sql.VarChar, d.pix2||null)
    .input('refer1', sql.VarChar, d.refer1||null).input('telrefere1', sql.VarChar, d.telrefere1||null)
    .input('refer2', sql.VarChar, d.refer2||null).input('telrefere2', sql.VarChar, d.telrefere2||null)
    .input('idSolicitadoPor', sql.Int, d.idSolicitadoPor||null)
    .input('usualt', sql.Int, d.usualt||null)
    .input('senhax', sql.VarChar, d.senhax||null)
    .query(`UPDATE Clientes SET NOMEXX=@nomexx,ENDERE=@endere,BAIRRO=@bairro,CEPXXX=@cepxxx,
      CPFXXX=@cpfxxx,CNPJXX=@cnpjxx,TELRES=@telres,TELCOM=@telcom,CELU_1=@celu1,CELU_2=@celu2,
      RGXXXX=@rgxxxx,DATNAS=@datnas,EMAILX=@emailx,EMAIL2=@email2,CIDADE=@cidade,COMPLE=@comple,
      PROFISS=@profiss,EMPRES=@empres,RENDAX=@rendax,ATIVOX=@ativox,BLOCLI=@blocli,
      ACESSO_APP=@acessoApp,LIMCRE=@limcre,CLASSIFICACAO=@classificacao,CODCLA=@codcla,ESTCIV=@estciv,
      OBSXXX=@obsxxx,OCORRENCIAS=@ocorrencias,DATALT=@datalt,BANCOX=@bancox,AGENCI=@agenci,CONTAX=@contax,PIX=@pix,
      BANCO1=@banco1,AGENCIA1=@agencia1,CONTA1=@conta1,PIX1=@pix1,
      BANCO2=@banco2,AGENCIA2=@agencia2,CONTA2=@conta2,PIX2=@pix2,
      REFER1=@refer1,TELREFERE1=@telrefere1,REFER2=@refer2,TELREFERE2=@telrefere2,
      ID_SOLICITADO_POR=@idSolicitadoPor,USUALT=@usualt
      ${d.senhax ? ',SENHAX=@senhax' : ''}
      WHERE ID=@id`);
  await salvarClassificacoesDoCliente(id, d.classificacoes || []);
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
