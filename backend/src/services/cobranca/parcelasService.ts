import { getPool, sql } from '../../config/database';
import { ehParcelaDaLeiloeira, existeTabela, SQL_COLUNAS_GRUPOS } from '../conciliacao/devidoService';
import { atualizarParcela } from '../vendaService';
import { CobrancaError, UsuarioCobranca } from './acessoService';
import { garantirTabelasCobranca } from './schema';

// Parcelas em cobrança: as dos lotes marcados (COBR_LOTES.ATIVA='S'), a partir da
// parcela inicial do lote — ou, sem parcela inicial, as que vêm depois das que
// ficam com o escritório (mesma regra de grupos da conciliação). O pago soma as
// baixas da Cobrança (COBR_BAIXAS) e as do extrato (CONC_BAIXAS), sem copiar nada.

export type Situacao = 'ABERTA' | 'VENCIDA' | 'PARCIAL' | 'PAGA' | 'QUITADA_ANTERIOR';
export type Destino = 'MACEDO' | 'VENDEDOR';

export interface ParcelaCobranca {
  id: number;
  idMovLote: number;
  idLote: number;
  idLeilao: number | null;
  leilao: string | null;
  dataLeilao: string | null;
  lote: string | null;
  animal: string | null;
  idVendedor: number;
  vendedor: string | null;
  idComprador: number;
  comprador: string | null;
  ordxxx: string;
  numero: number | null;
  vencimento: string | null;
  valor: number;
  pago: number;
  pagoAnterior: number;
  saldo: number;
  dataPagamento: string | null;
  situacao: Situacao;
  destino: Destino;
  taxa: number;
  /** false = parcela do escritório (o "2 + 2"), fora da cobrança — vem só com todas=true */
  emCobranca: boolean;
}

export interface FiltroParcelas {
  idVendedor?: number;
  idComprador?: number;
  idLeilao?: number;
  idLote?: number;
  ids?: number[];
  situacao?: string;      // ABERTA | VENCIDA | PARCIAL | PAGA | EM_ABERTO (aberta+vencida+parcial)
  vencDe?: string;
  vencAte?: string;
  /** inclui as parcelas do escritório dos lotes marcados (para o painel e a quitação) */
  todas?: boolean;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const iso = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const hojeIso = () => new Date().toISOString().slice(0, 10);

/** Número da parcela em "05/50" (contagem acumulada da condição). */
export const numeroParcela = (ordxxx: string | null | undefined) => {
  const n = parseInt(String(ordxxx || '').split('/')[0], 10);
  return Number.isFinite(n) ? n : null;
};

/** A parcela entra na cobrança? Parcela inicial do lote, senão a regra dos grupos do escritório
 *  (sem o "Pago para" do Encaminhamento, que diz onde o comprador paga, não o que é do escritório). */
export function ehDaCobranca(x: any): boolean {
  const numero = numeroParcela(x.ORDXXX);
  if (x.PARC_INICIAL != null) return numero != null && numero >= Number(x.PARC_INICIAL);
  return !ehParcelaDaLeiloeira({ ...x, PAGO_PARA: null });
}

function inLista(req: sql.Request, ids: number[], prefixo: string) {
  return ids.map((id, i) => { req.input(`${prefixo}${i}`, sql.Int, id); return `@${prefixo}${i}`; }).join(',');
}

export async function listarParcelas(f: FiltroParcelas = {}): Promise<ParcelaCobranca[]> {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const comGrupos = await existeTabela('CONC_CONDICAO_GRUPOS');
  const comConc = await existeTabela('CONC_BAIXAS');
  const req = pool.request();
  const conds = ["CL.ATIVA = 'S'"];
  if (f.idVendedor) { req.input('ven', sql.Int, f.idVendedor); conds.push('TRY_CAST(ML.CODVEN AS INT) = @ven'); }
  if (f.idComprador) { req.input('com', sql.Int, f.idComprador); conds.push('P.IDCLI = @com'); }
  if (f.idLeilao) { req.input('lei', sql.Int, f.idLeilao); conds.push('M.IDLEILAO = @lei'); }
  if (f.idLote) { req.input('lot', sql.Int, f.idLote); conds.push('CL.ID_LOTE = @lot'); }
  if (f.ids?.length) conds.push(`P.ID IN (${inLista(req, f.ids.slice(0, 2000), 'p')})`);
  if (f.vencDe) { req.input('vde', sql.Date, f.vencDe); conds.push('P.DATVEN >= @vde'); }
  if (f.vencAte) { req.input('vate', sql.Date, f.vencAte); conds.push('P.DATVEN <= @vate'); }

  const r = await req.query(`
    SELECT P.ID, P.IDMOVLOTE, P.IDCLI, P.ORDXXX, P.VLRPAR, P.DATVEN, ML.IDLOTE, M.IDLEILAO, LE.LEILAO, LE.DATLEI,
           COALESCE(NULLIF(LTRIM(RTRIM(P.LOTEXX)), ''), LTRIM(RTRIM(ML.LOTEXX))) AS LOTEXX, LO.DESLOT,
           TRY_CAST(ML.CODVEN AS INT) AS ID_VENDEDOR, CV.NOMEXX AS VENDEDOR, CC.NOMEXX AS COMPRADOR,
           CL.DESTINO, CL.PARC_INICIAL,
           COALESCE(CL.TAXA, VD.TAXA, CFG.COBR_TAXA_PADRAO, 0) AS TAXA,
           ISNULL(CB.VALOR, 0) AS PAGO_COBR, ISNULL(CB.ANTERIOR, 0) AS PAGO_ANTERIOR, CB.DATA AS DATA_COBR,
           ${comConc ? 'ISNULL(KB.VALOR, 0)' : '0'} AS PAGO_CONC, ${comConc ? 'KB.DATA' : 'NULL'} AS DATA_CONC,
           ${SQL_COLUNAS_GRUPOS(comGrupos)}
    FROM COBR_LOTES CL
    JOIN MOVIMENTO_LOTE ML          ON ML.IDLOTE = CL.ID_LOTE
    JOIN MOVIMENTO M                ON M.ID = ML.IDMOV
    JOIN MOVIMENTO_PARCELAMENTO P   ON P.IDMOVLOTE = ML.ID
    LEFT JOIN LEILOES LE            ON LE.ID = M.IDLEILAO
    LEFT JOIN LOTES LO              ON LO.ID = CL.ID_LOTE
    LEFT JOIN CLIENTES CV           ON CV.ID = TRY_CAST(ML.CODVEN AS INT)
    LEFT JOIN CLIENTES CC           ON CC.ID = P.IDCLI
    LEFT JOIN COBR_VENDEDORES VD    ON VD.ID_CLIENTE = TRY_CAST(ML.CODVEN AS INT)
    LEFT JOIN MOVIMENTO_COMPRADOR MC ON MC.IDMOVLOTE = P.IDMOVLOTE AND MC.IDCLI = P.IDCLI
    LEFT JOIN CONDICAOPAGTOS CP     ON CP.ID = MC.IDCONDPAGTO
    ${comGrupos ? 'LEFT JOIN CONC_CONDICAO_GRUPOS G ON G.ID_CONDPAGTO = MC.IDCONDPAGTO' : ''}
    OUTER APPLY (SELECT TOP 1 COBR_TAXA_PADRAO FROM Configuracoes) CFG
    LEFT JOIN (SELECT ID_PARCELA, SUM(VALOR) AS VALOR, MAX(DATA_PAGAMENTO) AS DATA,
                      SUM(CASE WHEN ORIGEM = 'ANTERIOR' THEN VALOR ELSE 0 END) AS ANTERIOR
               FROM COBR_BAIXAS WHERE DESFEITA = 'N' GROUP BY ID_PARCELA) CB ON CB.ID_PARCELA = P.ID
    ${comConc ? `LEFT JOIN (SELECT B.ID_PARCELA, SUM(B.VALOR) AS VALOR, MAX(LC.DATA) AS DATA
               FROM CONC_BAIXAS B JOIN CONC_LANCAMENTOS LC ON LC.ID = B.ID_LANCAMENTO
               WHERE B.DESFEITA = 'N' AND B.TIPO_ALVO = 'PARCELA' GROUP BY B.ID_PARCELA) KB ON KB.ID_PARCELA = P.ID` : ''}
    WHERE ${conds.join(' AND ')}
    ORDER BY P.DATVEN, CV.NOMEXX, ML.IDLOTE, P.IDCLI, P.ID`);

  const hoje = hojeIso();
  const lista: ParcelaCobranca[] = [];
  for (const x of r.recordset) {
    const emCobranca = ehDaCobranca(x);
    if (!emCobranca && !f.todas) continue;
    const valor = r2(Number(x.VLRPAR) || 0);
    const pago = r2(Number(x.PAGO_COBR) + Number(x.PAGO_CONC));
    const pagoAnterior = r2(Number(x.PAGO_ANTERIOR));
    const saldo = r2(Math.max(0, valor - pago));
    const vencimento = iso(x.DATVEN);
    const datas = [iso(x.DATA_COBR), iso(x.DATA_CONC)].filter(Boolean) as string[];
    let situacao: Situacao;
    if (saldo <= 0.009) situacao = pagoAnterior >= pago - 0.009 ? 'QUITADA_ANTERIOR' : 'PAGA';
    else if (pago > 0.009) situacao = 'PARCIAL';
    else situacao = vencimento && vencimento < hoje ? 'VENCIDA' : 'ABERTA';
    lista.push({
      id: x.ID, idMovLote: x.IDMOVLOTE, idLote: x.IDLOTE, idLeilao: x.IDLEILAO, leilao: x.LEILAO, dataLeilao: iso(x.DATLEI),
      lote: x.LOTEXX || null, animal: x.DESLOT ? String(x.DESLOT).trim() : null,
      idVendedor: x.ID_VENDEDOR, vendedor: x.VENDEDOR, idComprador: Number(x.IDCLI), comprador: x.COMPRADOR,
      ordxxx: String(x.ORDXXX || '').trim(), numero: numeroParcela(x.ORDXXX), vencimento,
      valor, pago, pagoAnterior, saldo, dataPagamento: datas.sort().pop() || null,
      situacao, destino: x.DESTINO === 'MACEDO' ? 'MACEDO' : 'VENDEDOR', taxa: Number(x.TAXA) || 0, emCobranca,
    });
  }
  if (!f.situacao) return lista;
  if (f.situacao === 'EM_ABERTO') return lista.filter(p => p.situacao === 'ABERTA' || p.situacao === 'VENCIDA' || p.situacao === 'PARCIAL');
  if (f.situacao === 'PAGA') return lista.filter(p => p.situacao === 'PAGA' || p.situacao === 'QUITADA_ANTERIOR');
  if (f.situacao === 'VENCIDA') return lista.filter(p => p.situacao === 'VENCIDA' || (p.situacao === 'PARCIAL' && !!p.vencimento && p.vencimento < hoje));
  return lista.filter(p => p.situacao === f.situacao);
}

export async function resumo(f: { idVendedor?: number } = {}) {
  const ps = await listarParcelas({ idVendedor: f.idVendedor });
  const hoje = hojeIso();
  const mes = hoje.slice(0, 7);
  const abertas = ps.filter(p => p.saldo > 0.009);
  const vencidas = abertas.filter(p => p.vencimento && p.vencimento < hoje);
  const soma = (xs: ParcelaCobranca[], k: 'saldo' | 'valor' | 'pago') => r2(xs.reduce((a, p) => a + p[k], 0));
  const pagasMes = ps.filter(p => p.situacao !== 'QUITADA_ANTERIOR' && p.dataPagamento?.slice(0, 7) === mes);
  return {
    lotes: new Set(ps.map(p => p.idLote)).size,
    vendedores: new Set(ps.map(p => p.idVendedor)).size,
    compradores: new Set(ps.map(p => p.idComprador)).size,
    parcelasEmAberto: abertas.length,
    valorEmAberto: soma(abertas, 'saldo'),
    parcelasVencidas: vencidas.length,
    valorVencido: soma(vencidas, 'saldo'),
    vencendoNoMes: abertas.filter(p => p.vencimento?.slice(0, 7) === mes).length,
    valorVencendoNoMes: soma(abertas.filter(p => p.vencimento?.slice(0, 7) === mes), 'saldo'),
    recebidoNoMes: soma(pagasMes, 'pago'),
  };
}

// ─── ações ───────────────────────────────────────────────────────────────────

async function parcelaDaCobranca(id: number): Promise<ParcelaCobranca> {
  const [p] = await listarParcelas({ ids: [id] });
  if (!p) throw new CobrancaError(404, 'Parcela não está em cobrança');
  return p;
}

export async function registrarHistorico(h: {
  idParcela?: number | null; idLote?: number | null; acao: string; antes?: string | null; depois?: string | null;
  motivo?: string | null; autor?: 'MACEDO' | 'VENDEDOR'; usuario?: UsuarioCobranca;
}, tx?: sql.Transaction) {
  const req = tx ? new sql.Request(tx) : (await getPool()).request();
  await req
    .input('parc', sql.Int, h.idParcela ?? null).input('lote', sql.Int, h.idLote ?? null)
    .input('acao', sql.VarChar(30), h.acao)
    .input('antes', sql.VarChar(255), h.antes?.slice(0, 255) ?? null).input('depois', sql.VarChar(255), h.depois?.slice(0, 255) ?? null)
    .input('motivo', sql.VarChar(255), h.motivo?.slice(0, 255) ?? null).input('autor', sql.VarChar(10), h.autor || 'MACEDO')
    .input('uid', sql.Int, h.usuario?.id ?? null).input('unome', sql.VarChar(100), h.usuario?.nome ?? null)
    .query(`INSERT INTO COBR_HISTORICO (ID_PARCELA, ID_LOTE, ACAO, ANTES, DEPOIS, MOTIVO, AUTOR, ID_USUARIO, NOME_USUARIO)
            VALUES (@parc, @lote, @acao, @antes, @depois, @motivo, @autor, @uid, @unome)`);
}

const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtD = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');

/** Baixa manual: recebimento informado pela leiloeira (só ela dá baixa). */
export async function baixar(d: { ids: number[]; dataPagamento: string; valor?: number; recebidoEm?: Destino; observacao?: string },
  usuario: UsuarioCobranca) {
  if (!d.ids?.length) throw new CobrancaError(400, 'Nenhuma parcela informada');
  if (!d.dataPagamento) throw new CobrancaError(400, 'Informe a data do pagamento');
  if (d.valor != null && d.ids.length > 1) throw new CobrancaError(400, 'Valor diferente do saldo só para uma parcela por vez');
  const ps = await listarParcelas({ ids: d.ids });
  if (ps.length !== new Set(d.ids).size) throw new CobrancaError(400, 'Alguma parcela não está em cobrança');
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const p of ps) {
      const valor = r2(d.valor ?? p.saldo);
      if (valor <= 0) throw new CobrancaError(400, `Parcela ${p.ordxxx} do lote ${p.lote} já está paga`);
      if (valor > p.saldo + 0.009) throw new CobrancaError(400, `Valor maior que o saldo da parcela ${p.ordxxx} (${fmtR(p.saldo)})`);
      const recebidoEm = d.recebidoEm || p.destino;
      await new sql.Request(tx)
        .input('parc', sql.Int, p.id).input('data', sql.Date, d.dataPagamento).input('valor', sql.Decimal(18, 2), valor)
        .input('rec', sql.VarChar(10), recebidoEm).input('obs', sql.VarChar(255), d.observacao?.slice(0, 255) || null)
        .input('uid', sql.Int, usuario.id ?? null).input('unome', sql.VarChar(100), usuario.nome ?? null)
        .query(`INSERT INTO COBR_BAIXAS (ID_PARCELA, DATA_PAGAMENTO, VALOR, ORIGEM, RECEBIDO_EM, OBSERVACAO, ID_USUARIO, NOME_USUARIO)
                VALUES (@parc, @data, @valor, 'MANUAL', @rec, @obs, @uid, @unome)`);
      await registrarHistorico({ idParcela: p.id, idLote: p.idLote, acao: 'BAIXA', depois: `${fmtR(valor)} em ${fmtD(d.dataPagamento)} (conta ${recebidoEm === 'MACEDO' ? 'da leiloeira' : 'do vendedor'})`, motivo: d.observacao, usuario }, tx);
    }
    await tx.commit();
  } catch (e) { await tx.rollback(); throw e; }
  return { baixadas: ps.length };
}

export async function listarBaixas(idParcela: number) {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const comConc = await existeTabela('CONC_BAIXAS');
  const r = await pool.request().input('p', sql.Int, idParcela).query(`
    SELECT 'COBR' AS ORIGEM_TAB, B.ID, B.DATA_PAGAMENTO, B.VALOR, B.ORIGEM, B.RECEBIDO_EM, B.OBSERVACAO, B.NOME_USUARIO, B.DATA, B.DESFEITA,
           (SELECT TOP 1 F.SITUACAO FROM COBR_FECHAMENTO_ITENS I JOIN COBR_FECHAMENTOS F ON F.ID = I.ID_FECHAMENTO
            WHERE I.ORIGEM = 'COBR' AND I.ID_BAIXA = B.ID) AS FECHAMENTO
    FROM COBR_BAIXAS B WHERE B.ID_PARCELA = @p
    ${comConc ? `UNION ALL
    SELECT 'CONC', B.ID, LC.DATA, B.VALOR, 'EXTRATO', 'MACEDO', LEFT(LC.MEMO, 255), B.NOME_USUARIO, B.DATA, B.DESFEITA,
           (SELECT TOP 1 F.SITUACAO FROM COBR_FECHAMENTO_ITENS I JOIN COBR_FECHAMENTOS F ON F.ID = I.ID_FECHAMENTO
            WHERE I.ORIGEM = 'CONC' AND I.ID_BAIXA = B.ID)
    FROM CONC_BAIXAS B JOIN CONC_LANCAMENTOS LC ON LC.ID = B.ID_LANCAMENTO
    WHERE B.TIPO_ALVO = 'PARCELA' AND B.ID_PARCELA = @p` : ''}
    ORDER BY 3`);
  return r.recordset.map((x: any) => ({
    origemTabela: x.ORIGEM_TAB, id: x.ID, dataPagamento: iso(x.DATA_PAGAMENTO), valor: Number(x.VALOR),
    origem: x.ORIGEM, recebidoEm: x.RECEBIDO_EM, observacao: x.OBSERVACAO, usuario: x.NOME_USUARIO,
    registradoEm: x.DATA, desfeita: x.DESFEITA === 'S', fechamento: x.FECHAMENTO || null,
  }));
}

/** Desfaz uma baixa da Cobrança (as do extrato se desfazem na Conciliação). Baixa já em fechamento não volta. */
export async function desfazerBaixa(idBaixa: number, usuario: UsuarioCobranca) {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, idBaixa).query(`
    SELECT B.*, (SELECT COUNT(*) FROM COBR_FECHAMENTO_ITENS I WHERE I.ORIGEM = 'COBR' AND I.ID_BAIXA = B.ID) AS EM_FECHAMENTO
    FROM COBR_BAIXAS B WHERE B.ID = @id`);
  const b = r.recordset[0];
  if (!b || b.DESFEITA === 'S') throw new CobrancaError(404, 'Baixa não encontrada');
  if (b.EM_FECHAMENTO > 0) throw new CobrancaError(409, 'Esta baixa já está num fechamento mensal. Reabra o fechamento antes.');
  await pool.request().input('id', sql.Int, idBaixa).input('uid', sql.Int, usuario.id ?? null)
    .query(`UPDATE COBR_BAIXAS SET DESFEITA = 'S', ID_USUARIO_DESFEZ = @uid, DATA_DESFEITA = GETDATE() WHERE ID = @id`);
  await registrarHistorico({ idParcela: b.ID_PARCELA, acao: 'BAIXA_DESFEITA', antes: `${fmtR(Number(b.VALOR))} em ${fmtD(iso(b.DATA_PAGAMENTO))}`, usuario });
}

/** Renegociação (leiloeira ou vendedor): muda vencimento e/ou valor na própria parcela da
 *  venda e guarda o de antes no histórico. Vale na hora. */
export async function renegociar(idParcela: number, d: { vencimento?: string; valor?: number; motivo?: string },
  usuario: UsuarioCobranca, autor: 'MACEDO' | 'VENDEDOR' = 'MACEDO', idVendedorDoPainel?: number) {
  const p = await parcelaDaCobranca(idParcela);
  if (autor === 'VENDEDOR' && p.idVendedor !== idVendedorDoPainel) throw new CobrancaError(403, 'Parcela de outro vendedor');
  if (p.saldo <= 0.009) throw new CobrancaError(409, 'Parcela já paga não pode ser renegociada');
  const novoVenc = d.vencimento && d.vencimento !== p.vencimento ? d.vencimento : undefined;
  const novoValor = d.valor != null && r2(d.valor) !== p.valor ? r2(d.valor) : undefined;
  if (!novoVenc && novoValor == null) throw new CobrancaError(400, 'Nada mudou');
  if (novoValor != null && novoValor < p.pago - 0.009) throw new CobrancaError(400, `Valor menor que o já pago (${fmtR(p.pago)})`);
  if (novoValor != null && novoValor <= 0) throw new CobrancaError(400, 'Valor deve ser maior que zero');
  await atualizarParcela(idParcela, novoVenc, novoValor);
  const antes: string[] = [], depois: string[] = [];
  if (novoVenc) { antes.push(`venc. ${fmtD(p.vencimento)}`); depois.push(`venc. ${fmtD(novoVenc)}`); }
  if (novoValor != null) { antes.push(fmtR(p.valor)); depois.push(fmtR(novoValor)); }
  await registrarHistorico({ idParcela, idLote: p.idLote, acao: 'RENEGOCIACAO', antes: antes.join(' · '), depois: depois.join(' · '), motivo: d.motivo, autor, usuario });
}

export async function historico(f: { idParcela?: number; idLote?: number }) {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const req = pool.request();
  const conds: string[] = [];
  if (f.idParcela) { req.input('p', sql.Int, f.idParcela); conds.push('H.ID_PARCELA = @p'); }
  if (f.idLote) { req.input('l', sql.Int, f.idLote); conds.push('H.ID_LOTE = @l'); }
  if (!conds.length) return [];
  const r = await req.query(`
    SELECT TOP 500 H.*, P.ORDXXX FROM COBR_HISTORICO H LEFT JOIN MOVIMENTO_PARCELAMENTO P ON P.ID = H.ID_PARCELA
    WHERE ${conds.join(' OR ')} ORDER BY H.DATA DESC, H.ID DESC`);
  return r.recordset.map((x: any) => ({
    id: x.ID, idParcela: x.ID_PARCELA, parcela: x.ORDXXX ? String(x.ORDXXX).trim() : null, acao: x.ACAO,
    antes: x.ANTES, depois: x.DEPOIS, motivo: x.MOTIVO, autor: x.AUTOR, usuario: x.NOME_USUARIO, data: x.DATA,
  }));
}

/**
 * Quitação das vendas antigas ao entrar na cobrança — parcelas que o vendedor já recebeu
 * antes. Por data (todas as vencidas até a data) ou por marcação (ids). Viram baixa
 * ANTERIOR: não entram no fechamento, sem taxa.
 */
export async function quitarAnteriores(d: { idLotes?: number[]; ate?: string; ids?: number[] }, usuario: UsuarioCobranca) {
  let alvo: ParcelaCobranca[] = [];
  if (d.ids?.length) alvo = await listarParcelas({ ids: d.ids });
  else if (d.idLotes?.length && d.ate) {
    for (const idLote of d.idLotes) alvo.push(...await listarParcelas({ idLote, vencAte: d.ate }));
  } else throw new CobrancaError(400, 'Informe a data limite ou as parcelas');
  alvo = alvo.filter(p => p.saldo > 0.009);
  if (!alvo.length) return { quitadas: 0, valor: 0 };
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const p of alvo) {
      await new sql.Request(tx)
        .input('parc', sql.Int, p.id).input('data', sql.Date, p.vencimento || hojeIso()).input('valor', sql.Decimal(18, 2), p.saldo)
        .input('uid', sql.Int, usuario.id ?? null).input('unome', sql.VarChar(100), usuario.nome ?? null)
        .query(`INSERT INTO COBR_BAIXAS (ID_PARCELA, DATA_PAGAMENTO, VALOR, ORIGEM, RECEBIDO_EM, OBSERVACAO, ID_USUARIO, NOME_USUARIO)
                VALUES (@parc, @data, @valor, 'ANTERIOR', 'VENDEDOR', 'Quitada antes de entrar na cobrança', @uid, @unome)`);
    }
    const porLote = new Map<number, number>();
    for (const p of alvo) porLote.set(p.idLote, (porLote.get(p.idLote) || 0) + 1);
    for (const [idLote, n] of porLote) {
      await registrarHistorico({ idLote, acao: 'QUITACAO_ANTERIOR', depois: `${n} parcela${n > 1 ? 's' : ''} quitada${n > 1 ? 's' : ''}${d.ate ? ` (vencidas até ${fmtD(d.ate)})` : ' (por marcação)'}`, usuario }, tx);
    }
    await tx.commit();
  } catch (e) { await tx.rollback(); throw e; }
  return { quitadas: alvo.length, valor: r2(alvo.reduce((a, p) => a + p.saldo, 0)) };
}
