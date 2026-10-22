import { getPool, sql } from '../../config/database';

// O que está em aberto para a conciliação, sempre lido das tabelas atuais do
// sistema de leilões (nada é copiado): parcelas e comissão de compra do lado
// do comprador, e repasses lançados no Acerto do Vendedor do lado do vendedor
// (ou, sem repasse lançado, o saldo do próprio Acerto).

export type TipoItem = 'PARCELA' | 'COMISSAO_COMPRA' | 'REPASSE' | 'ACERTO' | 'DESPESA';

/** Item que a leiloeira paga ao vendedor (débito do extrato). */
export const ehDoVendedor = (tipo: string) => tipo === 'REPASSE' || tipo === 'ACERTO';

export interface ItemAberto {
  chave: string;              // `${tipo}:${id}` — identifica o item nas baixas e nas sugestões
  tipo: TipoItem;
  id: number;                 // MOVIMENTO_PARCELAMENTO.ID | MOVIMENTO_COMPRADOR.ID | DESPESAS.CODIGO | LEILOES.ID (acerto)
  idCliente: number;          // comprador (parcela/comissão) ou vendedor (repasse/acerto)
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
const fmtReais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Colunas da condição de pagamento que a regra precisa (PARC01..06 e os grupos da leiloeira). */
export const SQL_COLUNAS_GRUPOS = (comGrupos: boolean) => `
  ${comGrupos ? `ISNULL(G.GRUPOS_LEILOEIRA, ${GRUPOS_PADRAO})` : GRUPOS_PADRAO} AS GRUPOS,
  TRY_CAST(CP.PARC01 AS INT) P1, TRY_CAST(CP.PARC02 AS INT) P2, TRY_CAST(CP.PARC03 AS INT) P3,
  TRY_CAST(CP.PARC04 AS INT) P4, TRY_CAST(CP.PARC05 AS INT) P5, TRY_CAST(CP.PARC06 AS INT) P6`;

/**
 * A parcela passa pela leiloeira? "04/50" é a contagem acumulada de unidades; passam os
 * N primeiros grupos da condição (PARC01, PARC02...). Condição sem grupos iniciais
 * (só saldo, ex.: "25 PARCELAS", "1 PARCELA", ou venda sem condição): só a 1ª parcela.
 * A marcação PRIPAR sozinha não serve: vendas antigas têm várias parcelas marcadas.
 */
export function ehParcelaDaLeiloeira(x: { ORDXXX?: string; GRUPOS?: number; P1?: number; P2?: number; P3?: number; P4?: number; P5?: number; P6?: number }): boolean {
  const numero = parseInt(String(x.ORDXXX || '').split('/')[0], 10);
  if (!Number.isFinite(numero)) return false;
  const grupos = [x.P1, x.P2, x.P3, x.P4, x.P5, x.P6].map(v => Number(v) || 0);
  const limite = grupos.slice(0, Math.max(1, Number(x.GRUPOS) || GRUPOS_PADRAO)).reduce((a, b) => a + b, 0);
  return limite > 0 ? numero <= limite : numero === 1;
}
const iso = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/** Valor já baixado por item (chave), só baixas não desfeitas. */
export async function pagosPorItem(): Promise<Map<string, number>> {
  const pool = await getPool();
  const m = new Map<string, number>();
  // o cálculo também serve para simular sem gravar (empresa ainda sem as tabelas CONC_)
  if (!(await existeTabela('CONC_BAIXAS'))) return m;
  const r = await pool.request().query(`
    SELECT TIPO_ALVO, ID_PARCELA, ID_MOV_COMPRADOR, ID_DESPESA,
           CASE WHEN TIPO_ALVO = 'ACERTO' THEN ID_LEILAO END AS ID_LEILAO,
           CASE WHEN TIPO_ALVO = 'ACERTO' THEN ID_VENDEDOR END AS ID_VENDEDOR, SUM(VALOR) AS VALOR
    FROM CONC_BAIXAS WHERE DESFEITA = 'N' AND TIPO_ALVO IN ('PARCELA','COMISSAO_COMPRA','REPASSE','ACERTO','DESPESA')
    GROUP BY TIPO_ALVO, ID_PARCELA, ID_MOV_COMPRADOR, ID_DESPESA,
             CASE WHEN TIPO_ALVO = 'ACERTO' THEN ID_LEILAO END, CASE WHEN TIPO_ALVO = 'ACERTO' THEN ID_VENDEDOR END`);
  for (const x of r.recordset) m.set(chaveDaBaixa(x), Number(x.VALOR));
  return m;
}

/** Chave do item que uma linha de CONC_BAIXAS pagou (mesmo formato de ItemAberto.chave). */
export function chaveDaBaixa(b: { TIPO_ALVO: string; ID_PARCELA?: number; ID_MOV_COMPRADOR?: number; ID_DESPESA?: number; ID_LEILAO?: number; ID_VENDEDOR?: number }) {
  const t = b.TIPO_ALVO;
  if (t === 'ACERTO') return chaveAcerto(b.ID_LEILAO!, b.ID_VENDEDOR!);
  return `${t}:${t === 'PARCELA' ? b.ID_PARCELA : t === 'REPASSE' || t === 'DESPESA' ? b.ID_DESPESA : b.ID_MOV_COMPRADOR}`;
}
export const chaveAcerto = (idLeilao: number, idVendedor: number) => `ACERTO:${idLeilao}:${idVendedor}`;

export async function existeTabela(nome: string): Promise<boolean> {
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
 * Acerto (DESPESAS tipo F) no mesmo período; no leilão em que o vendedor não tem repasse
 * lançado (o escritório pagou sem lançar o fechamento), o saldo do Acerto do Vendedor.
 * Com repasse lançado mas ainda saldo no Acerto (pagou em duas vezes e lançou só uma),
 * o saldo restante também entra como item ACERTO.
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
             ${SQL_COLUNAS_GRUPOS(comGrupos)}
      FROM MOVIMENTO_PARCELAMENTO P
      JOIN MOVIMENTO M              ON M.ID = P.IDMOV
      LEFT JOIN LEILOES L           ON L.ID = M.IDLEILAO
      LEFT JOIN MOVIMENTO_COMPRADOR MC ON MC.IDMOVLOTE = P.IDMOVLOTE AND MC.IDCLI = P.IDCLI
      LEFT JOIN CONDICAOPAGTOS CP   ON CP.ID = MC.IDCONDPAGTO
      ${comGrupos ? 'LEFT JOIN CONC_CONDICAO_GRUPOS G ON G.ID_CONDPAGTO = MC.IDCONDPAGTO' : ''}
      WHERE P.IDCLI IN (${psP}) AND M.DATLAN >= DATEADD(MONTH, -${MESES_VENDAS}, GETDATE())
        ${opcoes.idLeilao ? 'AND M.IDLEILAO = @leilao' : ''}`);
    for (const x of parcelas.recordset) {
      const chave = `PARCELA:${x.ID}`;
      const valor = r2(Number(x.VLRPAR) || 0);
      const pago = r2(pagos.get(chave) || 0);
      itens.push({
        chave, tipo: 'PARCELA', id: x.ID, idCliente: Number(x.IDCLI), idMovComprador: x.ID_MC ?? null,
        idLeilao: x.IDLEILAO, leilao: x.LEILAO, lote: x.LOTEXX?.trim() || null,
        descricao: `Parcela ${x.ORDXXX || ''}`.trim(), vencimento: iso(x.DATVEN),
        valor, pago, saldo: r2(valor - pago),
        daLeiloeira: ehParcelaDaLeiloeira(x),
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

    // Saldo do Acerto do Vendedor por leilão, com a conta de calcularAcertoVendedor:
    // entradas (parcela PRIPAR de cada comprador) + créditos − comissão de venda − despesas
    // − repasses (F) já lançados. Sem fechamento é o saldo inteiro; com fechamento, só o que
    // passa dos repasses lançados (esses entram pelos itens REPASSE acima).
    const ra = pool.request();
    const psA = lote.map((id, j) => { ra.input(`a${j}`, sql.VarChar, String(id)); return `@a${j}`; }).join(',');
    if (opcoes.idLeilao) ra.input('leilao', sql.Int, opcoes.idLeilao);
    // CODVEN do lote é texto no banco
    const acertos = await ra.query(`
      WITH V AS (
        SELECT TRY_CAST(ML.CODVEN AS INT) AS ID_VENDEDOR, M.IDLEILAO, MAX(M.DATLAN) AS DATLAN, COUNT(*) AS LOTES,
               SUM(ISNULL(E.VLRPAR, 0)) AS ENTRADAS
        FROM MOVIMENTO_COMPRADOR MC
        JOIN MOVIMENTO M         ON M.ID = MC.IDMOV
        JOIN MOVIMENTO_LOTE ML   ON ML.ID = MC.IDMOVLOTE
        OUTER APPLY (SELECT TOP 1 VLRPAR FROM MOVIMENTO_PARCELAMENTO
                     WHERE IDMOVLOTE = MC.IDMOVLOTE AND IDCLI = MC.IDCLI AND PRIPAR = 'S') E
        WHERE ML.CODVEN IN (${psA}) AND M.IDLEILAO IS NOT NULL
          AND M.DATLAN >= DATEADD(MONTH, -${MESES_VENDAS}, GETDATE())
          ${opcoes.idLeilao ? 'AND M.IDLEILAO = @leilao' : ''}
        GROUP BY TRY_CAST(ML.CODVEN AS INT), M.IDLEILAO
      )
      SELECT V.ID_VENDEDOR, V.IDLEILAO, V.DATLAN, V.LOTES, V.ENTRADAS, L.LEILAO,
             ISNULL(D.AJUSTE, 0) AS AJUSTE, ISNULL(D.FECHAMENTOS, 0) AS FECHAMENTOS, ISNULL(D.REPASSADO, 0) AS REPASSADO
      FROM V
      LEFT JOIN LEILOES L ON L.ID = V.IDLEILAO
      OUTER APPLY (
        SELECT SUM(CASE WHEN X.TIPO_ORIGEM = 'COMISSAO_VENDEDOR' THEN -X.VALOR
                        WHEN X.TIPO_ORIGEM = 'COMISSAO_COMPRADOR' THEN 0
                        WHEN X.D_C IN ('C','E') THEN X.VALOR
                        WHEN X.D_C IN ('D','S') THEN -X.VALOR ELSE 0 END) AS AJUSTE,
               SUM(CASE WHEN X.D_C = 'F' AND ISNULL(X.TIPO_ORIGEM, '') NOT IN ('COMISSAO_VENDEDOR','COMISSAO_COMPRADOR') THEN 1 ELSE 0 END) AS FECHAMENTOS,
               SUM(CASE WHEN X.D_C = 'F' AND ISNULL(X.TIPO_ORIGEM, '') NOT IN ('COMISSAO_VENDEDOR','COMISSAO_COMPRADOR') THEN X.VALOR ELSE 0 END) AS REPASSADO
        FROM DESPESAS X WHERE X.CODLEI = V.IDLEILAO AND X.CODIGO_CLIENTE = V.ID_VENDEDOR
      ) D`);
    for (const x of acertos.recordset) {
      if (!x.ID_VENDEDOR) continue;
      const comFechamento = Number(x.FECHAMENTOS) > 0;
      const valor = r2(Number(x.ENTRADAS || 0) + Number(x.AJUSTE || 0) - Number(x.REPASSADO || 0));
      if (valor <= 0.009) continue;
      const chave = chaveAcerto(x.IDLEILAO, x.ID_VENDEDOR);
      const pago = r2(pagos.get(chave) || 0);
      itens.push({
        chave, tipo: 'ACERTO', id: x.IDLEILAO, idCliente: Number(x.ID_VENDEDOR), idMovComprador: null,
        idLeilao: x.IDLEILAO, leilao: x.LEILAO, lote: null,
        descricao: comFechamento
          ? `Saldo do acerto além dos repasses lançados (${fmtReais(Number(x.REPASSADO))})`
          : `Acerto do vendedor (${x.LOTES} venda${x.LOTES > 1 ? 's' : ''}, sem repasse lançado)`,
        vencimento: iso(x.DATLAN),
        valor, pago, saldo: r2(valor - pago), daLeiloeira: false,
      });
    }
  }

  return opcoes.incluirQuitados ? itens : itens.filter(it => it.saldo > 0.009);
}

/**
 * Despesas lançadas nas Despesas do leilão (débito D/S, sem as comissões automáticas)
 * para um débito do extrato pagar: frete, catálogo, sindicato... pagos pela leiloeira a
 * terceiros por conta de um vendedor ou comprador. Filtra por leilão e/ou cliente, ou
 * busca pelos códigos (para conferir uma baixa).
 */
export async function despesasDoLeilao(f: { idLeilao?: number; idCliente?: number; ids?: number[]; incluirQuitadas?: boolean }): Promise<ItemAberto[]> {
  if (!f.idLeilao && !f.idCliente && !f.ids?.length) return [];
  const pool = await getPool();
  const pagos = await pagosPorItem();
  const req = pool.request();
  const conds = ["D.D_C IN ('D','S')", "ISNULL(D.TIPO_ORIGEM, '') NOT IN ('COMISSAO_VENDEDOR','COMISSAO_COMPRADOR')"];
  if (f.idLeilao) { req.input('l', sql.Int, f.idLeilao); conds.push('D.CODLEI = @l'); }
  if (f.idCliente) { req.input('c', sql.Int, f.idCliente); conds.push('D.CODIGO_CLIENTE = @c'); }
  if (f.ids?.length) conds.push(`D.CODIGO IN (${f.ids.map((id, i) => { req.input(`d${i}`, sql.Int, id); return `@d${i}`; }).join(',')})`);
  const r = await req.query(`
    SELECT TOP 500 D.CODIGO, D.CODIGO_CLIENTE, D.VALOR, D.OBSERVACOES, D.DATA_INCLUSAO, D.CODLEI, L.LEILAO, C.NOMEXX
    FROM DESPESAS D LEFT JOIN LEILOES L ON L.ID = D.CODLEI LEFT JOIN CLIENTES C ON C.ID = D.CODIGO_CLIENTE
    WHERE ${conds.join(' AND ')} ORDER BY D.DATA_INCLUSAO DESC, D.CODIGO DESC`);
  const itens = r.recordset.map((x: any) => {
    const chave = `DESPESA:${x.CODIGO}`;
    const valor = r2(Math.abs(Number(x.VALOR) || 0));
    const pago = r2(pagos.get(chave) || 0);
    return {
      chave, tipo: 'DESPESA' as TipoItem, id: x.CODIGO, idCliente: Number(x.CODIGO_CLIENTE) || 0, idMovComprador: null,
      idLeilao: x.CODLEI, leilao: x.LEILAO, lote: null,
      descricao: `${x.NOMEXX ? `${x.NOMEXX}: ` : ''}${String(x.OBSERVACOES || 'Despesa').trim()}`,
      vencimento: iso(x.DATA_INCLUSAO), valor, pago, saldo: r2(valor - pago), daLeiloeira: false,
    };
  });
  return f.incluirQuitadas ? itens : itens.filter(i => i.saldo > 0.009);
}
