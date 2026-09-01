import { getPool, sql } from '../config/database';
import { listarDespesas } from './despesaService';

export interface EntradaAcerto {
  idMc: number;
  lotexx?: string;
  deslot?: string;
  nomeComprador?: string;
  valorEntrada: number;
  leilao?: string;
}

export interface PromissoriaAcerto {
  datven: string;
  valor: number;
}

export interface ComissaoAcerto {
  idMl: number;
  lotexx?: string;
  deslot?: string;
  percentual: number;
  valor: number;
  leilao?: string;
}

export interface AcertoVendedor {
  idLeilao?: number;
  leilao?: string;
  datlei?: string;
  idVendedor: number;
  vendedor?: string;
  entradas: EntradaAcerto[];
  promissorias: PromissoriaAcerto[];
  comissoes: ComissaoAcerto[];
  lancamentos: Awaited<ReturnType<typeof listarDespesas>>;
  totais: {
    totalEntradas: number;
    totalPromissorias: number;
    totalComissao: number;
    totalDespesas: number;
    totalCreditos: number;
    totalFechamentos: number;
    saldo: number;
  };
}

function ehCredito(dc: string): boolean {
  return dc === 'C' || dc === 'E';
}
function ehDespesa(dc: string): boolean {
  return dc === 'D' || dc === 'S';
}

export async function calcularAcertoVendedor(idVendedor: number, idLeilao?: number): Promise<AcertoVendedor> {
  const pool = await getPool();

  const rVendedor = await pool.request().input('id', sql.Int, idVendedor).query(`SELECT NOMEXX FROM Clientes WHERE ID=@id`);

  const reqEntradas = pool.request().input('idVendedor', sql.Int, idVendedor);
  if (idLeilao) reqEntradas.input('idLeilao', sql.Int, idLeilao);
  const rEntradas = await reqEntradas.query(`
      SELECT MC.ID, LO.LOTEXX, LO.DESLOT, COM.NOMEXX AS NOME_COMPRADOR, MC.VALORPAGAR, L.LEILAO,
        (SELECT TOP 1 VLRPAR FROM MOVIMENTO_PARCELAMENTO WHERE IDMOVLOTE = MC.IDMOVLOTE AND PRIPAR = 'S') AS VALOR_ENTRADA
      FROM MOVIMENTO_COMPRADOR MC
      LEFT JOIN MOVIMENTO M       ON M.ID  = MC.IDMOV
      LEFT JOIN MOVIMENTO_LOTE ML ON ML.ID = MC.IDMOVLOTE
      LEFT JOIN LOTES LO          ON LO.ID = ML.IDLOTE
      LEFT JOIN CLIENTES COM      ON COM.ID = MC.IDCLI
      LEFT JOIN LEILOES L         ON L.ID  = M.IDLEILAO
      WHERE ML.CODVEN = @idVendedor ${idLeilao ? 'AND M.IDLEILAO = @idLeilao' : ''}
      ORDER BY L.DATLEI DESC, TRY_CAST(LO.LOTEXX AS INT), LO.LOTEXX
    `);

  const entradas: EntradaAcerto[] = rEntradas.recordset.map((r: any) => ({
    idMc: r.ID,
    lotexx: r.LOTEXX,
    deslot: r.DESLOT,
    nomeComprador: r.NOME_COMPRADOR,
    // Sem parcela marcada como PRIPAR='S' (ex.: Acerto Direto, Vencimento
    // Único), não existe entrada — o valor cheio já está em "promissórias"
    // (a receber no futuro). Usar VALORPAGAR aqui duplicava esse valor.
    valorEntrada: r.VALOR_ENTRADA != null ? r.VALOR_ENTRADA : 0,
    leilao: r.LEILAO,
  }));

  const reqPromissorias = pool.request().input('idVendedor', sql.Int, idVendedor);
  if (idLeilao) reqPromissorias.input('idLeilao', sql.Int, idLeilao);
  const rPromissorias = await reqPromissorias.query(`
      SELECT FORMAT(MP.DATVEN,'dd/MM/yyyy') AS DATVEN_F, SUM(MP.VLRPAR) AS VALOR
      FROM MOVIMENTO_PARCELAMENTO MP
      LEFT JOIN MOVIMENTO_LOTE ML ON ML.ID = MP.IDMOVLOTE
      LEFT JOIN MOVIMENTO M       ON M.ID  = ML.IDMOV
      WHERE ML.CODVEN = @idVendedor AND ISNULL(MP.PRIPAR, 'N') <> 'S' ${idLeilao ? 'AND M.IDLEILAO = @idLeilao' : ''}
      GROUP BY MP.DATVEN
      ORDER BY MP.DATVEN
    `);

  const promissorias: PromissoriaAcerto[] = rPromissorias.recordset.map((r: any) => ({
    datven: r.DATVEN_F,
    valor: r.VALOR || 0,
  }));

  // Comissão do vendedor — calculada automaticamente a partir do que já foi
  // gravado em MOVIMENTO_LOTE.COMISS_VENDEDOR (comven% do leilão × valor do
  // lote, resolvido no momento da venda). Antes disso não aparecia em lugar
  // nenhum do acerto, e tinha que ser digitada manualmente como Despesa —
  // o que gerava lançamentos com descrição/valor de outro lote por engano.
  const reqComissoes = pool.request().input('idVendedor', sql.Int, idVendedor);
  if (idLeilao) reqComissoes.input('idLeilao', sql.Int, idLeilao);
  const rComissoes = await reqComissoes.query(`
      SELECT ML.ID, LO.LOTEXX, LO.DESLOT, ML.VLRTOT, ML.COMISS_VENDEDOR, L.LEILAO
      FROM MOVIMENTO_LOTE ML
      LEFT JOIN MOVIMENTO M ON M.ID = ML.IDMOV
      LEFT JOIN LOTES LO    ON LO.ID = ML.IDLOTE
      LEFT JOIN LEILOES L   ON L.ID  = M.IDLEILAO
      WHERE ML.CODVEN = @idVendedor AND ML.COMISS_VENDEDOR > 0 ${idLeilao ? 'AND M.IDLEILAO = @idLeilao' : ''}
      ORDER BY L.DATLEI DESC, TRY_CAST(LO.LOTEXX AS INT), LO.LOTEXX
    `);

  const comissoes: ComissaoAcerto[] = rComissoes.recordset.map((r: any) => ({
    idMl: r.ID,
    lotexx: r.LOTEXX,
    deslot: r.DESLOT,
    percentual: r.VLRTOT > 0 ? (r.COMISS_VENDEDOR / r.VLRTOT) * 100 : 0,
    valor: r.COMISS_VENDEDOR || 0,
    leilao: r.LEILAO,
  }));

  const lancamentos = await listarDespesas(idLeilao, undefined, idVendedor);

  const totalEntradas = entradas.reduce((a, e) => a + e.valorEntrada, 0);
  const totalPromissorias = promissorias.reduce((a, p) => a + p.valor, 0);
  const totalComissao = comissoes.reduce((a, c) => a + c.valor, 0);
  const totalDespesas = lancamentos.filter(l => ehDespesa(l.dc)).reduce((a, l) => a + (l.valor || 0), 0);
  const totalCreditos = lancamentos.filter(l => ehCredito(l.dc)).reduce((a, l) => a + (l.valor || 0), 0);
  const totalFechamentos = lancamentos.filter(l => l.dc === 'F').reduce((a, l) => a + (l.valor || 0), 0);
  const saldo = totalEntradas + totalCreditos - totalComissao - totalDespesas - totalFechamentos;

  let leilao: string | undefined;
  let datlei: string | undefined;
  if (idLeilao) {
    const rLeilao = await pool.request().input('id', sql.Int, idLeilao).query(`SELECT LEILAO, DATLEI FROM Leiloes WHERE ID=@id`);
    leilao = rLeilao.recordset[0]?.LEILAO;
    datlei = rLeilao.recordset[0]?.DATLEI ? new Date(rLeilao.recordset[0].DATLEI).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined;
  } else {
    leilao = 'Todos os leilões';
  }

  return {
    idLeilao,
    leilao,
    datlei,
    idVendedor,
    vendedor: rVendedor.recordset[0]?.NOMEXX,
    entradas,
    promissorias,
    comissoes,
    lancamentos,
    totais: { totalEntradas, totalPromissorias, totalComissao, totalDespesas, totalCreditos, totalFechamentos, saldo },
  };
}
