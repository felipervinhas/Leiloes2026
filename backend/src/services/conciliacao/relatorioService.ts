import { getPool, sql } from '../../config/database';
import { garantirTabelasConciliacao } from './schema';
import {
  comissaoDaLeiloeira, ehParcelaDaLeiloeira, existePagoPara, existePagoParaComissao, existeTabela, pagosPorItem,
  SQL_COLUNAS_GRUPOS, SQL_PAGO_PARA_COMISSAO,
} from './devidoService';
import { ConciliacaoError } from './acessoService';
import { criarDespesa } from '../despesaService';

// Relatórios da conciliação. "Previsto" vem das vendas; "recebido" vem só das
// baixas confirmadas (o que de fato entrou na conta), e é isso que distingue
// estes números dos do Acerto do Vendedor, que usa o valor previsto.

const r2 = (v: number) => Math.round(v * 100) / 100;
const iso = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

async function parcelasDoLeilao(idLeilao: number) {
  const pool = await getPool();
  const comGrupos = await existeTabela('CONC_CONDICAO_GRUPOS');
  const comPagoPara = await existePagoPara();
  const r = await pool.request().input('l', sql.Int, idLeilao).query(`
    SELECT P.ID, P.ORDXXX, P.VLRPAR, P.DATVEN, MC.ID AS ID_MC, ML.CODVEN,
           ${SQL_COLUNAS_GRUPOS(comGrupos, comPagoPara)}
    FROM MOVIMENTO_PARCELAMENTO P
    JOIN MOVIMENTO M              ON M.ID = P.IDMOV
    JOIN MOVIMENTO_LOTE ML        ON ML.ID = P.IDMOVLOTE
    LEFT JOIN MOVIMENTO_COMPRADOR MC ON MC.IDMOVLOTE = P.IDMOVLOTE AND MC.IDCLI = P.IDCLI
    LEFT JOIN CONDICAOPAGTOS CP   ON CP.ID = MC.IDCONDPAGTO
    ${comGrupos ? 'LEFT JOIN CONC_CONDICAO_GRUPOS G ON G.ID_CONDPAGTO = MC.IDCONDPAGTO' : ''}
    WHERE M.IDLEILAO = @l`);
  return r.recordset.map((x: any) => ({
    // CODVEN vem como texto do banco; o cadastro de clientes usa número
    id: x.ID as number, idMc: x.ID_MC as number | null, idVendedor: x.CODVEN != null ? Number(x.CODVEN) : null,
    valor: r2(Number(x.VLRPAR) || 0), vencimento: iso(x.DATVEN), daLeiloeira: ehParcelaDaLeiloeira(x),
  }));
}

/** Por venda (comprador + lote) do leilão: previsto e recebido das parcelas da leiloeira e da comissão de compra. */
export async function recebimentosPorLeilao(idLeilao: number) {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const comPagoParaComissao = await existePagoParaComissao();
  const [vendas, parcelas, pagos] = await Promise.all([
    pool.request().input('l', sql.Int, idLeilao).query(`
      SELECT MC.ID, MC.IDCLI, C.NOMEXX AS COMPRADOR, C.CELU_1, ML.LOTEXX, ML.CODVEN, V.NOMEXX AS VENDEDOR, M.DATLAN,
             MC.VALORPAGAR, MC.VALORCOMISSAO, CP.DESFIN, ${SQL_PAGO_PARA_COMISSAO(comPagoParaComissao)}
      FROM MOVIMENTO_COMPRADOR MC
      JOIN MOVIMENTO M          ON M.ID = MC.IDMOV
      JOIN MOVIMENTO_LOTE ML    ON ML.ID = MC.IDMOVLOTE
      LEFT JOIN CLIENTES C      ON C.ID = MC.IDCLI
      LEFT JOIN CLIENTES V      ON V.ID = ML.CODVEN
      LEFT JOIN CONDICAOPAGTOS CP ON CP.ID = MC.IDCONDPAGTO
      WHERE M.IDLEILAO = @l AND ISNULL(MC.VALORPAGAR, 0) > 0`),
    parcelasDoLeilao(idLeilao),
    pagosPorItem(),
  ]);
  // "vencido em aberto" só dentro do período que já tem extrato: antes dele não há como saber se foi pago
  const per = (await pool.request().query(`SELECT MIN(DT_INICIO) INI, MAX(DT_FIM) FIM FROM CONC_IMPORTACOES`)).recordset[0];
  const hoje = new Date().toISOString().slice(0, 10);
  const perIni = iso(per?.INI);
  const perFim = per?.FIM ? (iso(per.FIM)! < hoje ? iso(per.FIM)! : hoje) : null;
  const noPeriodo = (d: string | null) => !!(d && perIni && perFim && d >= perIni && d <= perFim);

  const linhas = vendas.recordset.map((v: any) => {
    const ps = parcelas.filter(p => p.idMc === v.ID);
    const daCasa = ps.filter(p => p.daLeiloeira);
    const previstoParcelas = r2(daCasa.reduce((a, p) => a + p.valor, 0));
    const recebidoParcelas = r2(daCasa.reduce((a, p) => a + (pagos.get(`PARCELA:${p.id}`) || 0), 0));
    const recebidoOutras = r2(ps.filter(p => !p.daLeiloeira).reduce((a, p) => a + (pagos.get(`PARCELA:${p.id}`) || 0), 0));
    // comissão paga na conta do vendedor (Encaminhamento) não é recebimento da leiloeira
    const previstoComissao = comissaoDaLeiloeira(v) ? r2(Number(v.VALORCOMISSAO) || 0) : 0;
    const recebidoComissao = r2(pagos.get(`COMISSAO_COMPRA:${v.ID}`) || 0);
    const previsto = r2(previstoParcelas + previstoComissao);
    const recebido = r2(recebidoParcelas + recebidoComissao);
    const vencidoAberto = r2(daCasa.filter(p => noPeriodo(p.vencimento))
      .reduce((a, p) => a + Math.max(0, p.valor - (pagos.get(`PARCELA:${p.id}`) || 0)), 0)
      + (noPeriodo(v.DATLAN ? iso(v.DATLAN) : null) ? Math.max(0, previstoComissao - recebidoComissao) : 0));
    return {
      idMovComprador: v.ID, idComprador: Number(v.IDCLI), comprador: v.COMPRADOR, telefone: v.CELU_1,
      lote: v.LOTEXX?.trim() || null, idVendedor: v.CODVEN != null ? Number(v.CODVEN) : null, vendedor: v.VENDEDOR, condicao: v.DESFIN,
      qtdParcelasLeiloeira: daCasa.length, previstoParcelas, recebidoParcelas,
      previstoComissao, recebidoComissao, previsto, recebido, recebidoOutras, vencidoAberto,
      situacao: previsto > 0 && recebido >= previsto - 0.01 ? 'QUITADO' : recebido > 0 ? 'PARCIAL' : 'EM_ABERTO',
    };
  }).sort((a: any, b: any) => String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true }));

  const soma = (k: string) => r2(linhas.reduce((a: number, l: any) => a + l[k], 0));
  return {
    linhas,
    periodo: perIni ? { inicio: perIni, fim: perFim } : null,
    totais: {
      previsto: soma('previsto'), recebido: soma('recebido'), vencidoAberto: soma('vencidoAberto'),
      previstoComissao: soma('previstoComissao'), recebidoComissao: soma('recebidoComissao'),
      vendas: linhas.length, quitadas: linhas.filter((l: any) => l.situacao === 'QUITADO').length,
    },
  };
}

/**
 * Por vendedor do leilão: recebido nas parcelas que passam pela leiloeira, o que fica
 * retido (comissão de venda e despesas, como no Acerto do Vendedor), créditos, repasses
 * lançados e quanto deles já foi conferido no extrato.
 */
export async function repassesPorLeilao(idLeilao: number) {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const [parcelas, pagos, desp, comissaoVenda, conferidos] = await Promise.all([
    parcelasDoLeilao(idLeilao),
    pagosPorItem(),
    pool.request().input('l', sql.Int, idLeilao).query(`
      SELECT D.CODIGO_CLIENTE, D.D_C, D.TIPO_ORIGEM, SUM(D.VALOR) AS VALOR
      FROM DESPESAS D WHERE D.CODLEI = @l AND D.CODIGO_CLIENTE IS NOT NULL
      GROUP BY D.CODIGO_CLIENTE, D.D_C, D.TIPO_ORIGEM`),
    pool.request().input('l', sql.Int, idLeilao).query(`
      SELECT ML.CODVEN, SUM(ISNULL(MC.VALORCOMISSAOVENDEDOR, 0)) AS VALOR
      FROM MOVIMENTO_COMPRADOR MC JOIN MOVIMENTO M ON M.ID = MC.IDMOV JOIN MOVIMENTO_LOTE ML ON ML.ID = MC.IDMOVLOTE
      WHERE M.IDLEILAO = @l GROUP BY ML.CODVEN`),
    pool.request().input('l', sql.Int, idLeilao).query(`
      SELECT CODIGO_CLIENTE, SUM(VALOR) AS VALOR FROM (
        SELECT D.CODIGO_CLIENTE, B.VALOR
        FROM CONC_BAIXAS B JOIN DESPESAS D ON D.CODIGO = B.ID_DESPESA
        WHERE B.TIPO_ALVO = 'REPASSE' AND B.DESFEITA = 'N' AND D.CODLEI = @l
        UNION ALL
        -- pago ao vendedor sem repasse lançado: baixa direto no saldo do Acerto
        SELECT B.ID_VENDEDOR, B.VALOR FROM CONC_BAIXAS B
        WHERE B.TIPO_ALVO = 'ACERTO' AND B.DESFEITA = 'N' AND B.ID_LEILAO = @l
      ) X GROUP BY CODIGO_CLIENTE`),
  ]);

  const vendedores = [...new Set(parcelas.map(p => p.idVendedor).filter((v): v is number => !!v))];
  if (!vendedores.length) return { linhas: [], totais: null };
  const req = pool.request();
  const ps = vendedores.map((v, i) => { req.input(`v${i}`, sql.Int, v); return `@v${i}`; }).join(',');
  const nomes = new Map((await req.query(`SELECT ID, NOMEXX FROM CLIENTES WHERE ID IN (${ps})`)).recordset.map((c: any) => [Number(c.ID), c.NOMEXX as string]));

  const linhas = vendedores.map(idV => {
    const daCasa = parcelas.filter(p => p.idVendedor === idV && p.daLeiloeira);
    const previsto = r2(daCasa.reduce((a, p) => a + p.valor, 0));
    const recebido = r2(daCasa.reduce((a, p) => a + (pagos.get(`PARCELA:${p.id}`) || 0), 0));
    const dv = desp.recordset.filter((d: any) => Number(d.CODIGO_CLIENTE) === idV);
    const somaD = (f: (d: any) => boolean) => r2(dv.filter(f).reduce((a: number, d: any) => a + Number(d.VALOR || 0), 0));
    // comissão de venda: o lançamento (vendas novas) ou, sem ele, o valor gravado na venda (vendas antigas)
    const comissaoLancada = somaD(d => d.TIPO_ORIGEM === 'COMISSAO_VENDEDOR');
    const comissao = comissaoLancada > 0 ? comissaoLancada
      : r2(Number(comissaoVenda.recordset.find((c: any) => Number(c.CODVEN) === idV)?.VALOR || 0));
    const outros = (d: any) => d.TIPO_ORIGEM !== 'COMISSAO_VENDEDOR' && d.TIPO_ORIGEM !== 'COMISSAO_COMPRADOR';
    const despesas = somaD(d => outros(d) && (d.D_C === 'D' || d.D_C === 'S'));
    const creditos = somaD(d => outros(d) && (d.D_C === 'C' || d.D_C === 'E'));
    const repassado = somaD(d => outros(d) && d.D_C === 'F');
    const conferido = r2(Number(conferidos.recordset.find((c: any) => Number(c.CODIGO_CLIENTE) === idV)?.VALOR || 0));
    return {
      idVendedor: idV, vendedor: nomes.get(idV) || `Cliente ${idV}`,
      previsto, recebido, aReceber: r2(previsto - recebido),
      comissao, despesas, creditos, repassado, conferido,
      saldo: r2(recebido + creditos - comissao - despesas - repassado),
    };
  }).sort((a, b) => a.vendedor.localeCompare(b.vendedor, 'pt-BR'));

  const soma = (k: keyof typeof linhas[number]) => r2(linhas.reduce((a, l) => a + Number(l[k]), 0));
  return {
    linhas,
    totais: {
      previsto: soma('previsto'), recebido: soma('recebido'), comissao: soma('comissao'), despesas: soma('despesas'),
      creditos: soma('creditos'), repassado: soma('repassado'), conferido: soma('conferido'), saldo: soma('saldo'),
    },
  };
}

/**
 * Lança o repasse (fechamento F nas Despesas do leilão, o mesmo do Acerto do Vendedor) com o
 * saldo a repassar de cada vendedor escolhido — ou de todos com saldo. O valor é recalculado
 * aqui, não vem da tela. Baixas que já pagaram o saldo do Acerto desse vendedor/leilão (item
 * ACERTO, sem repasse lançado) passam para o repasse novo, senão ele ficaria em aberto em dobro.
 */
export async function lancarRepasses(idLeilao: number, idsVendedor?: number[]) {
  const { linhas } = await repassesPorLeilao(idLeilao);
  const escolhidas = linhas.filter(l => l.saldo > 0.009 && (!idsVendedor?.length || idsVendedor.includes(l.idVendedor)));
  if (!escolhidas.length) throw new ConciliacaoError(400, 'Nenhum vendedor com saldo a repassar');
  const pool = await getPool();
  const lancados: { idVendedor: number; vendedor: string; valor: number; idDespesa: number }[] = [];
  for (const l of escolhidas) {
    const idDespesa = await criarDespesa({ codLei: idLeilao, codigoCliente: l.idVendedor, dc: 'F', valor: l.saldo, observacoes: 'REPASSE AO VENDEDOR' });
    await pool.request().input('d', sql.Int, idDespesa).input('l', sql.Int, idLeilao).input('v', sql.Int, l.idVendedor).query(`
      UPDATE CONC_BAIXAS SET TIPO_ALVO = 'REPASSE', ID_DESPESA = @d
      WHERE TIPO_ALVO = 'ACERTO' AND DESFEITA = 'N' AND ID_LEILAO = @l AND ID_VENDEDOR = @v`);
    lancados.push({ idVendedor: l.idVendedor, vendedor: l.vendedor, valor: l.saldo, idDespesa });
  }
  return { lancados, total: r2(lancados.reduce((a, l) => a + l.valor, 0)) };
}

/**
 * O que entrou (crédito: parcelas e comissões de compra) ou saiu (débito: repasses e acertos
 * de vendedor) pelo extrato num período, pela data do lançamento — de qualquer leilão.
 * Cada linha é uma baixa: o mesmo pagamento dividido em itens aparece em várias linhas.
 */
export async function movimentosPorPeriodo(de: string, ate: string, lado: 'recebimentos' | 'repasses') {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const credito = lado === 'recebimentos';
  const r = await pool.request().input('de', sql.Date, de).input('ate', sql.Date, ate).query(`
    SELECT B.ID, B.TIPO_ALVO, B.VALOR, L.ID AS ID_LANCAMENTO, L.DATA, L.NOME_CONTRAPARTE, L.DOC_CONTRAPARTE, CT.DESCRICAO AS CONTA,
           P.ORDXXX, ML.LOTEXX, LE.ID AS ID_LEILAO, LE.LEILAO, LE.DATLEI,
           CC.NOMEXX AS COMPRADOR, CV.NOMEXX AS VENDEDOR
    FROM CONC_BAIXAS B
    JOIN CONC_LANCAMENTOS L              ON L.ID = B.ID_LANCAMENTO
    LEFT JOIN CONC_CONTAS CT             ON CT.ID = L.ID_CONTA
    LEFT JOIN MOVIMENTO_PARCELAMENTO P   ON P.ID = B.ID_PARCELA
    LEFT JOIN MOVIMENTO_COMPRADOR MC     ON MC.ID = B.ID_MOV_COMPRADOR
    LEFT JOIN MOVIMENTO_LOTE ML          ON ML.ID = ISNULL(MC.IDMOVLOTE, P.IDMOVLOTE)
    LEFT JOIN MOVIMENTO M                ON M.ID = ISNULL(MC.IDMOV, P.IDMOV)
    LEFT JOIN DESPESAS D                 ON D.CODIGO = B.ID_DESPESA
    LEFT JOIN LEILOES LE                 ON LE.ID = COALESCE(B.ID_LEILAO, M.IDLEILAO, D.CODLEI)
    LEFT JOIN Clientes CC                ON CC.ID = TRY_CAST(ISNULL(MC.IDCLI, P.IDCLI) AS INT)
    LEFT JOIN Clientes CV                ON CV.ID = COALESCE(TRY_CAST(ML.CODVEN AS INT), D.CODIGO_CLIENTE, B.ID_VENDEDOR)
    WHERE B.DESFEITA = 'N' AND L.DATA BETWEEN @de AND @ate AND L.SENTIDO = '${credito ? 'C' : 'D'}'
      AND B.TIPO_ALVO IN (${credito ? `'PARCELA','COMISSAO_COMPRA','AJUSTE'` : `'REPASSE','ACERTO','AJUSTE'`})
    ORDER BY L.DATA, L.ID, B.ID`);
  const txt = (v: any) => (v == null ? null : String(v).trim() || null);
  const DESCRICAO: Record<string, string> = {
    COMISSAO_COMPRA: 'Comissão de compra', REPASSE: 'Repasse lançado', ACERTO: 'Acerto do vendedor', AJUSTE: 'Ajuste de arredondamento',
  };
  const linhas = r.recordset.map((x: any) => ({
    id: x.ID as number, idLancamento: x.ID_LANCAMENTO as number, data: iso(x.DATA), tipo: x.TIPO_ALVO as string,
    descricao: x.TIPO_ALVO === 'PARCELA' ? `Parcela ${txt(x.ORDXXX) || ''}`.trim() : DESCRICAO[x.TIPO_ALVO] || x.TIPO_ALVO,
    noExtrato: txt(x.NOME_CONTRAPARTE), docExtrato: txt(x.DOC_CONTRAPARTE), conta: txt(x.CONTA),
    idLeilao: x.ID_LEILAO ?? null, leilao: txt(x.LEILAO), dataLeilao: iso(x.DATLEI), lote: txt(x.LOTEXX),
    comprador: txt(x.COMPRADOR), vendedor: txt(x.VENDEDOR), valor: r2(Number(x.VALOR)),
  }));
  const porLeilao = new Map<string, { leilao: string; qtd: number; total: number }>();
  for (const l of linhas) {
    const k = l.leilao || 'Sem leilão';
    const g = porLeilao.get(k) || { leilao: k, qtd: 0, total: 0 };
    g.qtd++; g.total = r2(g.total + l.valor);
    porLeilao.set(k, g);
  }
  return {
    linhas,
    porLeilao: [...porLeilao.values()].sort((a, b) => b.total - a.total),
    total: r2(linhas.reduce((a, l) => a + l.valor, 0)),
    lancamentos: new Set(linhas.map(l => l.idLancamento)).size,
  };
}

/**
 * Pendências: o que deveria ter entrado e não entrou. Só olha vencimentos dentro do período
 * que já tem extrato importado — antes disso não há como saber se foi pago. Com de/até, fica
 * no trecho escolhido (dentro desse mesmo período), e o resumo do extrato também.
 */
export async function pendencias(f: { de?: string; ate?: string } = {}) {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const per = (await pool.request().query(`SELECT MIN(DT_INICIO) INI, MAX(DT_FIM) FIM FROM CONC_IMPORTACOES`)).recordset[0];
  const rl = pool.request();
  const condsL: string[] = [];
  if (f.de) { rl.input('de', sql.Date, f.de); condsL.push('DATA >= @de'); }
  if (f.ate) { rl.input('ate', sql.Date, f.ate); condsL.push('DATA <= @ate'); }
  const lanc = (await rl.query(`
    SELECT SENTIDO, SITUACAO, CASE WHEN ID_CLIENTE IS NULL THEN 0 ELSE 1 END AS COM_CLIENTE, COUNT(*) N, SUM(ABS(VALOR)) V
    FROM CONC_LANCAMENTOS WHERE SITUACAO IN ('PENDENTE','SUGERIDO','PARCIAL') ${condsL.map(c => `AND ${c}`).join(' ')}
    GROUP BY SENTIDO, SITUACAO, CASE WHEN ID_CLIENTE IS NULL THEN 0 ELSE 1 END`)).recordset;
  const resumoLanc = lanc.map((x: any) => ({ sentido: x.SENTIDO, situacao: x.SITUACAO, comCliente: !!x.COM_CLIENTE, qtd: x.N, valor: r2(Number(x.V)) }));
  if (!per?.INI) return { periodo: null, lancamentos: resumoLanc, compradores: [] };

  const hoje = new Date().toISOString().slice(0, 10);
  let fim = iso(per.FIM)! < hoje ? iso(per.FIM)! : hoje;
  if (f.ate && f.ate < fim) fim = f.ate;
  if (f.de && f.de > iso(per.INI)!) per.INI = f.de;
  // trecho escolhido fora do período com extrato: não há como dizer o que não entrou
  if (iso(per.INI)! > fim) return { periodo: null, foraDoExtrato: true, lancamentos: resumoLanc, compradores: [] };
  const comGrupos = await existeTabela('CONC_CONDICAO_GRUPOS');
  const comPagoPara = await existePagoPara();
  const comPagoParaComissao = await existePagoParaComissao();
  const [parcelas, comissoes, pagos] = await Promise.all([
    pool.request().input('ini', sql.Date, iso(per.INI)).input('fim', sql.Date, fim).query(`
      SELECT P.ID, P.IDCLI, P.LOTEXX, P.ORDXXX, P.VLRPAR, P.DATVEN, L.LEILAO, ${SQL_COLUNAS_GRUPOS(comGrupos, comPagoPara)}
      FROM MOVIMENTO_PARCELAMENTO P
      JOIN MOVIMENTO M              ON M.ID = P.IDMOV
      LEFT JOIN LEILOES L           ON L.ID = M.IDLEILAO
      LEFT JOIN MOVIMENTO_COMPRADOR MC ON MC.IDMOVLOTE = P.IDMOVLOTE AND MC.IDCLI = P.IDCLI
      LEFT JOIN CONDICAOPAGTOS CP   ON CP.ID = MC.IDCONDPAGTO
      ${comGrupos ? 'LEFT JOIN CONC_CONDICAO_GRUPOS G ON G.ID_CONDPAGTO = MC.IDCONDPAGTO' : ''}
      WHERE P.DATVEN BETWEEN @ini AND @fim`),
    pool.request().input('ini', sql.Date, iso(per.INI)).input('fim', sql.Date, fim).query(`
      SELECT MC.ID, MC.IDCLI, MC.VALORCOMISSAO, M.DATLAN, L.LEILAO, ML.LOTEXX, ${SQL_PAGO_PARA_COMISSAO(comPagoParaComissao)}
      FROM MOVIMENTO_COMPRADOR MC JOIN MOVIMENTO M ON M.ID = MC.IDMOV
      LEFT JOIN MOVIMENTO_LOTE ML ON ML.ID = MC.IDMOVLOTE LEFT JOIN LEILOES L ON L.ID = M.IDLEILAO
      WHERE MC.VALORCOMISSAO > 0 AND M.DATLAN BETWEEN @ini AND @fim`),
    pagosPorItem(),
  ]);

  type Pend = { tipo: string; leilao: string | null; lote: string | null; descricao: string; vencimento: string | null; emAberto: number };
  const porCliente = new Map<number, Pend[]>();
  const add = (idCli: number, p: Pend) => { if (p.emAberto > 0.009) porCliente.set(idCli, [...(porCliente.get(idCli) || []), p]); };
  for (const x of parcelas.recordset) {
    if (!ehParcelaDaLeiloeira(x)) continue;
    add(Number(x.IDCLI), { tipo: 'PARCELA', leilao: x.LEILAO, lote: x.LOTEXX?.trim() || null, descricao: `Parcela ${x.ORDXXX}`,
      vencimento: iso(x.DATVEN), emAberto: r2(Number(x.VLRPAR) - (pagos.get(`PARCELA:${x.ID}`) || 0)) });
  }
  for (const x of comissoes.recordset) {
    if (!comissaoDaLeiloeira(x)) continue;
    add(Number(x.IDCLI), { tipo: 'COMISSAO_COMPRA', leilao: x.LEILAO, lote: x.LOTEXX?.trim() || null, descricao: 'Comissão de compra',
      vencimento: iso(x.DATLAN), emAberto: r2(Number(x.VALORCOMISSAO) - (pagos.get(`COMISSAO_COMPRA:${x.ID}`) || 0)) });
  }

  const ids = [...porCliente.keys()];
  const nomes = new Map<number, any>();
  for (let i = 0; i < ids.length; i += 500) {
    const req = pool.request();
    const ps = ids.slice(i, i + 500).map((v, j) => { req.input(`c${j}`, sql.Int, v); return `@c${j}`; }).join(',');
    (await req.query(`SELECT ID, NOMEXX, CELU_1 FROM CLIENTES WHERE ID IN (${ps})`)).recordset.forEach((c: any) => nomes.set(c.ID, c));
  }
  const compradores = ids.map(id => {
    const itens = porCliente.get(id)!.sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
    return { idCliente: id, nome: nomes.get(id)?.NOMEXX || `Cliente ${id}`, telefone: nomes.get(id)?.CELU_1 || null,
      total: r2(itens.reduce((a, p) => a + p.emAberto, 0)), maisAntigo: itens[0]?.vencimento ?? null, itens };
  }).sort((a, b) => b.total - a.total);

  return { periodo: { inicio: iso(per.INI), fim }, lancamentos: resumoLanc, compradores };
}
