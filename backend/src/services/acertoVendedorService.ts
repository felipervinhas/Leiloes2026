import { getPool, sql } from '../config/database';
import { listarDespesas } from './despesaService';

export interface EntradaAcerto {
  idMc: number;
  lotexx?: string;
  deslot?: string;
  nomeComprador?: string;
  valorEntrada: number;
}

export interface PromissoriaAcerto {
  datven: string;
  valor: number;
}

export interface AcertoVendedor {
  idLeilao: number;
  leilao?: string;
  datlei?: string;
  idVendedor: number;
  vendedor?: string;
  entradas: EntradaAcerto[];
  promissorias: PromissoriaAcerto[];
  lancamentos: Awaited<ReturnType<typeof listarDespesas>>;
  totais: {
    totalEntradas: number;
    totalPromissorias: number;
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

export async function calcularAcertoVendedor(idLeilao: number, idVendedor: number): Promise<AcertoVendedor> {
  const pool = await getPool();

  const rLeilao = await pool.request().input('id', sql.Int, idLeilao).query(`SELECT LEILAO, DATLEI FROM Leiloes WHERE ID=@id`);
  const rVendedor = await pool.request().input('id', sql.Int, idVendedor).query(`SELECT NOMEXX FROM Clientes WHERE ID=@id`);

  const rEntradas = await pool.request()
    .input('idLeilao', sql.Int, idLeilao)
    .input('idVendedor', sql.Int, idVendedor)
    .query(`
      SELECT MC.ID, LO.LOTEXX, LO.DESLOT, COM.NOMEXX AS NOME_COMPRADOR, MC.VALORPAGAR,
        (SELECT TOP 1 VLRPAR FROM MOVIMENTO_PARCELAMENTO WHERE IDMOVLOTE = MC.IDMOVLOTE AND PRIPAR = 'S') AS VALOR_ENTRADA
      FROM MOVIMENTO_COMPRADOR MC
      LEFT JOIN MOVIMENTO M       ON M.ID  = MC.IDMOV
      LEFT JOIN MOVIMENTO_LOTE ML ON ML.ID = MC.IDMOVLOTE
      LEFT JOIN LOTES LO          ON LO.ID = ML.IDLOTE
      LEFT JOIN CLIENTES COM      ON COM.ID = MC.IDCLI
      WHERE M.IDLEILAO = @idLeilao AND ML.CODVEN = @idVendedor
      ORDER BY TRY_CAST(LO.LOTEXX AS INT), LO.LOTEXX
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
  }));

  const rPromissorias = await pool.request()
    .input('idLeilao', sql.Int, idLeilao)
    .input('idVendedor', sql.Int, idVendedor)
    .query(`
      SELECT FORMAT(MP.DATVEN,'dd/MM/yyyy') AS DATVEN_F, SUM(MP.VLRPAR) AS VALOR
      FROM MOVIMENTO_PARCELAMENTO MP
      LEFT JOIN MOVIMENTO_LOTE ML ON ML.ID = MP.IDMOVLOTE
      LEFT JOIN MOVIMENTO M       ON M.ID  = ML.IDMOV
      WHERE M.IDLEILAO = @idLeilao AND ML.CODVEN = @idVendedor AND ISNULL(MP.PRIPAR, 'N') <> 'S'
      GROUP BY MP.DATVEN
      ORDER BY MP.DATVEN
    `);

  const promissorias: PromissoriaAcerto[] = rPromissorias.recordset.map((r: any) => ({
    datven: r.DATVEN_F,
    valor: r.VALOR || 0,
  }));

  const lancamentos = await listarDespesas(idLeilao, undefined, idVendedor);

  const totalEntradas = entradas.reduce((a, e) => a + e.valorEntrada, 0);
  const totalPromissorias = promissorias.reduce((a, p) => a + p.valor, 0);
  const totalDespesas = lancamentos.filter(l => ehDespesa(l.dc)).reduce((a, l) => a + (l.valor || 0), 0);
  const totalCreditos = lancamentos.filter(l => ehCredito(l.dc)).reduce((a, l) => a + (l.valor || 0), 0);
  const totalFechamentos = lancamentos.filter(l => l.dc === 'F').reduce((a, l) => a + (l.valor || 0), 0);
  const saldo = totalEntradas + totalCreditos - totalDespesas - totalFechamentos;

  return {
    idLeilao,
    leilao: rLeilao.recordset[0]?.LEILAO,
    datlei: rLeilao.recordset[0]?.DATLEI ? new Date(rLeilao.recordset[0].DATLEI).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
    idVendedor,
    vendedor: rVendedor.recordset[0]?.NOMEXX,
    entradas,
    promissorias,
    lancamentos,
    totais: { totalEntradas, totalPromissorias, totalDespesas, totalCreditos, totalFechamentos, saldo },
  };
}
