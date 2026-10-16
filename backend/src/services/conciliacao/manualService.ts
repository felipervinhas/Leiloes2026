import { getPool, sql } from '../../config/database';
import { garantirTabelasConciliacao } from './schema';
import { ConciliacaoError } from './acessoService';
import { itensDosClientes, ItemAberto, despesasDoLeilao } from './devidoService';
import { desfazerDespesaEmpresa } from './despesaEmpresaService';
import { criarDespesa } from '../despesaService';
import { atualizarSituacao, gravarBaixas, ItemSugerido, Sugestao, TOLERANCIA_ARREDONDAMENTO } from './motorService';

type Usuario = { id?: number; nome?: string } | undefined;

async function buscarLancamento(id: number) {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const l = (await pool.request().input('id', sql.Int, id).query(`
    SELECT L.*, C.NOMEXX AS NOME_CLIENTE FROM CONC_LANCAMENTOS L
    LEFT JOIN Clientes C ON C.ID = L.ID_CLIENTE WHERE L.ID = @id`)).recordset[0];
  if (!l) throw new ConciliacaoError(404, 'Lançamento não encontrado');
  return l;
}

/**
 * Consulta manual: itens em aberto de um cliente (o do CPF/CNPJ, ou outro escolhido
 * quando quem pagou foi um terceiro), opcionalmente de um leilão. O papel define o lado:
 * comprador vê parcelas e comissões; vendedor vê os repasses lançados.
 */
export async function candidatos(idLancamento: number, f: { idCliente?: number; idLeilao?: number; papel?: 'comprador' | 'vendedor' | 'despesa' }) {
  const l = await buscarLancamento(idLancamento);
  const idCliente = f.idCliente || l.ID_CLIENTE;
  const papel = f.papel || (l.SENTIDO === 'D' ? 'vendedor' : 'comprador');
  const pool = await getPool();

  let itens: ItemAberto[] = [];
  let nomeCliente: string | null = l.NOME_CLIENTE;
  if (papel === 'despesa') {
    // despesa paga a terceiro por conta de um cliente: procura pelo leilão (e cliente, se escolhido),
    // não pelo CPF do lançamento — quem recebeu foi o fornecedor (transportadora, gráfica...)
    itens = await despesasDoLeilao({ idLeilao: f.idLeilao, idCliente: f.idCliente });
    if (f.idCliente && f.idCliente !== l.ID_CLIENTE) nomeCliente = (await pool.request().input('c', sql.Int, f.idCliente)
      .query(`SELECT NOMEXX FROM Clientes WHERE ID = @c`)).recordset[0]?.NOMEXX ?? null;
  } else if (idCliente) {
    itens = (await itensDosClientes([idCliente], { idLeilao: f.idLeilao }))
      .filter(i => i.idCliente === idCliente && (papel === 'vendedor' ? i.tipo === 'REPASSE' : i.tipo !== 'REPASSE'));
    if (idCliente !== l.ID_CLIENTE) {
      nomeCliente = (await pool.request().input('c', sql.Int, idCliente)
        .query(`SELECT NOMEXX FROM Clientes WHERE ID = @c`)).recordset[0]?.NOMEXX ?? null;
    }
  }
  // leilões do cliente (para o filtro), do mais recente para o mais antigo
  const leiloes = new Map<number, string>();
  for (const i of [...itens].sort((a, b) => String(b.vencimento).localeCompare(String(a.vencimento))))
    if (i.idLeilao && !leiloes.has(i.idLeilao)) leiloes.set(i.idLeilao, i.leilao || `Leilão ${i.idLeilao}`);

  itens.sort((a, b) =>
    (a.leilao || '').localeCompare(b.leilao || '') || (a.lote || '').localeCompare(b.lote || '', 'pt-BR', { numeric: true }) ||
    String(a.vencimento).localeCompare(String(b.vencimento)));

  const baixas = await baixasDetalhadas(idLancamento);

  return {
    lancamento: {
      id: l.ID, data: l.DATA, valor: Number(l.VALOR), sentido: l.SENTIDO, memo: l.MEMO,
      docContraparte: l.DOC_CONTRAPARTE, nomeContraparte: l.NOME_CONTRAPARTE,
      idCliente: l.ID_CLIENTE, nomeCliente: l.NOME_CLIENTE, situacao: l.SITUACAO, categoria: l.CATEGORIA,
      sugestao: l.SUGESTAO ? (JSON.parse(l.SUGESTAO) as Sugestao) : null,
      baixado: baixas.reduce((a, b) => a + b.valor, 0),
    },
    // em despesa de cliente o cliente só filtra se o usuário escolher (quem recebeu foi o fornecedor)
    cliente: (papel === 'despesa' ? f.idCliente : idCliente) ? { id: (papel === 'despesa' ? f.idCliente : idCliente)!, nome: nomeCliente } : null,
    papel,
    leiloes: [...leiloes.entries()].map(([id, nome]) => ({ id, nome })),
    itens,
    baixas,
  };
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const txt = (v: any) => (v == null ? null : String(v).trim() || null);

/**
 * Baixas do lançamento com o que cada uma pagou: leilão, lote e animal, comprador e
 * vendedor da venda, e o dado do item (parcela com vencimento, comissão com % e base,
 * repasse ou despesa com a observação lançada).
 */
async function baixasDetalhadas(idLancamento: number) {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, idLancamento).query(`
    SELECT B.ID, B.TIPO_ALVO, B.ID_PARCELA, B.ID_MOV_COMPRADOR, B.ID_DESPESA, B.VALOR, B.REGRA, B.NOME_USUARIO, B.DATA,
           P.ORDXXX, P.DATVEN, P.VLRPAR,
           MC.COMISSAO, MC.VALORBASECOMISSAO, MC.VALORCOMISSAO, MC.VALORPAGAR,
           ML.LOTEXX, LT.DESLOT, M.DATLAN AS DATA_VENDA,
           LE.LEILAO, LE.DATLEI, CC.NOMEXX AS COMPRADOR, CV.NOMEXX AS VENDEDOR,
           D.OBSERVACOES, D.DATA_INCLUSAO AS DATA_DESPESA, CD.NOMEXX AS CLIENTE_DESPESA
    FROM CONC_BAIXAS B
    LEFT JOIN MOVIMENTO_PARCELAMENTO P ON P.ID = B.ID_PARCELA
    LEFT JOIN MOVIMENTO_COMPRADOR MC   ON MC.ID = B.ID_MOV_COMPRADOR
    LEFT JOIN MOVIMENTO_LOTE ML        ON ML.ID = ISNULL(MC.IDMOVLOTE, P.IDMOVLOTE)
    LEFT JOIN MOVIMENTO M              ON M.ID = ISNULL(MC.IDMOV, P.IDMOV)
    LEFT JOIN LOTES LT                 ON LT.ID = ML.IDLOTE
    LEFT JOIN DESPESAS D               ON D.CODIGO = B.ID_DESPESA
    LEFT JOIN LEILOES LE               ON LE.ID = COALESCE(B.ID_LEILAO, M.IDLEILAO, D.CODLEI)
    LEFT JOIN Clientes CC              ON CC.ID = TRY_CAST(ISNULL(MC.IDCLI, P.IDCLI) AS INT)
    LEFT JOIN Clientes CV              ON CV.ID = TRY_CAST(ML.CODVEN AS INT)
    LEFT JOIN Clientes CD              ON CD.ID = D.CODIGO_CLIENTE
    WHERE B.ID_LANCAMENTO = @id AND B.DESFEITA = 'N' ORDER BY B.ID`);
  return r.recordset.map((b: any) => ({
    id: b.ID, tipo: b.TIPO_ALVO, valor: Number(b.VALOR), regra: b.REGRA, usuario: b.NOME_USUARIO, data: b.DATA,
    chave: `${b.TIPO_ALVO}:${b.TIPO_ALVO === 'PARCELA' ? b.ID_PARCELA : b.TIPO_ALVO === 'REPASSE' || b.TIPO_ALVO === 'DESPESA' ? b.ID_DESPESA : b.ID_MOV_COMPRADOR}`,
    detalhe: {
      leilao: txt(b.LEILAO), dataLeilao: iso(b.DATLEI), lote: txt(b.LOTEXX), animal: txt(b.DESLOT),
      comprador: txt(b.COMPRADOR), vendedor: txt(b.VENDEDOR), dataVenda: iso(b.DATA_VENDA),
      valorCompra: b.VALORPAGAR != null ? Number(b.VALORPAGAR) : null,
      parcela: txt(b.ORDXXX), vencimento: iso(b.DATVEN), valorParcela: b.VLRPAR != null ? Number(b.VLRPAR) : null,
      percentualComissao: b.COMISSAO != null ? Number(b.COMISSAO) : null,
      baseComissao: b.VALORBASECOMISSAO != null ? Number(b.VALORBASECOMISSAO) : null,
      valorComissao: b.VALORCOMISSAO != null ? Number(b.VALORCOMISSAO) : null,
      observacao: txt(b.OBSERVACOES), dataDespesa: iso(b.DATA_DESPESA), clienteDespesa: txt(b.CLIENTE_DESPESA),
    },
  }));
}

/**
 * Baixa escolhida pelo usuário (confirmando a sugestão ou marcando na consulta).
 * Confere que cada valor cabe no saldo do item e que a soma não passa do lançamento.
 * Se o cliente escolhido não é o do CPF do lançamento, pode lembrar o CPF como pagador dele.
 */
export async function confirmarBaixa(
  idLancamento: number, alvos: ItemSugerido[], usuario: Usuario,
  opcoes: { idCliente?: number; lembrarPagador?: boolean; regra?: string; ajuste?: number } = {},
) {
  if (!alvos?.length) throw new ConciliacaoError(400, 'Marque ao menos um item');
  const l = await buscarLancamento(idLancamento);
  if (l.SITUACAO === 'NAO_VENDA') throw new ConciliacaoError(409, 'Lançamento marcado como "não é venda" — desfaça antes');
  const valorAbs = Math.abs(Number(l.VALOR));
  const pool = await getPool();
  const jaBaixado = Number((await pool.request().input('id', sql.Int, idLancamento)
    .query(`SELECT ISNULL(SUM(VALOR), 0) V FROM CONC_BAIXAS WHERE ID_LANCAMENTO = @id AND DESFEITA = 'N'`)).recordset[0].V);

  const ehDespesa = alvos.every(a => a.chave.startsWith('DESPESA:'));
  const idCliente = opcoes.idCliente || l.ID_CLIENTE;
  if (!idCliente && !ehDespesa) throw new ConciliacaoError(400, 'Escolha o cliente');
  const itens = ehDespesa
    ? await despesasDoLeilao({ ids: alvos.map(a => Number(a.chave.split(':')[1])) })
    : await itensDosClientes([idCliente]);
  const porChave = new Map(itens.map(i => [i.chave, i]));
  let soma = 0;
  for (const a of alvos) {
    const it = porChave.get(a.chave);
    if (!it) throw new ConciliacaoError(409, 'Um dos itens não está mais em aberto — atualize a consulta');
    if (a.valor <= 0 || a.valor > it.saldo + 0.01) throw new ConciliacaoError(400, `Valor maior que o saldo de "${it.descricao}"`);
    const deDebito = it.tipo === 'REPASSE' || it.tipo === 'DESPESA';
    if ((l.SENTIDO === 'C') === deDebito) throw new ConciliacaoError(400, 'Crédito baixa parcela ou comissão; débito baixa repasse ou despesa');
    soma += a.valor;
  }
  // ajuste de arredondamento: só fecha o lançamento, até R$ 1,00 (positivo: pagou a mais; negativo: a menos)
  const ajuste = Math.round((Number(opcoes.ajuste) || 0) * 100) / 100;
  if (ajuste) {
    if (Math.abs(ajuste) > TOLERANCIA_ARREDONDAMENTO + 0.001) throw new ConciliacaoError(400, 'Ajuste de arredondamento acima de R$ 1,00');
    if (Math.abs(jaBaixado + soma + ajuste - valorAbs) > 0.011) throw new ConciliacaoError(400, 'Itens e ajuste não fecham o valor do lançamento');
  } else if (jaBaixado + soma > valorAbs + 0.01) throw new ConciliacaoError(400, 'A soma passa do valor do lançamento');

  await gravarBaixas(idLancamento, alvos, opcoes.regra || 'MANUAL', usuario, itens, ajuste);
  if (ehDespesa) return candidatos(idLancamento, { papel: 'despesa', idLeilao: itens[0]?.idLeilao ?? undefined });

  if (idCliente !== l.ID_CLIENTE) {
    if (opcoes.lembrarPagador && l.DOC_CONTRAPARTE) await lembrarPagador(l.DOC_CONTRAPARTE, l.NOME_CONTRAPARTE, idCliente, usuario);
    else await pool.request().input('id', sql.Int, idLancamento).input('c', sql.Int, idCliente)
      .query(`UPDATE CONC_LANCAMENTOS SET ID_CLIENTE = @c WHERE ID = @id`);
  }
  return candidatos(idLancamento, { idCliente });
}

/** Guarda o CPF/CNPJ como pagador do cliente e liga a ele os lançamentos sem cliente com esse documento. */
export async function lembrarPagador(doc: string, nome: string | null, idCliente: number, usuario: Usuario) {
  const pool = await getPool();
  await pool.request().input('doc', sql.VarChar, doc).input('nome', sql.VarChar, nome).input('c', sql.Int, idCliente)
    .input('u', sql.Int, usuario?.id ?? null).query(`
      IF NOT EXISTS (SELECT 1 FROM CONC_PAGADORES WHERE DOC = @doc AND ID_CLIENTE = @c)
        INSERT INTO CONC_PAGADORES (DOC, NOME, ID_CLIENTE, ID_USUARIO) VALUES (@doc, @nome, @c, @u);
      UPDATE CONC_LANCAMENTOS SET ID_CLIENTE = @c
      WHERE DOC_CONTRAPARTE = @doc AND (ID_CLIENTE IS NULL OR SITUACAO IN ('PENDENTE','SUGERIDO'));`);
}

/** Desfaz todas as baixas do lançamento (ou só uma) e volta a situação. */
export async function desfazer(idLancamento: number, usuario: Usuario, idBaixa?: number) {
  const l = await buscarLancamento(idLancamento);
  const pool = await getPool();
  const req = pool.request().input('id', sql.Int, idLancamento).input('u', sql.Int, usuario?.id ?? null);
  if (idBaixa) req.input('b', sql.Int, idBaixa);
  await req.query(`UPDATE CONC_BAIXAS SET DESFEITA = 'S', ID_USUARIO_DESFEZ = @u, DATA_DESFEITA = GETDATE()
                   WHERE ID_LANCAMENTO = @id AND DESFEITA = 'N' ${idBaixa ? `AND (ID = @b OR TIPO_ALVO = 'AJUSTE')` : ''}`);
  if (l.SITUACAO === 'NAO_VENDA') {
    await pool.request().input('id', sql.Int, idLancamento)
      .query(`UPDATE CONC_LANCAMENTOS SET SITUACAO = 'PENDENTE', CATEGORIA = NULL WHERE ID = @id`);
  } else if (l.SITUACAO === 'DESPESA') {
    await desfazerDespesaEmpresa(idLancamento);
  } else {
    await atualizarSituacao(pool.request(), idLancamento, Math.abs(Number(l.VALOR)));
  }
}

/** Marca como "não é venda"; com `lembrar`, os próximos lançamentos do mesmo CPF/CNPJ (ou histórico) vêm marcados. */
export async function marcarNaoVenda(
  idLancamento: number, categoria: string, usuario: Usuario, lembrar?: 'documento' | 'historico' | null,
) {
  const l = await buscarLancamento(idLancamento);
  // com documento, só lembra pelo documento: o começo do histórico de um PIX é
  // "RECEBIMENTO PIX" e a regra passaria a ignorar todos os PIX
  if (lembrar === 'historico' && l.DOC_CONTRAPARTE) lembrar = 'documento';
  const pool = await getPool();
  const temBaixa = (await pool.request().input('id', sql.Int, idLancamento)
    .query(`SELECT COUNT(*) N FROM CONC_BAIXAS WHERE ID_LANCAMENTO = @id AND DESFEITA = 'N'`)).recordset[0].N;
  if (temBaixa) throw new ConciliacaoError(409, 'Lançamento tem baixa — desfaça antes');
  const cat = (categoria || 'Não é venda').slice(0, 60);
  await pool.request().input('id', sql.Int, idLancamento).input('cat', sql.VarChar, cat)
    .query(`UPDATE CONC_LANCAMENTOS SET SITUACAO = 'NAO_VENDA', CATEGORIA = @cat, SUGESTAO = NULL WHERE ID = @id`);
  if (lembrar === 'documento' && l.DOC_CONTRAPARTE) {
    await pool.request().input('doc', sql.VarChar, l.DOC_CONTRAPARTE).input('cat', sql.VarChar, cat).input('u', sql.Int, usuario?.id ?? null)
      .query(`IF NOT EXISTS (SELECT 1 FROM CONC_IGNORAR WHERE DOC = @doc)
              INSERT INTO CONC_IGNORAR (DOC, CATEGORIA, ID_USUARIO) VALUES (@doc, @cat, @u)`);
  } else if (lembrar === 'historico' && l.MEMO) {
    // o começo do histórico, antes do documento (ex.: "TARIFA COM R LIQUIDACAO")
    const padrao = String(l.MEMO).split(/\s\d{11,14}\s|-/)[0].trim().slice(0, 100);
    if (padrao.length >= 5) await pool.request().input('p', sql.VarChar, padrao).input('cat', sql.VarChar, cat).input('u', sql.Int, usuario?.id ?? null)
      .query(`IF NOT EXISTS (SELECT 1 FROM CONC_IGNORAR WHERE PADRAO_MEMO = @p)
              INSERT INTO CONC_IGNORAR (PADRAO_MEMO, CATEGORIA, ID_USUARIO) VALUES (@p, @cat, @u)`);
  }
}

/**
 * Débito que paga uma despesa de cliente ainda não lançada (ex.: frete do vendedor):
 * cria a despesa nas Despesas do leilão — onde ela entra no acerto do cliente — e já
 * dá a baixa com este débito.
 */
export async function criarDespesaClienteEBaixar(
  idLancamento: number, d: { idLeilao: number; idCliente: number; observacoes?: string; valor?: number }, usuario: Usuario,
) {
  const l = await buscarLancamento(idLancamento);
  if (l.SENTIDO !== 'D') throw new ConciliacaoError(400, 'Só débito paga despesa');
  if (!d.idLeilao || !d.idCliente) throw new ConciliacaoError(400, 'Escolha o leilão e o cliente da despesa');
  const pool = await getPool();
  const jaBaixado = Number((await pool.request().input('id', sql.Int, idLancamento)
    .query(`SELECT ISNULL(SUM(VALOR), 0) V FROM CONC_BAIXAS WHERE ID_LANCAMENTO = @id AND DESFEITA = 'N'`)).recordset[0].V);
  const restante = Math.round((Math.abs(Number(l.VALOR)) - jaBaixado) * 100) / 100;
  const valor = Math.round((d.valor || restante) * 100) / 100;
  if (valor <= 0 || valor > restante + 0.01) throw new ConciliacaoError(400, 'Valor maior que o que falta do lançamento');
  const obs = (d.observacoes || `${l.NOME_CONTRAPARTE || 'Despesa'} - pago em ${new Date(l.DATA).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`).slice(0, 250);
  const idDespesa = await criarDespesa({ codLei: d.idLeilao, codigoCliente: d.idCliente, dc: 'D', valor, observacoes: obs });
  return confirmarBaixa(idLancamento, [{ chave: `DESPESA:${idDespesa}`, valor }], usuario, { regra: 'MANUAL' });
}
