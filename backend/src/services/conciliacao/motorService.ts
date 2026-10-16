import { getPool, sql } from '../../config/database';
import { garantirTabelasConciliacao } from './schema';
import { ItemAberto, itensDosClientes } from './devidoService';
import { gravarDespesaEmpresaComNome } from './despesaEmpresaService';

// Motor de casamento: compara os lançamentos pendentes com os itens em aberto
// do cliente identificado pelo CPF/CNPJ. Só baixa sozinho quando há exatamente
// um candidato; com mais de um, ou com regra mais fraca, deixa como sugestão.

export interface ItemSugerido { chave: string; valor: number }
export interface Sugestao { regra: string; descricao: string; itens: ItemSugerido[] }

interface Lanc {
  ID: number; SITUACAO?: string; VALOR: number; SENTIDO: 'C' | 'D'; DATA: Date; MEMO: string | null;
  DOC_CONTRAPARTE: string | null; ID_CLIENTE: number | null;
}

const igual = (a: number, b: number) => Math.abs(a - b) < 0.011;
const dias = (a: string | null, b: Date) => (a ? Math.abs((Date.parse(a) - b.getTime()) / 864e5) : Infinity);

/** Combinações de 2 itens que somam o valor. */
function pares(itens: ItemAberto[], valor: number): ItemAberto[][] {
  const out: ItemAberto[][] = [];
  for (let i = 0; i < itens.length; i++)
    for (let j = i + 1; j < itens.length; j++)
      if (igual(itens[i].saldo + itens[j].saldo, valor)) out.push([itens[i], itens[j]]);
  return out;
}

/** Combinações de 3 itens (só para sugestão; limitado para não explodir com clientes de centenas de parcelas). */
function trios(itens: ItemAberto[], valor: number): ItemAberto[][] {
  const lista = itens.slice(0, 80);
  const out: ItemAberto[][] = [];
  for (let i = 0; i < lista.length; i++)
    for (let j = i + 1; j < lista.length; j++)
      for (let k = j + 1; k < lista.length; k++)
        if (igual(lista[i].saldo + lista[j].saldo + lista[k].saldo, valor)) {
          out.push([lista[i], lista[j], lista[k]]);
          if (out.length > 3) return out;
        }
  return out;
}

/** Todos os candidatos são da mesma venda (ex.: 02/50 e 04/50 de um 2+2 com o mesmo valor)? */
const mesmaVendaEmTodos = (grupos: ItemAberto[][]) => {
  const ids = new Set(grupos.flat().map(i => i.idMovComprador));
  return ids.size === 1 && !ids.has(null);
};
/** O grupo de vencimento mais próximo: paga-se a parcela que vence primeiro. */
const maisCedo = (grupos: ItemAberto[][]) =>
  [...grupos].sort((a, b) => Math.min(...a.map(i => Date.parse(i.vencimento || '9999'))) - Math.min(...b.map(i => Date.parse(i.vencimento || '9999'))))[0];

const sug = (regra: string, descricao: string, itens: ItemAberto[]): Sugestao =>
  ({ regra, descricao, itens: itens.map(i => ({ chave: i.chave, valor: i.saldo })) });

/**
 * Decide um lançamento. Retorna `auto` quando pode baixar sozinho, ou só a sugestão.
 * Regras (ver Especificação): A1 item único, A2 parcela + comissão da mesma venda ou
 * todas as comissões do leilão, A3 repasse lançado; S* ficam para confirmação.
 */
export function decidir(l: Lanc, itens: ItemAberto[]): { auto: boolean; sugestao: Sugestao } | null {
  const valor = Math.abs(Number(l.VALOR));
  const doCliente = itens.filter(i => i.idCliente === l.ID_CLIENTE);

  if (l.SENTIDO === 'C') {
    const comprador = doCliente.filter(i => i.tipo !== 'REPASSE');
    const daCasa = comprador.filter(i => i.daLeiloeira);

    // A1: um único item da leiloeira (parcela inicial ou comissão) com o valor exato
    const unicos = daCasa.filter(i => igual(i.saldo, valor));
    if (unicos.length === 1) return { auto: true, sugestao: sug('A1', 'Valor igual a um item em aberto', unicos) };
    if (unicos.length > 1 && mesmaVendaEmTodos(unicos.map(u => [u])))
      return { auto: true, sugestao: sug('A1', 'Parcela da mesma venda que vence primeiro', maisCedo(unicos.map(u => [u]))) };

    // A2: parcela + comissão da mesma venda
    const mesmaVenda = pares(daCasa, valor).filter(([a, b]) => a.idMovComprador && a.idMovComprador === b.idMovComprador);
    if (unicos.length === 0 && mesmaVenda.length === 1)
      return { auto: true, sugestao: sug('A2', 'Parcela e comissão da mesma venda', mesmaVenda[0]) };
    if (unicos.length === 0 && mesmaVenda.length > 1 && mesmaVendaEmTodos(mesmaVenda))
      return { auto: true, sugestao: sug('A2', 'Parcela que vence primeiro e comissão da mesma venda', maisCedo(mesmaVenda)) };

    // A2: todas as comissões em aberto do cliente num mesmo leilão
    if (unicos.length === 0 && mesmaVenda.length === 0) {
      const porLeilao = new Map<number, ItemAberto[]>();
      for (const c of comprador.filter(i => i.tipo === 'COMISSAO_COMPRA'))
        porLeilao.set(c.idLeilao ?? 0, [...(porLeilao.get(c.idLeilao ?? 0) || []), c]);
      const somam = [...porLeilao.values()].filter(cs => cs.length > 1 && igual(cs.reduce((a, c) => a + c.saldo, 0), valor));
      if (somam.length === 1) return { auto: true, sugestao: sug('A2', 'Comissões do mesmo leilão', somam[0]) };
    }

    // Sugestões: ambíguos, parcela depois das iniciais, combinações maiores
    if (unicos.length > 1) {
      const maisPerto = [...unicos].sort((a, b) => dias(a.vencimento, l.DATA) - dias(b.vencimento, l.DATA))[0];
      return { auto: false, sugestao: sug('S1', `${unicos.length} itens com o mesmo valor — o de vencimento mais próximo`, [maisPerto]) };
    }
    const outraParcela = comprador.filter(i => !i.daLeiloeira && igual(i.saldo, valor));
    if (outraParcela.length) {
      const maisPerto = [...outraParcela].sort((a, b) => dias(a.vencimento, l.DATA) - dias(b.vencimento, l.DATA))[0];
      return { auto: false, sugestao: sug('S1', 'Parcela depois das iniciais com o mesmo valor', [maisPerto]) };
    }
    const dois = pares(comprador, valor);
    if (dois.length) return { auto: false, sugestao: sug('S1', 'Soma de dois itens', dois[0]) };
    const tres = trios(comprador, valor);
    if (tres.length) return { auto: false, sugestao: sug('S1', 'Soma de três itens', tres[0]) };
    return null;
  }

  // Débito
  const repasses = doCliente.filter(i => i.tipo === 'REPASSE');
  const rUnicos = repasses.filter(i => igual(i.saldo, valor));
  if (rUnicos.length === 1) return { auto: true, sugestao: sug('A3', 'Repasse lançado no Acerto do Vendedor', rUnicos) };
  if (rUnicos.length > 1) return { auto: false, sugestao: sug('S3', `${rUnicos.length} repasses com o mesmo valor`, [rUnicos[0]]) };
  return null;
}

const DIGITOS_MEMO = (s: string | null) => (s || '').toUpperCase();

/**
 * Roda o motor nos lançamentos pendentes (todos, ou os da importação informada).
 * Baixa sozinho os casos A*, grava sugestão nos S* e aplica as regras de "não é venda".
 */
export async function conciliarAutomatico(opcoes: { idImportacao?: number; usuario?: { id?: number; nome?: string } } = {}) {
  await garantirTabelasConciliacao();
  const pool = await getPool();

  const req = pool.request();
  if (opcoes.idImportacao) req.input('imp', sql.Int, opcoes.idImportacao);
  const pend = (await req.query(`
    SELECT ID, SITUACAO, VALOR, SENTIDO, DATA, MEMO, DOC_CONTRAPARTE, ID_CLIENTE
    FROM CONC_LANCAMENTOS WHERE SITUACAO IN ('PENDENTE', 'SUGERIDO')
    ${opcoes.idImportacao ? 'AND ID_IMPORTACAO = @imp' : ''}`)).recordset as Lanc[];

  // A0: regras aprendidas de "não é venda"
  const ignorar = (await pool.request().query(`SELECT DOC, PADRAO_MEMO, CATEGORIA, ID_CATEGORIA FROM CONC_IGNORAR`)).recordset;
  let naoVenda = 0, despesas = 0;
  const restantes: Lanc[] = [];
  for (const l of pend) {
    const regra = ignorar.find((g: any) =>
      (g.DOC && g.DOC === l.DOC_CONTRAPARTE) || (g.PADRAO_MEMO && DIGITOS_MEMO(l.MEMO).includes(String(g.PADRAO_MEMO).toUpperCase())));
    if (regra && regra.ID_CATEGORIA && l.SENTIDO === 'D') {
      // regra aprendida de despesa da empresa (ex.: Localiza → Aluguel de veículos)
      const completo = (await pool.request().input('id', sql.Int, l.ID).query(`SELECT * FROM CONC_LANCAMENTOS WHERE ID = @id`)).recordset[0];
      await gravarDespesaEmpresaComNome(pool, completo, regra.ID_CATEGORIA, {}, opcoes.usuario);
      despesas++;
    } else if (regra) {
      await pool.request().input('id', sql.Int, l.ID).input('cat', sql.VarChar, regra.CATEGORIA)
        .query(`UPDATE CONC_LANCAMENTOS SET SITUACAO = 'NAO_VENDA', CATEGORIA = @cat, SUGESTAO = NULL WHERE ID = @id`);
      naoVenda++;
    } else if (l.ID_CLIENTE) restantes.push(l);
  }

  const itens = await itensDosClientes(restantes.map(l => l.ID_CLIENTE!));
  const saldo = new Map(itens.map(i => [i.chave, i]));
  let automaticos = 0, sugeridos = 0;

  // ordem por data: o primeiro pagamento consome o item, o seguinte não casa com o mesmo saldo
  for (const l of [...restantes].sort((a, b) => +new Date(a.DATA) - +new Date(b.DATA) || a.ID - b.ID)) {
    const abertos = itens.filter(i => (saldo.get(i.chave)?.saldo ?? 0) > 0.009);
    const d = decidir(l, abertos);
    if (!d) {
      // só grava quando muda (uma sugestão antiga que não vale mais) — o resto já está PENDENTE
      if (l.SITUACAO === 'SUGERIDO') await pool.request().input('id', sql.Int, l.ID)
        .query(`UPDATE CONC_LANCAMENTOS SET SITUACAO = 'PENDENTE', SUGESTAO = NULL WHERE ID = @id AND SITUACAO = 'SUGERIDO'`);
      continue;
    }
    if (d.auto) {
      await gravarBaixas(l.ID, d.sugestao.itens, d.sugestao.regra, opcoes.usuario, itens);
      for (const it of d.sugestao.itens) { const x = saldo.get(it.chave); if (x) x.saldo = Math.round((x.saldo - it.valor) * 100) / 100; }
      automaticos++;
    } else {
      await pool.request().input('id', sql.Int, l.ID).input('s', sql.VarChar, JSON.stringify(d.sugestao))
        .query(`UPDATE CONC_LANCAMENTOS SET SITUACAO = 'SUGERIDO', SUGESTAO = @s WHERE ID = @id`);
      sugeridos++;
    }
  }
  return { analisados: pend.length, automaticos, sugeridos, naoVenda, despesas };
}

/** Grava as baixas de um lançamento e atualiza a situação (CONCILIADO ou PARCIAL). */
export async function gravarBaixas(
  idLancamento: number, alvos: ItemSugerido[], regra: string,
  usuario: { id?: number; nome?: string } | undefined, itensConhecidos?: ItemAberto[],
) {
  const pool = await getPool();
  const lanc = (await pool.request().input('id', sql.Int, idLancamento)
    .query(`SELECT VALOR FROM CONC_LANCAMENTOS WHERE ID = @id`)).recordset[0];
  const porChave = new Map((itensConhecidos || []).map(i => [i.chave, i]));
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const a of alvos) {
      const [tipo, idStr] = a.chave.split(':');
      const id = Number(idStr);
      const it = porChave.get(a.chave);
      await new sql.Request(tx)
        .input('lanc', sql.Int, idLancamento)
        .input('tipo', sql.VarChar, tipo)
        .input('parcela', sql.Int, tipo === 'PARCELA' ? id : null)
        .input('mc', sql.Int, tipo === 'COMISSAO_COMPRA' ? id : it?.idMovComprador ?? null)
        .input('despesa', sql.Int, tipo === 'REPASSE' || tipo === 'DESPESA' ? id : null)
        .input('vendedor', sql.Int, tipo === 'REPASSE' ? it?.idCliente ?? null : null)
        .input('leilao', sql.Int, it?.idLeilao ?? null)
        .input('valor', sql.Decimal(18, 2), a.valor)
        .input('regra', sql.VarChar, regra)
        .input('idUsuario', sql.Int, usuario?.id ?? null)
        .input('nomeUsuario', sql.VarChar, usuario?.nome ?? null)
        .query(`INSERT INTO CONC_BAIXAS
          (ID_LANCAMENTO, TIPO_ALVO, ID_PARCELA, ID_MOV_COMPRADOR, ID_DESPESA, ID_VENDEDOR, ID_LEILAO, VALOR, REGRA, ID_USUARIO, NOME_USUARIO)
          VALUES (@lanc, @tipo, @parcela, @mc, @despesa, @vendedor, @leilao, @valor, @regra, @idUsuario, @nomeUsuario)`);
    }
    await atualizarSituacao(new sql.Request(tx), idLancamento, Math.abs(Number(lanc?.VALOR || 0)));
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

/** Situação a partir do que foi baixado: tudo = CONCILIADO, parte = PARCIAL, nada = PENDENTE. */
export async function atualizarSituacao(req: sql.Request, idLancamento: number, valorAbs: number) {
  await req.input('idSit', sql.Int, idLancamento).input('valorAbs', sql.Decimal(18, 2), valorAbs).query(`
    DECLARE @baixado DECIMAL(18,2) = (SELECT ISNULL(SUM(VALOR), 0) FROM CONC_BAIXAS WHERE ID_LANCAMENTO = @idSit AND DESFEITA = 'N');
    UPDATE CONC_LANCAMENTOS SET
      SITUACAO = CASE WHEN @baixado >= @valorAbs - 0.01 THEN 'CONCILIADO' WHEN @baixado > 0 THEN 'PARCIAL' ELSE 'PENDENTE' END,
      SUGESTAO = CASE WHEN @baixado > 0 THEN NULL ELSE SUGESTAO END
    WHERE ID = @idSit`);
}
