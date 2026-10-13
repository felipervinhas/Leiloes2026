import { getPool, sql } from '../../config/database';

// O que está em aberto para a conciliação, sempre lido das tabelas atuais do
// sistema de leilões (nada é copiado): parcelas e comissão de compra do lado
// do comprador, e repasses lançados no Acerto do Vendedor do lado do vendedor.

export type TipoItem = 'PARCELA' | 'COMISSAO_COMPRA' | 'REPASSE';

export interface ItemAberto {
  chave: string;              // `${tipo}:${id}` — identifica o item nas baixas e nas sugestões
  tipo: TipoItem;
  id: number;                 // MOVIMENTO_PARCELAMENTO.ID | MOVIMENTO_COMPRADOR.ID | DESPESAS.CODIGO
  idCliente: number;          // comprador (parcela/comissão) ou vendedor (repasse)
  idMovComprador: number | null;
  idLeilao: number | null;
  leilao: string | null;
  lote: string | null;
  descricao: string;          // "Parcela 02/50", "Comissão de compra", "Repasse: <obs>"
  vencimento: string | null;  // 'YYYY-MM-DD'
  valor: number;
  pago: number;               // baixas confirmadas e não desfeitas
  saldo: number;
  /** Parcela dentro dos primeiros grupos da condição (passa pela leiloeira); comissão também conta. */
  daLeiloeira: boolean;
}

/** Quantos grupos da condição de pagamento passam pela leiloeira quando não há regra própria (o "2 + 2"). */
export const GRUPOS_PADRAO = 2;
/** Janela de vendas consideradas. */
const MESES_VENDAS = 24;

const r2 = (v: number) => Math.round(v * 100) / 100;
const iso = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/** Valor já baixado por item (chave), só baixas não desfeitas. */
async function pagosPorItem(): Promise<Map<string, number>> {
  const pool = await getPool();
  const m = new Map<string, number>();
  // o cálculo também serve para simular sem gravar (empresa ainda sem as tabelas CONC_)
  if (!(await existeTabela('CONC_BAIXAS'))) return m;
  const r = await pool.request().query(`
    SELECT TIPO_ALVO, ID_PARCELA, ID_MOV_COMPRADOR, ID_DESPESA, SUM(VALOR) AS VALOR
    FROM CONC_BAIXAS WHERE DESFEITA = 'N' AND TIPO_ALVO IN ('PARCELA','COMISSAO_COMPRA','REPASSE')
    GROUP BY TIPO_ALVO, ID_PARCELA, ID_MOV_COMPRADOR, ID_DESPESA`);
  for (const x of r.recordset) {
    const id = x.TIPO_ALVO === 'PARCELA' ? x.ID_PARCELA : x.TIPO_ALVO === 'REPASSE' ? x.ID_DESPESA : x.ID_MOV_COMPRADOR;
    m.set(`${x.TIPO_ALVO}:${id}`, Number(x.VALOR));
  }
  return m;
}

async function existeTabela(nome: string): Promise<boolean> {
  const pool = await getPool();
  const r = await pool.request().input('n', sql.VarChar, nome).query(`SELECT OBJECT_ID(@n) AS X`);
  return r.recordset[0].X != null;
}

function inClientes(req: sql.Request, ids: number[], prefixo: string) {
  return ids.map((id, i) => { req.input(`${prefixo}${i}`, sql.Int, id); return `@${prefixo}${i}`; }).join(',');
}

/**
 * Itens dos clientes informados. Comprador: todas as parcelas e a comissão de compra
 * das vendas dos últimos 24 meses (o teste com o extrato real mostrou compradores
 * pagando à leiloeira parcelas depois das iniciais). Vendedor: repasses lançados no
 * Acerto (DESPESAS tipo F) no mesmo período.
 */
export async function itensDosClientes(ids: number[], opcoes: { incluirQuitados?: boolean; idLeilao?: number } = {}): Promise<ItemAberto[]> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return [];
  const pool = await getPool();
  const pagos = await pagosPorItem();
  const comGrupos = await existeTabela('CONC_CONDICAO_GRUPOS');
  const itens: ItemAberto[] = [];

  for (let i = 0; i < unicos.length; i += 400) {
    const lote = unicos.slice(i, i + 400);

    const rp = pool.request();
    const psP = inClientes(rp, lote, 'c');
    if (opcoes.idLeilao) rp.input('leilao', sql.Int, opcoes.idLeilao);
    const parcelas = await rp.query(`
      SELECT P.ID, P.IDCLI, P.LOTEXX, P.ORDXXX, P.VLRPAR, P.DATVEN, MC.ID AS ID_MC, M.IDLEILAO, L.LEILAO,
             ${comGrupos ? `ISNULL(G.GRUPOS_LEILOEIRA, ${GRUPOS_PADRAO})` : GRUPOS_PADRAO} AS GRUPOS,
             TRY_CAST(CP.PARC01 AS INT) P1, TRY_CAST(CP.PARC02 AS INT) P2, TRY_CAST(CP.PARC03 AS INT) P3,
             TRY_CAST(CP.PARC04 AS INT) P4, TRY_CAST(CP.PARC05 AS INT) P5, TRY_CAST(CP.PARC06 AS INT) P6
      FROM MOVIMENTO_PARCELAMENTO P
      JOIN MOVIMENTO M              ON M.ID = P.IDMOV
      LEFT JOIN LEILOES L           ON L.ID = M.IDLEILAO
      LEFT JOIN MOVIMENTO_COMPRADOR MC ON MC.IDMOVLOTE = P.IDMOVLOTE AND MC.IDCLI = P.IDCLI
      LEFT JOIN CONDICAOPAGTOS CP   ON CP.ID = MC.IDCONDPAGTO
      ${comGrupos ? 'LEFT JOIN CONC_CONDICAO_GRUPOS G ON G.ID_CONDPAGTO = MC.IDCONDPAGTO' : ''}
      WHERE P.IDCLI IN (${psP}) AND M.DATLAN >= DATEADD(MONTH, -${MESES_VENDAS}, GETDATE())
        ${opcoes.idLeilao ? 'AND M.IDLEILAO = @leilao' : ''}`);
    for (const x of parcelas.recordset) {
      // "04/50" = contagem acumulada de unidades; os N primeiros grupos da condição passam pela leiloeira
      const numero = parseInt(String(x.ORDXXX || '').split('/')[0], 10);
      const grupos = [x.P1, x.P2, x.P3, x.P4, x.P5, x.P6].map(v => Number(v) || 0);
      const limite = grupos.slice(0, Math.max(1, Number(x.GRUPOS) || GRUPOS_PADRAO)).reduce((a, b) => a + b, 0);
      const chave = `PARCELA:${x.ID}`;
      const valor = r2(Number(x.VLRPAR) || 0);
      const pago = r2(pagos.get(chave) || 0);
      itens.push({
        chave, tipo: 'PARCELA', id: x.ID, idCliente: Number(x.IDCLI), idMovComprador: x.ID_MC ?? null,
        idLeilao: x.IDLEILAO, leilao: x.LEILAO, lote: x.LOTEXX?.trim() || null,
        descricao: `Parcela ${x.ORDXXX || ''}`.trim(), vencimento: iso(x.DATVEN),
        valor, pago, saldo: r2(valor - pago),
        // condição sem grupos iniciais (só saldo, ex.: "25 PARCELAS", "1 PARCELA", ou venda sem condição):
        // vale só a 1ª parcela. A marcação PRIPAR sozinha não serve: vendas antigas têm várias parcelas marcadas.
        daLeiloeira: Number.isFinite(numero) && (limite > 0 ? numero <= limite : numero === 1),
      });
    }

    const rc = pool.request();
    const psC = lote.map((id, j) => { rc.input(`s${j}`, sql.VarChar, String(id)); return `@s${j}`; }).join(',');
    if (opcoes.idLeilao) rc.input('leilao', sql.Int, opcoes.idLeilao);
    // IDCLI do comprador da venda é texto no banco
    const comissoes = await rc.query(`
      SELECT MC.ID, MC.IDCLI, MC.VALORCOMISSAO, M.DATLAN, M.IDLEILAO, L.LEILAO, ML.LOTEXX
      FROM MOVIMENTO_COMPRADOR MC
      JOIN MOVIMENTO M          ON M.ID = MC.IDMOV
      LEFT JOIN MOVIMENTO_LOTE ML ON ML.ID = MC.IDMOVLOTE
      LEFT JOIN LEILOES L       ON L.ID = M.IDLEILAO
      WHERE MC.IDCLI IN (${psC}) AND MC.VALORCOMISSAO > 0
        AND M.DATLAN >= DATEADD(MONTH, -${MESES_VENDAS}, GETDATE())
        ${opcoes.idLeilao ? 'AND M.IDLEILAO = @leilao' : ''}`);
    for (const x of comissoes.recordset) {
      const chave = `COMISSAO_COMPRA:${x.ID}`;
      const valor = r2(Number(x.VALORCOMISSAO) || 0);
      const pago = r2(pagos.get(chave) || 0);
      itens.push({
        chave, tipo: 'COMISSAO_COMPRA', id: x.ID, idCliente: Number(x.IDCLI), idMovComprador: x.ID,
        idLeilao: x.IDLEILAO, leilao: x.LEILAO, lote: x.LOTEXX?.trim() || null,
        descricao: 'Comissão de compra', vencimento: iso(x.DATLAN),
        valor, pago, saldo: r2(valor - pago), daLeiloeira: true,
      });
    }

    const rr = pool.request();
    const psR = inClientes(rr, lote, 'v');
    if (opcoes.idLeilao) rr.input('leilao', sql.Int, opcoes.idLeilao);
    const repasses = await rr.query(`
      SELECT D.CODIGO, D.CODIGO_CLIENTE, D.VALOR, D.OBSERVACOES, D.DATA_INCLUSAO, D.CODLEI, L.LEILAO
      FROM DESPESAS D LEFT JOIN LEILOES L ON L.ID = D.CODLEI
      WHERE D.D_C = 'F' AND D.CODIGO_CLIENTE IN (${psR})
        AND D.DATA_INCLUSAO >= DATEADD(MONTH, -${MESES_VENDAS}, GETDATE())
        ${opcoes.idLeilao ? 'AND D.CODLEI = @leilao' : ''}`);
    for (const x of repasses.recordset) {
      const chave = `REPASSE:${x.CODIGO}`;
      const valor = r2(Math.abs(Number(x.VALOR) || 0));
      const pago = r2(pagos.get(chave) || 0);
      itens.push({
        chave, tipo: 'REPASSE', id: x.CODIGO, idCliente: Number(x.CODIGO_CLIENTE), idMovComprador: null,
        idLeilao: x.CODLEI, leilao: x.LEILAO, lote: null,
        descricao: `Repasse${x.OBSERVACOES ? `: ${String(x.OBSERVACOES).trim()}` : ''}`, vencimento: iso(x.DATA_INCLUSAO),
        valor, pago, saldo: r2(valor - pago), daLeiloeira: false,
      });
    }
  }

  return opcoes.incluirQuitados ? itens : itens.filter(it => it.saldo > 0.009);
}
