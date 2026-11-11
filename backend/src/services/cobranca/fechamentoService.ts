import { getPool, sql } from '../../config/database';
import { existeTabela } from '../conciliacao/devidoService';
import { CobrancaError, UsuarioCobranca } from './acessoService';
import { listarParcelas, ParcelaCobranca } from './parcelasService';
import { garantirTabelasCobranca } from './schema';

// Fechamento mensal por vendedor: as baixas das parcelas em cobrança com pagamento até o
// fim do mês e ainda fora de qualquer fechamento (a baixa lançada depois de um mês fechado
// entra no seguinte). Taxa = valor recebido × taxa do lote. Dinheiro que caiu na conta da
// leiloeira: a taxa fica retida e o resto é repassado; na conta do vendedor: a taxa é cobrada dele.
// Quitações ANTERIOR (antes de entrar na cobrança) não entram.

export interface ItemFechamento {
  origem: 'COBR' | 'CONC';
  idBaixa: number;
  idParcela: number;
  idLote: number;
  idVendedor: number;
  recebidoEm: 'MACEDO' | 'VENDEDOR';
  dataPagamento: string;
  valor: number;
  taxaPerc: number;
  taxaValor: number;
  parcela?: ParcelaCobranca;
}

export interface Totais {
  qtdParcelas: number;
  recebidoMacedo: number;
  recebidoVendedor: number;
  taxaRetida: number;
  taxaACobrar: number;
  /** > 0: a leiloeira repassa ao vendedor; < 0: o vendedor paga a taxa à leiloeira */
  saldo: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const iso = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export function fimDoMes(competencia: string): string {
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new CobrancaError(400, 'Competência inválida (use AAAA-MM)');
  const [a, m] = competencia.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

export function totalizar(itens: ItemFechamento[]): Totais {
  const t: Totais = { qtdParcelas: new Set(itens.map(i => i.idParcela)).size, recebidoMacedo: 0, recebidoVendedor: 0, taxaRetida: 0, taxaACobrar: 0, saldo: 0 };
  for (const i of itens) {
    if (i.recebidoEm === 'MACEDO') { t.recebidoMacedo += i.valor; t.taxaRetida += i.taxaValor; }
    else { t.recebidoVendedor += i.valor; t.taxaACobrar += i.taxaValor; }
  }
  t.recebidoMacedo = r2(t.recebidoMacedo); t.recebidoVendedor = r2(t.recebidoVendedor);
  t.taxaRetida = r2(t.taxaRetida); t.taxaACobrar = r2(t.taxaACobrar);
  t.saldo = r2(t.recebidoMacedo - t.taxaRetida - t.taxaACobrar);
  return t;
}

/** Baixas ainda sem fechamento, com pagamento até a data. */
export async function baixasPendentes(ate: string, idVendedor?: number): Promise<ItemFechamento[]> {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const parcelas = new Map((await listarParcelas({ idVendedor })).map(p => [p.id, p]));
  if (!parcelas.size) return [];
  const inclusao = new Map<number, string>(
    (await pool.request().query(`SELECT ID_LOTE, DATA FROM COBR_LOTES WHERE ATIVA = 'S'`)).recordset.map((x: any) => [x.ID_LOTE, iso(x.DATA)]));

  const itens: ItemFechamento[] = [];
  const add = (origem: 'COBR' | 'CONC', x: any, recebidoEm: 'MACEDO' | 'VENDEDOR') => {
    const p = parcelas.get(x.ID_PARCELA);
    if (!p) return;
    const data = iso(x.DATA_PAGAMENTO);
    // extrato conciliado antes de o lote entrar na cobrança: já era do vendedor, sem taxa
    if (origem === 'CONC' && data < (inclusao.get(p.idLote) || '')) return;
    const valor = r2(Number(x.VALOR));
    itens.push({
      origem, idBaixa: x.ID, idParcela: p.id, idLote: p.idLote, idVendedor: p.idVendedor, recebidoEm,
      dataPagamento: data, valor, taxaPerc: p.taxa, taxaValor: r2(valor * p.taxa / 100), parcela: p,
    });
  };

  const rc = await pool.request().input('ate', sql.Date, ate).query(`
    SELECT B.ID, B.ID_PARCELA, B.DATA_PAGAMENTO, B.VALOR, B.RECEBIDO_EM FROM COBR_BAIXAS B
    WHERE B.DESFEITA = 'N' AND B.ORIGEM = 'MANUAL' AND B.DATA_PAGAMENTO <= @ate
      AND NOT EXISTS (SELECT 1 FROM COBR_FECHAMENTO_ITENS I WHERE I.ORIGEM = 'COBR' AND I.ID_BAIXA = B.ID)`);
  for (const x of rc.recordset) add('COBR', x, x.RECEBIDO_EM === 'MACEDO' ? 'MACEDO' : 'VENDEDOR');

  if (await existeTabela('CONC_BAIXAS')) {
    const rk = await pool.request().input('ate', sql.Date, ate).query(`
      SELECT B.ID, B.ID_PARCELA, LC.DATA AS DATA_PAGAMENTO, B.VALOR FROM CONC_BAIXAS B
      JOIN CONC_LANCAMENTOS LC ON LC.ID = B.ID_LANCAMENTO
      WHERE B.DESFEITA = 'N' AND B.TIPO_ALVO = 'PARCELA' AND LC.DATA <= @ate
        AND NOT EXISTS (SELECT 1 FROM COBR_FECHAMENTO_ITENS I WHERE I.ORIGEM = 'CONC' AND I.ID_BAIXA = B.ID)`);
    for (const x of rk.recordset) add('CONC', x, 'MACEDO');
  }
  return itens.sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento));
}

const mapFechamento = (x: any) => ({
  id: x.ID, idVendedor: x.ID_VENDEDOR, vendedor: x.NOMEXX ?? null, competencia: x.COMPETENCIA,
  qtdParcelas: x.QTD_PARCELAS, recebidoMacedo: Number(x.RECEBIDO_MACEDO), recebidoVendedor: Number(x.RECEBIDO_VENDEDOR),
  taxaRetida: Number(x.TAXA_RETIDA), taxaACobrar: Number(x.TAXA_A_COBRAR), saldo: Number(x.SALDO),
  situacao: x.SITUACAO, observacao: x.OBSERVACAO, dataFechamento: x.DATA_FECHAMENTO, dataCobranca: x.DATA_COBRANCA,
  dataPagamento: x.DATA_PAGAMENTO, usuario: x.NOME_USUARIO,
});

/** Tela do mês: por vendedor, o que já foi fechado na competência e o que ainda está pendente até o fim dela. */
export async function competencia(comp: string, idVendedor?: number) {
  const fim = fimDoMes(comp);
  await garantirTabelasCobranca();
  const pool = await getPool();
  const pend = await baixasPendentes(fim, idVendedor);
  const req = pool.request().input('c', sql.Char(7), comp);
  if (idVendedor) req.input('v', sql.Int, idVendedor);
  const fech = (await req.query(`
    SELECT F.*, C.NOMEXX FROM COBR_FECHAMENTOS F LEFT JOIN CLIENTES C ON C.ID = F.ID_VENDEDOR
    WHERE F.COMPETENCIA = @c ${idVendedor ? 'AND F.ID_VENDEDOR = @v' : ''}`)).recordset.map(mapFechamento);

  const porVendedor = new Map<number, { idVendedor: number; vendedor: string | null; pendente: Totais | null; fechamento: any }>();
  const grupos = new Map<number, ItemFechamento[]>();
  for (const i of pend) grupos.set(i.idVendedor, [...(grupos.get(i.idVendedor) || []), i]);
  for (const [idV, its] of grupos) porVendedor.set(idV, { idVendedor: idV, vendedor: its[0].parcela?.vendedor ?? null, pendente: totalizar(its), fechamento: null });
  for (const f of fech) {
    const atual = porVendedor.get(f.idVendedor) || { idVendedor: f.idVendedor, vendedor: f.vendedor, pendente: null, fechamento: null };
    atual.fechamento = f;
    porVendedor.set(f.idVendedor, atual);
  }
  return { competencia: comp, ate: fim, vendedores: [...porVendedor.values()].sort((a, b) => String(a.vendedor).localeCompare(String(b.vendedor))) };
}

/** Itens pendentes de um vendedor na competência (prévia antes de fechar). */
export async function previaVendedor(comp: string, idVendedor: number) {
  const itens = await baixasPendentes(fimDoMes(comp), idVendedor);
  return { itens: itens.map(semParcelaInteira), totais: totalizar(itens) };
}

const semParcelaInteira = (i: ItemFechamento) => ({
  ...i, parcela: undefined,
  lote: i.parcela?.lote, animal: i.parcela?.animal, leilao: i.parcela?.leilao, comprador: i.parcela?.comprador,
  ordxxx: i.parcela?.ordxxx, vencimento: i.parcela?.vencimento,
});

export async function fechar(comp: string, idVendedor: number, observacao: string | undefined, usuario: UsuarioCobranca) {
  const itens = await baixasPendentes(fimDoMes(comp), idVendedor);
  if (!itens.length) throw new CobrancaError(400, 'Nenhum recebimento pendente para este vendedor até o fim do mês');
  const t = totalizar(itens);
  const pool = await getPool();
  const existe = await pool.request().input('v', sql.Int, idVendedor).input('c', sql.Char(7), comp)
    .query(`SELECT ID FROM COBR_FECHAMENTOS WHERE ID_VENDEDOR = @v AND COMPETENCIA = @c`);
  if (existe.recordset.length) throw new CobrancaError(409, 'Este mês já está fechado para o vendedor. Reabra o fechamento para incluir os novos recebimentos, ou eles entram no mês seguinte.');
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const r = await new sql.Request(tx)
      .input('v', sql.Int, idVendedor).input('c', sql.Char(7), comp).input('q', sql.Int, t.qtdParcelas)
      .input('rm', sql.Decimal(18, 2), t.recebidoMacedo).input('rv', sql.Decimal(18, 2), t.recebidoVendedor)
      .input('tr', sql.Decimal(18, 2), t.taxaRetida).input('tc', sql.Decimal(18, 2), t.taxaACobrar).input('s', sql.Decimal(18, 2), t.saldo)
      .input('obs', sql.VarChar(255), observacao?.slice(0, 255) || null)
      .input('uid', sql.Int, usuario.id ?? null).input('unome', sql.VarChar(100), usuario.nome ?? null)
      .query(`INSERT INTO COBR_FECHAMENTOS (ID_VENDEDOR, COMPETENCIA, QTD_PARCELAS, RECEBIDO_MACEDO, RECEBIDO_VENDEDOR, TAXA_RETIDA, TAXA_A_COBRAR, SALDO, OBSERVACAO, ID_USUARIO, NOME_USUARIO)
              OUTPUT INSERTED.ID VALUES (@v, @c, @q, @rm, @rv, @tr, @tc, @s, @obs, @uid, @unome)`);
    const idF = r.recordset[0].ID;
    for (const i of itens) {
      await new sql.Request(tx)
        .input('f', sql.Int, idF).input('o', sql.VarChar(4), i.origem).input('b', sql.Int, i.idBaixa).input('p', sql.Int, i.idParcela)
        .input('l', sql.Int, i.idLote).input('rec', sql.VarChar(10), i.recebidoEm).input('d', sql.Date, i.dataPagamento)
        .input('val', sql.Decimal(18, 2), i.valor).input('tp', sql.Decimal(5, 2), i.taxaPerc).input('tv', sql.Decimal(18, 2), i.taxaValor)
        .query(`INSERT INTO COBR_FECHAMENTO_ITENS (ID_FECHAMENTO, ORIGEM, ID_BAIXA, ID_PARCELA, ID_LOTE, RECEBIDO_EM, DATA_PAGAMENTO, VALOR, TAXA_PERC, TAXA_VALOR)
                VALUES (@f, @o, @b, @p, @l, @rec, @d, @val, @tp, @tv)`);
    }
    await tx.commit();
    return { id: idF, ...t };
  } catch (e) { await tx.rollback(); throw e; }
}

async function buscar(id: number) {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id)
    .query(`SELECT F.*, C.NOMEXX FROM COBR_FECHAMENTOS F LEFT JOIN CLIENTES C ON C.ID = F.ID_VENDEDOR WHERE F.ID = @id`);
  if (!r.recordset.length) throw new CobrancaError(404, 'Fechamento não encontrado');
  return mapFechamento(r.recordset[0]);
}

/** Desfaz um fechamento ainda não cobrado: as baixas voltam a ficar pendentes. */
export async function reabrir(id: number) {
  const f = await buscar(id);
  if (f.situacao !== 'FECHADO') throw new CobrancaError(409, 'Só dá para reabrir fechamento que ainda não foi cobrado nem pago');
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).input('id', sql.Int, id).query(`DELETE FROM COBR_FECHAMENTO_ITENS WHERE ID_FECHAMENTO = @id`);
    await new sql.Request(tx).input('id', sql.Int, id).query(`DELETE FROM COBR_FECHAMENTOS WHERE ID = @id`);
    await tx.commit();
  } catch (e) { await tx.rollback(); throw e; }
}

const ORDEM = ['FECHADO', 'COBRADO', 'PAGO'];
/** Avança (ou volta um passo) a situação: FECHADO → COBRADO → PAGO. */
export async function mudarSituacao(id: number, situacao: string) {
  if (!ORDEM.includes(situacao)) throw new CobrancaError(400, 'Situação inválida');
  await buscar(id);
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).input('s', sql.VarChar(10), situacao).query(`
    UPDATE COBR_FECHAMENTOS SET SITUACAO = @s,
      DATA_COBRANCA  = CASE WHEN @s = 'FECHADO' THEN NULL WHEN @s IN ('COBRADO','PAGO') THEN ISNULL(DATA_COBRANCA, GETDATE()) END,
      DATA_PAGAMENTO = CASE WHEN @s = 'PAGO' THEN ISNULL(DATA_PAGAMENTO, GETDATE()) ELSE NULL END
    WHERE ID = @id`);
}

export async function listar(f: { idVendedor?: number; situacao?: string; de?: string; ate?: string }) {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const req = pool.request();
  const conds: string[] = [];
  if (f.idVendedor) { req.input('v', sql.Int, f.idVendedor); conds.push('F.ID_VENDEDOR = @v'); }
  if (f.situacao) { req.input('s', sql.VarChar(10), f.situacao); conds.push('F.SITUACAO = @s'); }
  if (f.de) { req.input('de', sql.Char(7), f.de); conds.push('F.COMPETENCIA >= @de'); }
  if (f.ate) { req.input('ate', sql.Char(7), f.ate); conds.push('F.COMPETENCIA <= @ate'); }
  const r = await req.query(`
    SELECT TOP 500 F.*, C.NOMEXX FROM COBR_FECHAMENTOS F LEFT JOIN CLIENTES C ON C.ID = F.ID_VENDEDOR
    ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''} ORDER BY F.COMPETENCIA DESC, C.NOMEXX`);
  return r.recordset.map(mapFechamento);
}

export async function detalhe(id: number) {
  const f = await buscar(id);
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`
    SELECT I.*, P.ORDXXX, P.DATVEN, P.IDCLI, CC.NOMEXX AS COMPRADOR, LO.LOTEXX, LO.DESLOT, LE.LEILAO
    FROM COBR_FECHAMENTO_ITENS I
    LEFT JOIN MOVIMENTO_PARCELAMENTO P ON P.ID = I.ID_PARCELA
    LEFT JOIN CLIENTES CC ON CC.ID = P.IDCLI
    LEFT JOIN LOTES LO ON LO.ID = I.ID_LOTE
    LEFT JOIN LEILOES LE ON LE.ID = LO.IDLEILAO
    WHERE I.ID_FECHAMENTO = @id ORDER BY I.DATA_PAGAMENTO, I.ID`);
  return {
    fechamento: f,
    itens: r.recordset.map((x: any) => ({
      origem: x.ORIGEM, idBaixa: x.ID_BAIXA, idParcela: x.ID_PARCELA, idLote: x.ID_LOTE, recebidoEm: x.RECEBIDO_EM,
      dataPagamento: iso(x.DATA_PAGAMENTO), valor: Number(x.VALOR), taxaPerc: Number(x.TAXA_PERC), taxaValor: Number(x.TAXA_VALOR),
      ordxxx: x.ORDXXX ? String(x.ORDXXX).trim() : null, vencimento: iso(x.DATVEN) || null, comprador: x.COMPRADOR,
      lote: x.LOTEXX ? String(x.LOTEXX).trim() : null, animal: x.DESLOT ? String(x.DESLOT).trim() : null, leilao: x.LEILAO,
    })),
  };
}
