import { getPool, sql } from '../config/database';
import { listarDespesas } from './despesaService';

export interface CompraAcerto {
  idMc: number;
  lotexx?: string;
  deslot?: string;
  nomeVendedor?: string;
  valorEntrada: number;
  leilao?: string;
}

export interface PromissoriaAcerto {
  datven: string;
  valor: number;
}

export interface AcertoComprador {
  idLeilao?: number;
  leilao?: string;
  datlei?: string;
  idComprador: number;
  comprador?: string;
  compras: CompraAcerto[];
  promissorias: PromissoriaAcerto[];
  lancamentos: Awaited<ReturnType<typeof listarDespesas>>;
  totais: {
    totalPrimeirasParcelas: number;
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

export async function calcularAcertoComprador(idComprador: number, idLeilao?: number): Promise<AcertoComprador> {
  const pool = await getPool();

  const rComprador = await pool.request().input('id', sql.Int, idComprador).query(`SELECT NOMEXX FROM Clientes WHERE ID=@id`);

  const reqCompras = pool.request().input('idComprador', sql.Int, idComprador);
  if (idLeilao) reqCompras.input('idLeilao', sql.Int, idLeilao);
  const rCompras = await reqCompras.query(`
      SELECT MC.ID, LO.LOTEXX, LO.DESLOT, VEN.NOMEXX AS NOME_VENDEDOR, MC.VALORPAGAR, L.LEILAO,
        (SELECT TOP 1 VLRPAR FROM MOVIMENTO_PARCELAMENTO WHERE IDMOVLOTE = MC.IDMOVLOTE AND IDCLI = MC.IDCLI AND PRIPAR = 'S') AS VALOR_ENTRADA
      FROM MOVIMENTO_COMPRADOR MC
      LEFT JOIN MOVIMENTO M       ON M.ID  = MC.IDMOV
      LEFT JOIN MOVIMENTO_LOTE ML ON ML.ID = MC.IDMOVLOTE
      LEFT JOIN LOTES LO          ON LO.ID = ML.IDLOTE
      LEFT JOIN CLIENTES VEN      ON VEN.ID = ML.CODVEN
      LEFT JOIN LEILOES L         ON L.ID  = M.IDLEILAO
      WHERE MC.IDCLI = @idComprador ${idLeilao ? 'AND M.IDLEILAO = @idLeilao' : ''}
      ORDER BY L.DATLEI DESC, TRY_CAST(LO.LOTEXX AS INT), LO.LOTEXX
    `);

  const compras: CompraAcerto[] = rCompras.recordset.map((r: any) => ({
    idMc: r.ID,
    lotexx: r.LOTEXX,
    deslot: r.DESLOT,
    nomeVendedor: r.NOME_VENDEDOR,
    // Sem parcela marcada como PRIPAR='S' (ex.: Acerto Direto, Vencimento
    // Único), não existe entrada — o valor cheio já está em "promissórias"
    // (a pagar no futuro). Usar VALORPAGAR aqui duplicava esse valor.
    valorEntrada: r.VALOR_ENTRADA != null ? r.VALOR_ENTRADA : 0,
    leilao: r.LEILAO,
  }));

  const reqPromissorias = pool.request().input('idComprador', sql.Int, idComprador);
  if (idLeilao) reqPromissorias.input('idLeilao', sql.Int, idLeilao);
  const rPromissorias = await reqPromissorias.query(`
      SELECT FORMAT(MP.DATVEN,'dd/MM/yyyy') AS DATVEN_F, SUM(MP.VLRPAR) AS VALOR
      FROM MOVIMENTO_PARCELAMENTO MP
      WHERE MP.IDCLI = @idComprador AND ISNULL(MP.PRIPAR, 'N') <> 'S' ${idLeilao ? 'AND MP.CODLEI = @idLeilao' : ''}
      GROUP BY MP.DATVEN
      ORDER BY MP.DATVEN
    `);

  const promissorias: PromissoriaAcerto[] = rPromissorias.recordset.map((r: any) => ({
    datven: r.DATVEN_F,
    valor: r.VALOR || 0,
  }));

  const lancamentosBrutos = await listarDespesas(idLeilao, undefined, idComprador);

  // Comissão do comprador é gravada uma despesa por lote comprado (gerarParcelas),
  // pra cada uma poder ter recibo próprio — mas no Acerto de Comprador isso não
  // interessa individualmente, só o total debitado. Agrupa numa linha só.
  const comissoesComprador = lancamentosBrutos.filter(l => l.tipoOrigem === 'COMISSAO_COMPRADOR');
  const outrosLancamentos = lancamentosBrutos.filter(l => l.tipoOrigem !== 'COMISSAO_COMPRADOR');
  const totalComissaoComprador = comissoesComprador.reduce((a, l) => a + (l.valor || 0), 0);

  const lancamentos = totalComissaoComprador > 0.01
    ? [
        {
          id: 0,
          codLei: idLeilao,
          codigoCliente: idComprador,
          dc: 'D' as const,
          valor: totalComissaoComprador,
          observacoes: `${comissoesComprador.length} lote${comissoesComprador.length > 1 ? 's' : ''}`,
          dataInclusao: undefined,
          dataAlteracao: undefined,
          leilao: undefined,
          cliente: undefined,
          tipoOrigem: 'COMISSAO_COMPRADOR' as const,
          agrupado: true,
        },
        ...outrosLancamentos,
      ]
    : outrosLancamentos;

  const totalPrimeirasParcelas = compras.reduce((a, e) => a + e.valorEntrada, 0);
  const totalPromissorias = promissorias.reduce((a, p) => a + p.valor, 0);
  // Comissão sai do total de Despesas — tem linha (e card) própria, não é despesa.
  const totalDespesas = outrosLancamentos.filter(l => ehDespesa(l.dc)).reduce((a, l) => a + (l.valor || 0), 0);
  const totalCreditos = outrosLancamentos.filter(l => ehCredito(l.dc)).reduce((a, l) => a + (l.valor || 0), 0);
  const totalFechamentos = outrosLancamentos.filter(l => l.dc === 'F').reduce((a, l) => a + (l.valor || 0), 0);
  // Saldo do comprador é a soma do que ele deve agora (1ª parcela + comissão
  // dele), abatido do que já foi creditado/fechado — não segue a mesma
  // fórmula do vendedor (despesas manuais não entram nessa conta, só informam).
  const saldo = totalPrimeirasParcelas + totalComissaoComprador - totalCreditos - totalFechamentos;

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
    idComprador,
    comprador: rComprador.recordset[0]?.NOMEXX,
    compras,
    promissorias,
    lancamentos,
    totais: { totalPrimeirasParcelas, totalPromissorias, totalComissao: totalComissaoComprador, totalDespesas, totalCreditos, totalFechamentos, saldo },
  };
}
