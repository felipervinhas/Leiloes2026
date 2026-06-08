import { getPool, sql } from '../config/database';
import { Cliente } from '../models/cliente';

function mapRow(c: any): Cliente {
  return {
    id: c.ID, nomexx: c.NOMEXX, endere: c.ENDERE, bairro: c.BAIRRO, cepxxx: c.CEPXXX,
    cpfxxx: c.CPFXXX, cnpjxx: c.CNPJXX, telres: c.TELRES, telcom: c.TELCOM,
    celu1: c.CELU_1, celu2: c.CELU_2, rgxxxx: c.RGXXXX, datnas: c.DATNAS,
    emailx: c.EMAILX, email2: c.EMAIL2, cidade: c.CIDADE,
    nomeCidade: c.NOMECIDADE, nomeEstado: c.NOMEESTADO,
    comple: c.COMPLE, profiss: c.PROFISS, empres: c.EMPRES, rendax: c.RENDAX,
    bancox: c.BANCOX, agenci: c.AGENCI, contax: c.CONTAX, pix: c.PIX,
    banco1: c.BANCO1, agencia1: c.AGENCIA1, conta1: c.CONTA1, pix1: c.PIX1,
    banco2: c.BANCO2, agencia2: c.AGENCIA2, conta2: c.CONTA2, pix2: c.PIX2,
    refer1: c.REFER1, telrefere1: c.TELREFERE1, refer2: c.REFER2, telrefere2: c.TELREFERE2,
    obsxxx: c.OBSXXX, ocorrencias: c.OCORRENCIAS,
    ativox: c.ATIVOX, blocli: c.BLOCLI, adm: c.ADM, acessoApp: c.ACESSO_APP,
    senhax: c.SENHAX, limcre: c.LIMCRE, classificacao: c.CLASSIFICACAO,
    estciv: c.ESTCIV, datcad: c.DATCAD, datalt: c.DATALT,
  };
}

export async function listarClientes(busca?: string, filtro?: string): Promise<Cliente[]> {
  const pool = await getPool();
  const req = pool.request();
  let where = '';
  if (busca && filtro) {
    req.input('busca', sql.VarChar, `%${busca}%`);
    const col: Record<string, string> = {
      nome: 'C.NOMEXX', cpf: 'C.CPFXXX', cnpj: 'C.CNPJXX', email: 'C.EMAILX',
    };
    where = `WHERE ${col[filtro] || 'C.NOMEXX'} LIKE @busca`;
  }
  const r = await req.query(`
    SELECT TOP 500 C.ID,C.NOMEXX,C.CPFXXX,C.CNPJXX,C.EMAILX,C.CELU_1,
      C.ATIVOX,C.BLOCLI,C.ADM,C.ACESSO_APP,C.DATCAD,C.CIDADE,
      CID.CIDADE AS NOMECIDADE, CID.ESTADO AS NOMEESTADO
    FROM Clientes C
    LEFT JOIN Cidades CID ON CID.ID = C.CIDADE
    ${where} ORDER BY C.NOMEXX`);
  return r.recordset.map(mapRow);
}

export async function buscarClientePorId(id: number): Promise<Cliente | null> {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`
    SELECT C.*, CID.CIDADE AS NOMECIDADE, CID.ESTADO AS NOMEESTADO
    FROM Clientes C
    LEFT JOIN Cidades CID ON CID.ID = C.CIDADE
    WHERE C.ID=@id`);
  if (!r.recordset.length) return null;
  return mapRow(r.recordset[0]);
}

export async function criarCliente(d: Cliente): Promise<number> {
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
    .input('estciv', sql.VarChar, d.estciv||null).input('obsxxx', sql.VarChar, d.obsxxx||null)
    .input('datcad', sql.Date, new Date())
    .input('bancox', sql.VarChar, d.bancox||null).input('agenci', sql.VarChar, d.agenci||null)
    .input('contax', sql.VarChar, d.contax||null).input('pix', sql.VarChar, d.pix||null)
    .input('refer1', sql.VarChar, d.refer1||null).input('telrefere1', sql.VarChar, d.telrefere1||null)
    .input('refer2', sql.VarChar, d.refer2||null).input('telrefere2', sql.VarChar, d.telrefere2||null)
    .query(`INSERT INTO Clientes (NOMEXX,ENDERE,BAIRRO,CEPXXX,CPFXXX,CNPJXX,TELRES,TELCOM,CELU_1,CELU_2,RGXXXX,DATNAS,EMAILX,EMAIL2,CIDADE,COMPLE,PROFISS,EMPRES,RENDAX,SENHAX,ATIVOX,BLOCLI,ADM,ACESSO_APP,LIMCRE,CLASSIFICACAO,ESTCIV,OBSXXX,DATCAD,BANCOX,AGENCI,CONTAX,PIX,REFER1,TELREFERE1,REFER2,TELREFERE2)
      OUTPUT INSERTED.ID
      VALUES (@nomexx,@endere,@bairro,@cepxxx,@cpfxxx,@cnpjxx,@telres,@telcom,@celu1,@celu2,@rgxxxx,@datnas,@emailx,@email2,@cidade,@comple,@profiss,@empres,@rendax,@senhax,@ativox,@blocli,@adm,@acessoApp,@limcre,@classificacao,@estciv,@obsxxx,@datcad,@bancox,@agenci,@contax,@pix,@refer1,@telrefere1,@refer2,@telrefere2)`);
  return r.recordset[0].ID;
}

export async function atualizarCliente(id: number, d: Cliente): Promise<void> {
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
    .input('blocli', sql.VarChar, d.blocli||'Não').input('adm', sql.Char, d.adm||'N')
    .input('acessoApp', sql.VarChar, d.acessoApp||null).input('limcre', sql.VarChar, d.limcre||null)
    .input('classificacao', sql.Int, d.classificacao||null).input('estciv', sql.VarChar, d.estciv||null)
    .input('obsxxx', sql.VarChar, d.obsxxx||null).input('datalt', sql.Date, new Date())
    .input('bancox', sql.VarChar, d.bancox||null).input('agenci', sql.VarChar, d.agenci||null)
    .input('contax', sql.VarChar, d.contax||null).input('pix', sql.VarChar, d.pix||null)
    .input('refer1', sql.VarChar, d.refer1||null).input('telrefere1', sql.VarChar, d.telrefere1||null)
    .input('refer2', sql.VarChar, d.refer2||null).input('telrefere2', sql.VarChar, d.telrefere2||null)
    .query(`UPDATE Clientes SET NOMEXX=@nomexx,ENDERE=@endere,BAIRRO=@bairro,CEPXXX=@cepxxx,
      CPFXXX=@cpfxxx,CNPJXX=@cnpjxx,TELRES=@telres,TELCOM=@telcom,CELU_1=@celu1,CELU_2=@celu2,
      RGXXXX=@rgxxxx,DATNAS=@datnas,EMAILX=@emailx,EMAIL2=@email2,CIDADE=@cidade,COMPLE=@comple,
      PROFISS=@profiss,EMPRES=@empres,RENDAX=@rendax,ATIVOX=@ativox,BLOCLI=@blocli,ADM=@adm,
      ACESSO_APP=@acessoApp,LIMCRE=@limcre,CLASSIFICACAO=@classificacao,ESTCIV=@estciv,
      OBSXXX=@obsxxx,DATALT=@datalt,BANCOX=@bancox,AGENCI=@agenci,CONTAX=@contax,PIX=@pix,
      REFER1=@refer1,TELREFERE1=@telrefere1,REFER2=@refer2,TELREFERE2=@telrefere2
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
