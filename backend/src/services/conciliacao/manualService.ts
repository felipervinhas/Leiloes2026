import { getPool, sql } from '../../config/database';
import { garantirTabelasConciliacao } from './schema';
import { ConciliacaoError } from './acessoService';
import { itensDosClientes, ItemAberto } from './devidoService';
import { atualizarSituacao, gravarBaixas, ItemSugerido, Sugestao } from './motorService';

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
export async function candidatos(idLancamento: number, f: { idCliente?: number; idLeilao?: number; papel?: 'comprador' | 'vendedor' }) {
  const l = await buscarLancamento(idLancamento);
  const idCliente = f.idCliente || l.ID_CLIENTE;
  const papel = f.papel || (l.SENTIDO === 'D' ? 'vendedor' : 'comprador');
  const pool = await getPool();

  let itens: ItemAberto[] = [];
  let nomeCliente: string | null = l.NOME_CLIENTE;
  if (idCliente) {
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

  const baixas = (await pool.request().input('id', sql.Int, idLancamento).query(`
    SELECT ID, TIPO_ALVO, ID_PARCELA, ID_MOV_COMPRADOR, ID_DESPESA, VALOR, REGRA, NOME_USUARIO, DATA
    FROM CONC_BAIXAS WHERE ID_LANCAMENTO = @id AND DESFEITA = 'N' ORDER BY ID`)).recordset;

  return {
    lancamento: {
      id: l.ID, data: l.DATA, valor: Number(l.VALOR), sentido: l.SENTIDO, memo: l.MEMO,
      docContraparte: l.DOC_CONTRAPARTE, nomeContraparte: l.NOME_CONTRAPARTE,
      idCliente: l.ID_CLIENTE, nomeCliente: l.NOME_CLIENTE, situacao: l.SITUACAO, categoria: l.CATEGORIA,
      sugestao: l.SUGESTAO ? (JSON.parse(l.SUGESTAO) as Sugestao) : null,
      baixado: baixas.reduce((a: number, b: any) => a + Number(b.VALOR), 0),
    },
    cliente: idCliente ? { id: idCliente, nome: nomeCliente } : null,
    papel,
    leiloes: [...leiloes.entries()].map(([id, nome]) => ({ id, nome })),
    itens,
    baixas: baixas.map((b: any) => ({
      id: b.ID, tipo: b.TIPO_ALVO, valor: Number(b.VALOR), regra: b.REGRA, usuario: b.NOME_USUARIO, data: b.DATA,
      chave: `${b.TIPO_ALVO}:${b.TIPO_ALVO === 'PARCELA' ? b.ID_PARCELA : b.TIPO_ALVO === 'REPASSE' ? b.ID_DESPESA : b.ID_MOV_COMPRADOR}`,
    })),
  };
}

/**
 * Baixa escolhida pelo usuário (confirmando a sugestão ou marcando na consulta).
 * Confere que cada valor cabe no saldo do item e que a soma não passa do lançamento.
 * Se o cliente escolhido não é o do CPF do lançamento, pode lembrar o CPF como pagador dele.
 */
export async function confirmarBaixa(
  idLancamento: number, alvos: ItemSugerido[], usuario: Usuario,
  opcoes: { idCliente?: number; lembrarPagador?: boolean; regra?: string } = {},
) {
  if (!alvos?.length) throw new ConciliacaoError(400, 'Marque ao menos um item');
  const l = await buscarLancamento(idLancamento);
  if (l.SITUACAO === 'NAO_VENDA') throw new ConciliacaoError(409, 'Lançamento marcado como "não é venda" — desfaça antes');
  const valorAbs = Math.abs(Number(l.VALOR));
  const pool = await getPool();
  const jaBaixado = Number((await pool.request().input('id', sql.Int, idLancamento)
    .query(`SELECT ISNULL(SUM(VALOR), 0) V FROM CONC_BAIXAS WHERE ID_LANCAMENTO = @id AND DESFEITA = 'N'`)).recordset[0].V);

  const idCliente = opcoes.idCliente || l.ID_CLIENTE;
  if (!idCliente) throw new ConciliacaoError(400, 'Escolha o cliente');
  const itens = await itensDosClientes([idCliente]);
  const porChave = new Map(itens.map(i => [i.chave, i]));
  let soma = 0;
  for (const a of alvos) {
    const it = porChave.get(a.chave);
    if (!it) throw new ConciliacaoError(409, 'Um dos itens não está mais em aberto — atualize a consulta');
    if (a.valor <= 0 || a.valor > it.saldo + 0.01) throw new ConciliacaoError(400, `Valor maior que o saldo de "${it.descricao}"`);
    if ((l.SENTIDO === 'C') !== (it.tipo !== 'REPASSE')) throw new ConciliacaoError(400, 'Crédito baixa parcela ou comissão; débito baixa repasse');
    soma += a.valor;
  }
  if (jaBaixado + soma > valorAbs + 0.01) throw new ConciliacaoError(400, 'A soma passa do valor do lançamento');

  await gravarBaixas(idLancamento, alvos, opcoes.regra || 'MANUAL', usuario, itens);

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
                   WHERE ID_LANCAMENTO = @id AND DESFEITA = 'N' ${idBaixa ? 'AND ID = @b' : ''}`);
  if (l.SITUACAO === 'NAO_VENDA') {
    await pool.request().input('id', sql.Int, idLancamento)
      .query(`UPDATE CONC_LANCAMENTOS SET SITUACAO = 'PENDENTE', CATEGORIA = NULL WHERE ID = @id`);
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
