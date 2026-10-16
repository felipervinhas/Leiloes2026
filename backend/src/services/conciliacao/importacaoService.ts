import { createHash } from 'crypto';
import { getPool, sql } from '../../config/database';
import { garantirTabelasConciliacao } from './schema';
import { ConciliacaoError } from './acessoService';
import { buscarContaPorAcctid } from './contasService';
import { lerOfx, LancamentoOfx } from './ofxParser';

export interface ResumoImportacao {
  idImportacao: number;
  idConta: number;
  descricaoConta: string | null;
  dtInicio: string | null;
  dtFim: string | null;
  saldoFinal: number | null;
  total: number;
  novos: number;
  jaImportados: number;
  comDocumento: number;
  clientesIdentificados: number;
}

// CPF/CNPJ fica gravado de várias formas no cadastro (com e sem pontuação),
// então a comparação é só pelos dígitos.
const DIGITOS = (col: string) =>
  `REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(${col}, ''), '.', ''), '-', ''), '/', ''), ' ', '')`;

/** doc (só dígitos) → ID do cliente: cadastro primeiro, depois pagadores conhecidos. */
async function resolverClientes(docs: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  const unicos = [...new Set(docs)];
  if (!unicos.length) return mapa;
  const pool = await getPool();
  for (let i = 0; i < unicos.length; i += 500) {
    const lote = unicos.slice(i, i + 500);
    const req = pool.request();
    const ps = lote.map((d, j) => { req.input(`d${j}`, sql.VarChar, d); return `@d${j}`; }).join(',');
    const r = await req.query(`
      SELECT ID, ${DIGITOS('CPFXXX')} AS CPF, ${DIGITOS('CNPJXX')} AS CNPJ
      FROM Clientes
      WHERE ${DIGITOS('CPFXXX')} IN (${ps}) OR ${DIGITOS('CNPJXX')} IN (${ps})
      ORDER BY CASE WHEN ATIVOX = 'S' THEN 0 ELSE 1 END, ID`);
    for (const c of r.recordset) {
      for (const d of [c.CPF, c.CNPJ]) if (d && lote.includes(d) && !mapa.has(d)) mapa.set(d, c.ID);
    }
    const reqP = pool.request();
    lote.forEach((d, j) => reqP.input(`d${j}`, sql.VarChar, d));
    const p = await reqP.query(`SELECT DOC, ID_CLIENTE FROM CONC_PAGADORES WHERE DOC IN (${ps})`);
    for (const x of p.recordset) if (!mapa.has(x.DOC)) mapa.set(x.DOC, x.ID_CLIENTE);
  }
  return mapa;
}

export async function importarExtrato(
  arquivo: Buffer, nomeArquivo: string, usuario: { id?: number; nome?: string } | undefined,
): Promise<ResumoImportacao> {
  await garantirTabelasConciliacao();
  const pool = await getPool();

  const hash = createHash('sha256').update(arquivo).digest('hex');
  const dup = await pool.request().input('hash', sql.Char, hash)
    .query(`SELECT TOP 1 DATA, NOME_USUARIO FROM CONC_IMPORTACOES WHERE HASH_ARQUIVO = @hash`);
  if (dup.recordset.length) {
    const d = dup.recordset[0];
    throw new ConciliacaoError(409,
      `Este arquivo já foi importado em ${new Date(d.DATA).toLocaleDateString('pt-BR')}${d.NOME_USUARIO ? ` por ${d.NOME_USUARIO}` : ''}`);
  }

  let extrato;
  try { extrato = lerOfx(arquivo); } catch (e: any) {
    throw new ConciliacaoError(400, e.message || 'Não foi possível ler o arquivo OFX');
  }
  if (!extrato.contaId) throw new ConciliacaoError(400, 'O arquivo não informa a conta (ACCTID)');

  const conta = await buscarContaPorAcctid(extrato.bancoId, extrato.contaId);
  if (!conta || !conta.ativa) {
    // a tela usa os dados para oferecer o cadastro da conta já preenchido
    throw new ConciliacaoError(422, 'A conta deste extrato não está cadastrada', {
      banco: extrato.bancoId, acctid: extrato.contaId,
    });
  }

  // FITID que já existem nesta conta (extratos com período sobreposto)
  const existentes = new Set<string>();
  const fitids = extrato.lancamentos.map(l => l.fitid);
  for (let i = 0; i < fitids.length; i += 500) {
    const req = pool.request().input('conta', sql.Int, conta.id);
    const ps = fitids.slice(i, i + 500).map((f, j) => { req.input(`f${j}`, sql.VarChar, f); return `@f${j}`; }).join(',');
    const r = await req.query(`SELECT FITID FROM CONC_LANCAMENTOS WHERE ID_CONTA = @conta AND FITID IN (${ps})`);
    r.recordset.forEach((x: any) => existentes.add(x.FITID));
  }
  // o mesmo FITID repetido dentro do arquivo conta uma vez só
  const vistos = new Set<string>();
  const novos: LancamentoOfx[] = extrato.lancamentos.filter(l => {
    if (existentes.has(l.fitid) || vistos.has(l.fitid)) return false;
    vistos.add(l.fitid);
    return true;
  });

  const clientes = await resolverClientes(novos.map(l => l.doc).filter((d): d is string => !!d));

  const tx = new sql.Transaction(pool);
  await tx.begin();
  let idImportacao: number;
  try {
    const ri = await new sql.Request(tx)
      .input('conta', sql.Int, conta.id)
      .input('arquivo', sql.VarChar, nomeArquivo.slice(0, 255))
      .input('hash', sql.Char, hash)
      .input('ini', sql.Date, extrato.dtInicio)
      .input('fim', sql.Date, extrato.dtFim)
      .input('saldo', sql.Decimal(18, 2), extrato.saldoFinal)
      .input('qtd', sql.Int, extrato.lancamentos.length)
      .input('novos', sql.Int, novos.length)
      .input('idUsuario', sql.Int, usuario?.id ?? null)
      .input('nomeUsuario', sql.VarChar, usuario?.nome ?? null)
      .query(`INSERT INTO CONC_IMPORTACOES
                (ID_CONTA, ARQUIVO, HASH_ARQUIVO, DT_INICIO, DT_FIM, SALDO_FINAL, QTD_LANCAMENTOS, QTD_NOVOS, ID_USUARIO, NOME_USUARIO)
              OUTPUT INSERTED.ID
              VALUES (@conta, @arquivo, @hash, @ini, @fim, @saldo, @qtd, @novos, @idUsuario, @nomeUsuario)`);
    idImportacao = ri.recordset[0].ID;

    // 10 parâmetros por linha → 150 linhas por INSERT ficam abaixo do limite de 2.100
    for (let i = 0; i < novos.length; i += 150) {
      const req = new sql.Request(tx).input('conta', sql.Int, conta.id).input('imp', sql.Int, idImportacao);
      const valores = novos.slice(i, i + 150).map((l, j) => {
        req.input(`fi${j}`, sql.VarChar, l.fitid)
          .input(`dt${j}`, sql.Date, l.data)
          .input(`vl${j}`, sql.Decimal(18, 2), l.valor)
          .input(`se${j}`, sql.Char, l.sentido)
          .input(`me${j}`, sql.VarChar, l.memo)
          .input(`do${j}`, sql.VarChar, l.doc)
          .input(`no${j}`, sql.VarChar, l.nome)
          .input(`cl${j}`, sql.Int, l.doc ? clientes.get(l.doc) ?? null : null);
        return `(@conta, @imp, @fi${j}, @dt${j}, @vl${j}, @se${j}, @me${j}, @do${j}, @no${j}, @cl${j})`;
      });
      await req.query(`INSERT INTO CONC_LANCAMENTOS
        (ID_CONTA, ID_IMPORTACAO, FITID, DATA, VALOR, SENTIDO, MEMO, DOC_CONTRAPARTE, NOME_CONTRAPARTE, ID_CLIENTE)
        VALUES ${valores.join(',')}`);
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  return {
    idImportacao,
    idConta: conta.id!,
    descricaoConta: conta.descricao ?? null,
    dtInicio: extrato.dtInicio,
    dtFim: extrato.dtFim,
    saldoFinal: extrato.saldoFinal,
    total: extrato.lancamentos.length,
    novos: novos.length,
    jaImportados: extrato.lancamentos.length - novos.length,
    comDocumento: novos.filter(l => l.doc).length,
    clientesIdentificados: novos.filter(l => l.doc && clientes.has(l.doc)).length,
  };
}

export async function listarImportacoes(idConta?: number) {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const r = await pool.request().input('conta', sql.Int, idConta ?? null).query(`
    SELECT TOP 200 I.*, C.DESCRICAO AS DESCRICAO_CONTA
    FROM CONC_IMPORTACOES I LEFT JOIN CONC_CONTAS C ON C.ID = I.ID_CONTA
    WHERE (@conta IS NULL OR I.ID_CONTA = @conta)
    ORDER BY I.DATA DESC`);
  return r.recordset.map((x: any) => ({
    id: x.ID, idConta: x.ID_CONTA, descricaoConta: x.DESCRICAO_CONTA, arquivo: x.ARQUIVO,
    dtInicio: x.DT_INICIO, dtFim: x.DT_FIM, saldoFinal: x.SALDO_FINAL,
    qtdLancamentos: x.QTD_LANCAMENTOS, qtdNovos: x.QTD_NOVOS, nomeUsuario: x.NOME_USUARIO, data: x.DATA,
  }));
}

export interface FiltrosLancamentos {
  idConta?: number;
  de?: string;
  ate?: string;
  sentido?: 'C' | 'D';
  situacao?: string;
  busca?: string;
}

export async function listarLancamentos(f: FiltrosLancamentos) {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const req = pool.request();
  const conds: string[] = [];
  if (f.idConta)  { req.input('conta', sql.Int, f.idConta); conds.push('L.ID_CONTA = @conta'); }
  if (f.de)       { req.input('de', sql.Date, f.de); conds.push('L.DATA >= @de'); }
  if (f.ate)      { req.input('ate', sql.Date, f.ate); conds.push('L.DATA <= @ate'); }
  if (f.sentido)  { req.input('sentido', sql.Char, f.sentido); conds.push('L.SENTIDO = @sentido'); }
  if (f.situacao) { req.input('situacao', sql.VarChar, f.situacao); conds.push('L.SITUACAO = @situacao'); }
  if (f.busca) {
    req.input('busca', sql.VarChar, `%${f.busca}%`);
    // só busca pelo documento quando o termo é um número (CPF/CNPJ com ou sem pontuação);
    // senão "TESTE E2E" viraria "%2%" e casaria qualquer CPF com um 2
    const digitos = f.busca.replace(/\D/g, '');
    const ehDocumento = digitos.length >= 3 && !/[a-z]/i.test(f.busca);
    if (ehDocumento) req.input('buscaDoc', sql.VarChar, `%${digitos}%`);
    conds.push(`(L.MEMO LIKE @busca OR C.NOMEXX LIKE @busca${ehDocumento ? ' OR L.DOC_CONTRAPARTE LIKE @buscaDoc' : ''})`);
  }
  const r = await req.query(`
    SELECT TOP 2000 L.*, C.NOMEXX AS NOME_CLIENTE, CT.DESCRICAO AS DESCRICAO_CONTA
    FROM CONC_LANCAMENTOS L
    LEFT JOIN Clientes C     ON C.ID = L.ID_CLIENTE
    LEFT JOIN CONC_CONTAS CT ON CT.ID = L.ID_CONTA
    ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}
    ORDER BY L.DATA DESC, L.ID DESC`);
  return r.recordset.map((x: any) => ({
    id: x.ID, idConta: x.ID_CONTA, descricaoConta: x.DESCRICAO_CONTA, data: x.DATA, valor: Number(x.VALOR),
    sentido: x.SENTIDO, memo: x.MEMO, docContraparte: x.DOC_CONTRAPARTE, nomeContraparte: x.NOME_CONTRAPARTE,
    idCliente: x.ID_CLIENTE, nomeCliente: x.NOME_CLIENTE, situacao: x.SITUACAO, categoria: x.CATEGORIA,
  }));
}

/** Números do painel: por conta, a última importação e os lançamentos por situação. */
export async function resumoPainel() {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT C.ID, C.DESCRICAO, C.BANCO,
      (SELECT TOP 1 SALDO_FINAL FROM CONC_IMPORTACOES I WHERE I.ID_CONTA = C.ID ORDER BY I.DT_FIM DESC, I.ID DESC) AS SALDO,
      (SELECT TOP 1 DT_FIM FROM CONC_IMPORTACOES I WHERE I.ID_CONTA = C.ID ORDER BY I.DT_FIM DESC, I.ID DESC) AS ATE,
      (SELECT COUNT(*) FROM CONC_LANCAMENTOS L WHERE L.ID_CONTA = C.ID AND L.SITUACAO = 'PENDENTE') AS PENDENTES,
      (SELECT COUNT(*) FROM CONC_LANCAMENTOS L WHERE L.ID_CONTA = C.ID AND L.SITUACAO = 'PENDENTE' AND L.ID_CLIENTE IS NOT NULL) AS PENDENTES_COM_CLIENTE,
      (SELECT COUNT(*) FROM CONC_LANCAMENTOS L WHERE L.ID_CONTA = C.ID AND L.SITUACAO = 'CONCILIADO') AS CONCILIADOS
    FROM CONC_CONTAS C WHERE C.ATIVA = 'S' ORDER BY C.DESCRICAO, C.ID`);
  return r.recordset.map((x: any) => ({
    idConta: x.ID, descricao: x.DESCRICAO, banco: x.BANCO, saldo: x.SALDO != null ? Number(x.SALDO) : null,
    saldoAte: x.ATE, pendentes: x.PENDENTES, pendentesComCliente: x.PENDENTES_COM_CLIENTE, conciliados: x.CONCILIADOS,
  }));
}
