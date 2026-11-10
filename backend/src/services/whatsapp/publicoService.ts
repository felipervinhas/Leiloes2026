import { getPool, sql } from '../../config/database';
import { normalizarCelular } from './telefone';
import { DadosDestinatario } from './templateService';
import { WhatsappError } from './configService';

/**
 * Quem recebe a campanha. Sempre parte dos clientes ativos com celular; o tipo
 * restringe a um grupo e os filtros comuns (UF, bloqueados) se aplicam por cima.
 */
export interface FiltroPublico {
  tipo: 'todos' | 'compradores' | 'lances' | 'parcelas' | 'selecionados';
  idsLeiloes?: number[];     // compradores / lances / parcelas: só destes leilões
  desde?: string;            // compradores / lances: a partir desta data (AAAA-MM-DD)
  vencimentoDe?: string;     // parcelas
  vencimentoAte?: string;    // parcelas
  idsClientes?: number[];    // selecionados
  ufs?: string[];
  excluirBloqueados?: boolean;
}

export interface Destinatario extends DadosDestinatario {
  idCliente: number;
  numero: string;
  chave: string;
}

export interface ResultadoPublico {
  destinatarios: Destinatario[];
  totalClientes: number;
  semCelularValido: number;
  duplicados: number;
  descadastrados: number;
}

const ids = (v: any): number[] =>
  (Array.isArray(v) ? v : []).map(Number).filter(n => Number.isInteger(n) && n > 0);

const dataValida = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function montarPublico(f: FiltroPublico): Promise<ResultadoPublico> {
  const pool = await getPool();
  const req = pool.request();
  const where: string[] = [
    `ISNULL(C.ATIVOX, 'S') <> 'N'`,
    `(ISNULL(C.CELU_1, '') <> '' OR ISNULL(C.CELU_2, '') <> '')`,
  ];
  let joinParcelas = '';
  let colsParcelas = 'NULL AS PARC_QTD, NULL AS PARC_TOTAL, NULL AS PARC_VENC';

  const leiloes = ids(f.idsLeiloes);
  if (leiloes.length) req.input('leiloes', sql.VarChar(sql.MAX), leiloes.join(','));
  const filtroLeilao = (col: string) =>
    leiloes.length ? `AND ${col} IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@leiloes, ','))` : '';
  if (dataValida(f.desde)) req.input('desde', sql.Date, f.desde);

  switch (f.tipo) {
    case 'todos':
      break;
    case 'compradores':
      if (!leiloes.length && !dataValida(f.desde)) throw new WhatsappError(400, 'Escolha os leilões ou a data inicial dos compradores');
      where.push(`C.ID IN (
        SELECT MC.IDCLI FROM MOVIMENTO_COMPRADOR MC
        JOIN MOVIMENTO M ON M.ID = MC.IDMOV
        LEFT JOIN LEILOES L ON L.ID = M.IDLEILAO
        WHERE 1=1 ${filtroLeilao('M.IDLEILAO')} ${dataValida(f.desde) ? 'AND L.DATLEI >= @desde' : ''})`);
      break;
    case 'lances':
      if (!leiloes.length && !dataValida(f.desde)) throw new WhatsappError(400, 'Escolha os leilões ou a data inicial dos lances');
      where.push(`C.ID IN (
        SELECT LL.IDCLIENTE FROM LOTES_LANCES LL
        JOIN LOTES LO ON LO.ID = LL.IDLOTE
        WHERE 1=1 ${filtroLeilao('LO.IDLEILAO')} ${dataValida(f.desde) ? 'AND LL.DATA >= @desde' : ''})`);
      break;
    case 'parcelas': {
      if (!dataValida(f.vencimentoDe) || !dataValida(f.vencimentoAte)) {
        throw new WhatsappError(400, 'Informe o período de vencimento das parcelas');
      }
      req.input('vencDe', sql.Date, f.vencimentoDe).input('vencAte', sql.Date, f.vencimentoAte);
      joinParcelas = `JOIN (
        SELECT MP.IDCLI, COUNT(*) AS QTD, SUM(MP.VLRPAR) AS TOTAL, MIN(MP.DATVEN) AS VENC
        FROM MOVIMENTO_PARCELAMENTO MP
        ${leiloes.length ? 'JOIN MOVIMENTO M ON M.ID = MP.IDMOV' : ''}
        WHERE MP.DATVEN BETWEEN @vencDe AND @vencAte ${filtroLeilao('M.IDLEILAO')}
        GROUP BY MP.IDCLI
      ) P ON P.IDCLI = C.ID`;
      colsParcelas = 'P.QTD AS PARC_QTD, P.TOTAL AS PARC_TOTAL, P.VENC AS PARC_VENC';
      break;
    }
    case 'selecionados': {
      const cli = ids(f.idsClientes);
      if (!cli.length) throw new WhatsappError(400, 'Selecione ao menos um cliente');
      req.input('clientes', sql.VarChar(sql.MAX), cli.join(','));
      where.push(`C.ID IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@clientes, ','))`);
      break;
    }
    default:
      throw new WhatsappError(400, 'Tipo de público inválido');
  }

  const ufs = (f.ufs || []).map(u => String(u).trim().toUpperCase()).filter(u => /^[A-Z]{2}$/.test(u));
  if (ufs.length) {
    req.input('ufs', sql.VarChar(200), ufs.join(','));
    where.push(`UPPER(CID.ESTADO) IN (SELECT value FROM STRING_SPLIT(@ufs, ','))`);
  }
  if (f.excluirBloqueados) where.push(`ISNULL(C.BLOCLI, '') NOT IN ('Sim', 'S')`);

  const r = await req.query(`
    SELECT C.ID, C.NOMEXX, C.CELU_1, C.CELU_2, CID.CIDADE AS NOMECIDADE, CID.ESTADO, ${colsParcelas}
    FROM CLIENTES C
    LEFT JOIN Cidades CID ON CID.ID = C.CIDADE
    ${joinParcelas}
    WHERE ${where.join(' AND ')}
    ORDER BY LTRIM(C.NOMEXX)
  `);

  const opt = await pool.request().query(`SELECT CHAVE FROM WPP_OPTOUT`);
  const optout = new Set<string>(opt.recordset.map((x: any) => x.CHAVE));

  const vistos = new Set<string>();
  const destinatarios: Destinatario[] = [];
  let semCelularValido = 0, duplicados = 0, descadastrados = 0;

  for (const c of r.recordset) {
    const tel = normalizarCelular(c.CELU_1) || normalizarCelular(c.CELU_2);
    if (!tel) { semCelularValido++; continue; }
    if (optout.has(tel.chave)) { descadastrados++; continue; }
    if (vistos.has(tel.chave)) { duplicados++; continue; }
    vistos.add(tel.chave);
    destinatarios.push({
      idCliente: c.ID,
      nome: String(c.NOMEXX || '').trim(),
      cidade: c.NOMECIDADE,
      uf: c.ESTADO,
      numero: tel.numero,
      chave: tel.chave,
      parcelasQtd: c.PARC_QTD,
      parcelasTotal: c.PARC_TOTAL,
      parcelaVencimento: c.PARC_VENC,
    });
  }

  return { destinatarios, totalClientes: r.recordset.length, semCelularValido, duplicados, descadastrados };
}
