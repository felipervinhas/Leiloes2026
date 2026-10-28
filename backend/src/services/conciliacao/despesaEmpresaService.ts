import { getPool, sql } from '../../config/database';
import { garantirTabelasConciliacao } from './schema';
import { ConciliacaoError } from './acessoService';

// Despesas da própria empresa (aluguel de veículo, seguro, telefone, tarifas...). Ficam
// fora do cadastro de Despesas do leilão, que é a conta corrente de vendedor e comprador
// e alimenta os acertos — lá elas distorceriam o saldo do leilão e não teriam categoria.

type Usuario = { id?: number; nome?: string } | undefined;

export async function listarCategorias(incluirInativas = false) {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT C.ID, C.NOME, C.ATIVA,
      (SELECT COUNT(*) FROM CONC_DESPESAS_EMPRESA D WHERE D.ID_CATEGORIA = C.ID) AS USO
    FROM CONC_CATEGORIAS C ${incluirInativas ? '' : "WHERE C.ATIVA = 'S'"} ORDER BY C.NOME`);
  return r.recordset.map((c: any) => ({ id: c.ID, nome: c.NOME, ativa: c.ATIVA === 'S', uso: c.USO }));
}

export async function salvarCategoria(id: number | null, nome: string, ativa = true) {
  await garantirTabelasConciliacao();
  const n = (nome || '').trim().slice(0, 60);
  if (!n) throw new ConciliacaoError(400, 'Informe o nome da categoria');
  const pool = await getPool();
  const dup = await pool.request().input('n', sql.VarChar, n).input('id', sql.Int, id ?? 0)
    .query(`SELECT ID FROM CONC_CATEGORIAS WHERE NOME = @n AND ID <> @id`);
  if (dup.recordset.length) throw new ConciliacaoError(409, 'Já existe uma categoria com esse nome');
  const req = pool.request().input('n', sql.VarChar, n).input('a', sql.Char, ativa ? 'S' : 'N');
  if (id) { await req.input('id', sql.Int, id).query(`UPDATE CONC_CATEGORIAS SET NOME = @n, ATIVA = @a WHERE ID = @id`); return id; }
  return (await req.query(`INSERT INTO CONC_CATEGORIAS (NOME, ATIVA) OUTPUT INSERTED.ID VALUES (@n, @a)`)).recordset[0].ID as number;
}

/**
 * "Despesa da empresa" na conciliação manual: só débito, sem baixa, ainda não classificado.
 * Com `lembrar`, os próximos lançamentos do mesmo CPF/CNPJ (ou histórico, se não tiver
 * documento) entram sozinhos nesta categoria.
 */
export async function registrarDespesaEmpresa(
  idLancamento: number,
  dados: { idCategoria: number; fornecedor?: string; idLeilao?: number; observacao?: string; lembrar?: boolean },
  usuario: Usuario,
) {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const l = (await pool.request().input('id', sql.Int, idLancamento)
    .query(`SELECT * FROM CONC_LANCAMENTOS WHERE ID = @id`)).recordset[0];
  if (!l) throw new ConciliacaoError(404, 'Lançamento não encontrado');
  if (l.SENTIDO !== 'D') throw new ConciliacaoError(400, 'Despesa da empresa é só para débitos');
  if (l.SITUACAO === 'DESPESA' || l.SITUACAO === 'NAO_VENDA') throw new ConciliacaoError(409, 'Lançamento já classificado — desfaça antes');
  const baixas = (await pool.request().input('id', sql.Int, idLancamento)
    .query(`SELECT COUNT(*) N FROM CONC_BAIXAS WHERE ID_LANCAMENTO = @id AND DESFEITA = 'N'`)).recordset[0].N;
  if (baixas) throw new ConciliacaoError(409, 'Lançamento tem baixa — desfaça antes');

  await gravarDespesaEmpresaComNome(pool, l, dados.idCategoria, dados, usuario);

  if (dados.lembrar) {
    const cat = (await pool.request().input('c', sql.Int, dados.idCategoria).query(`SELECT NOME FROM CONC_CATEGORIAS WHERE ID = @c`)).recordset[0];
    if (l.DOC_CONTRAPARTE) {
      await pool.request().input('doc', sql.VarChar, l.DOC_CONTRAPARTE).input('cat', sql.VarChar, cat.NOME)
        .input('idc', sql.Int, dados.idCategoria).input('u', sql.Int, usuario?.id ?? null).query(`
          DELETE FROM CONC_IGNORAR WHERE DOC = @doc;
          INSERT INTO CONC_IGNORAR (DOC, CATEGORIA, ID_CATEGORIA, ID_USUARIO) VALUES (@doc, @cat, @idc, @u)`);
    } else if (l.MEMO) {
      // o começo do histórico, antes do código (ex.: "TARIFA COM R LIQUIDACAO")
      const padrao = String(l.MEMO).split(/\s\d{11,14}\s|-/)[0].trim().slice(0, 100);
      if (padrao.length >= 5) await pool.request().input('p', sql.VarChar, padrao).input('cat', sql.VarChar, cat.NOME)
        .input('idc', sql.Int, dados.idCategoria).input('u', sql.Int, usuario?.id ?? null).query(`
          DELETE FROM CONC_IGNORAR WHERE PADRAO_MEMO = @p;
          INSERT INTO CONC_IGNORAR (PADRAO_MEMO, CATEGORIA, ID_CATEGORIA, ID_USUARIO) VALUES (@p, @cat, @idc, @u)`);
    }
  }
}

/** Grava a despesa da empresa de um débito e marca o lançamento (situação DESPESA, categoria no lançamento para a lista). */
export async function gravarDespesaEmpresaComNome(
  pool: any, l: any, idCategoria: number, dados: { fornecedor?: string | null; idLeilao?: number | null; observacao?: string | null },
  usuario: Usuario,
) {
  const cat = (await pool.request().input('c', sql.Int, idCategoria)
    .query(`SELECT NOME FROM CONC_CATEGORIAS WHERE ID = @c`)).recordset[0];
  if (!cat) throw new ConciliacaoError(400, 'Categoria não encontrada');
  await pool.request()
    .input('lanc', sql.Int, l.ID).input('cat', sql.Int, idCategoria).input('catNome', sql.VarChar, cat.NOME)
    .input('forn', sql.VarChar, ((dados.fornecedor || l.NOME_CONTRAPARTE || '') as string).slice(0, 120) || null)
    .input('doc', sql.VarChar, l.DOC_CONTRAPARTE || null)
    .input('data', sql.Date, l.DATA).input('valor', sql.Decimal(18, 2), Math.abs(Number(l.VALOR)))
    .input('leilao', sql.Int, dados.idLeilao || null).input('obs', sql.VarChar, dados.observacao ? dados.observacao.slice(0, 255) : null)
    .input('u', sql.Int, usuario?.id ?? null).input('nu', sql.VarChar, usuario?.nome ?? null)
    .query(`
      INSERT INTO CONC_DESPESAS_EMPRESA (ID_LANCAMENTO, ID_CATEGORIA, FORNECEDOR, DOC_FORNECEDOR, DATA, VALOR, ID_LEILAO, OBSERVACAO, ID_USUARIO, NOME_USUARIO)
      VALUES (@lanc, @cat, @forn, @doc, @data, @valor, @leilao, @obs, @u, @nu);
      UPDATE CONC_LANCAMENTOS SET SITUACAO = 'DESPESA', CATEGORIA = @catNome, SUGESTAO = NULL WHERE ID = @lanc;`);
}

/** Desfaz a classificação: apaga a despesa e o lançamento volta a pendente. */
export async function desfazerDespesaEmpresa(idLancamento: number) {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, idLancamento).query(`
    DELETE FROM CONC_DESPESAS_EMPRESA WHERE ID_LANCAMENTO = @id;
    UPDATE CONC_LANCAMENTOS SET SITUACAO = 'PENDENTE', CATEGORIA = NULL WHERE ID = @id;`);
}

/** Relatório: despesas do período com o total por categoria. */
export async function relatorioDespesas(f: { de?: string; ate?: string; idsCategoria?: number[] }) {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const req = pool.request();
  const conds: string[] = [];
  if (f.de) { req.input('de', sql.Date, f.de); conds.push('D.DATA >= @de'); }
  if (f.ate) { req.input('ate', sql.Date, f.ate); conds.push('D.DATA <= @ate'); }
  if (f.idsCategoria?.length) {
    const ps = f.idsCategoria.map((id, i) => { req.input(`c${i}`, sql.Int, id); return `@c${i}`; }).join(',');
    conds.push(`D.ID_CATEGORIA IN (${ps})`);
  }
  const r = await req.query(`
    SELECT D.*, C.NOME AS CATEGORIA, L.LEILAO, CT.DESCRICAO AS CONTA
    FROM CONC_DESPESAS_EMPRESA D
    LEFT JOIN CONC_CATEGORIAS C   ON C.ID = D.ID_CATEGORIA
    LEFT JOIN LEILOES L           ON L.ID = D.ID_LEILAO
    LEFT JOIN CONC_LANCAMENTOS LC ON LC.ID = D.ID_LANCAMENTO
    LEFT JOIN CONC_CONTAS CT      ON CT.ID = LC.ID_CONTA
    ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}
    ORDER BY D.DATA DESC, D.ID DESC`);
  const linhas = r.recordset.map((x: any) => ({
    id: x.ID, idLancamento: x.ID_LANCAMENTO, data: x.DATA, categoria: x.CATEGORIA, idCategoria: x.ID_CATEGORIA,
    fornecedor: x.FORNECEDOR, docFornecedor: x.DOC_FORNECEDOR, valor: Number(x.VALOR), leilao: x.LEILAO,
    observacao: x.OBSERVACAO, conta: x.CONTA, usuario: x.NOME_USUARIO,
  }));
  const porCategoria = new Map<string, { categoria: string; qtd: number; total: number }>();
  for (const l of linhas) {
    const k = l.categoria || 'Sem categoria';
    const g = porCategoria.get(k) || { categoria: k, qtd: 0, total: 0 };
    g.qtd++; g.total = Math.round((g.total + l.valor) * 100) / 100;
    porCategoria.set(k, g);
  }
  return {
    linhas,
    porCategoria: [...porCategoria.values()].sort((a, b) => b.total - a.total),
    total: Math.round(linhas.reduce((a, l) => a + l.valor, 0) * 100) / 100,
  };
}
