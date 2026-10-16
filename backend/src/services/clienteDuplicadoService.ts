import { getPool, sql } from '../config/database';

// Clientes com o mesmo CPF (ou CNPJ) cadastrados mais de uma vez — o Delphi e a API do
// site/app gravam sem conferir. A unificação passa tudo o que aponta para a cópia
// (compras, vendas, parcelas, lances, despesas...) para o cadastro que fica e apaga a cópia.

const normDoc = (col: string) => `REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(${col},''),'.',''),'-',''),'/',''),' ','')`;
// documentos de preenchimento ("000.000.000-00", "111.111.111-11") não identificam ninguém
const DOCS_FALSOS = `('00000000000','11111111111','22222222222','33333333333','44444444444','55555555555','66666666666','77777777777','88888888888','99999999999','00000000000000')`;

/**
 * Onde o ID do cliente aparece. `texto`: a coluna é varchar (compara como texto pra não
 * converter a coluna). `unico`: colunas que, junto com o cliente, não podem repetir — a
 * linha da cópia que repetiria a do principal é apagada em vez de transferida.
 * Ficam de fora LOG, Agenda, CHAMADOS e preferências: ali o ID é do usuário do sistema.
 */
const REFERENCIAS: { tabela: string; coluna: string; texto?: boolean; unico?: string[]; rotulo: string }[] = [
  { tabela: 'Movimento',              coluna: 'IDCLI',            rotulo: 'vendas (comprador)' },
  { tabela: 'Movimento_Comprador',    coluna: 'IDCLI', texto: true, rotulo: 'compras' },
  { tabela: 'Movimento_Comprador',    coluna: 'ID_PISTEIRO',      rotulo: 'pisteiro' },
  { tabela: 'Movimento_Lote',         coluna: 'CODVEN', texto: true, rotulo: 'vendas (vendedor)' },
  { tabela: 'Movimento_Parcelamento', coluna: 'IDCLI',            rotulo: 'parcelas' },
  { tabela: 'Movimento_Parcelamento', coluna: 'CODVEN', texto: true, rotulo: 'parcelas (vendedor)' },
  { tabela: 'Lotes',                  coluna: 'CODVEN',           rotulo: 'lotes' },
  { tabela: 'Lotes_Lances',           coluna: 'IDCLIENTE',        rotulo: 'lances' },
  { tabela: 'Despesas',               coluna: 'CODIGO_CLIENTE',   rotulo: 'despesas' },
  { tabela: 'Clientes_Propriedades',  coluna: 'ID_CLIENTE', unico: ['INSCRICAO'], rotulo: 'propriedades' },
  { tabela: 'CLIENTES_CLASSIFICACOES', coluna: 'ID_CLIENTE', unico: ['ID_CLASSIFICACAO'], rotulo: 'classificações' },
  { tabela: 'OCORRENCIAS',            coluna: 'CODIGO_CLIENTE',   rotulo: 'ocorrências' },
  { tabela: 'Clientes_Curtidas',      coluna: 'ID_CLIENTES', unico: ['ID_LOTES'], rotulo: 'curtidas' },
  { tabela: 'Clientes_Favoritos',     coluna: 'ID_CLIENTES', unico: ['ID_LOTES'], rotulo: 'favoritos' },
  { tabela: 'Clientes',               coluna: 'ID_SOLICITADO_POR', rotulo: 'cadastros solicitados' },
  { tabela: 'CONC_LANCAMENTOS',       coluna: 'ID_CLIENTE',       rotulo: 'conciliação' },
  { tabela: 'CONC_PAGADORES',         coluna: 'ID_CLIENTE',       rotulo: 'pagadores da conciliação' },
  { tabela: 'CONC_BAIXAS',            coluna: 'ID_VENDEDOR',      rotulo: 'baixas da conciliação' },
];

/** Campos do cadastro que, vazios no principal, são completados com os da cópia. */
const CAMPOS_COMPLETAR = [
  'ENDERE', 'BAIRRO', 'CEPXXX', 'CIDADE', 'COMPLE', 'TELRES', 'TELCOM', 'CELU_1', 'CELU_2', 'EMAILX', 'EMAIL2',
  'RGXXXX', 'ORG_EM', 'EMISSA', 'DATNAS', 'PAIXXX', 'MAEXXX', 'PROFISS', 'EMPRES', 'ESTCIV', 'INSEST', 'PROPRI',
  'PIX', 'BANCOX', 'AGENCI', 'CONTAX', 'SENHAX',
];

export class UnificacaoError extends Error {
  constructor(public status: number, msg: string) { super(msg); this.name = 'UnificacaoError'; }
}

/** Referências que existem neste banco (cada empresa tem um conjunto de tabelas). */
async function referenciasDoBanco() {
  const pool = await getPool();
  const r = await pool.request().query(`SELECT OBJECT_NAME(object_id) AS T, name AS C FROM sys.columns
    WHERE object_id IN (${REFERENCIAS.map(x => `OBJECT_ID('${x.tabela}')`).join(',')})`);
  const existe = new Set(r.recordset.map((x: any) => `${String(x.T).toUpperCase()}.${String(x.C).toUpperCase()}`));
  return REFERENCIAS.filter(x => existe.has(`${x.tabela.toUpperCase()}.${x.coluna.toUpperCase()}`));
}

/** Grupos de clientes com o mesmo CPF (11 dígitos em CPFXXX) ou CNPJ (14 dígitos em CNPJXX). */
export async function listarDuplicados() {
  const pool = await getPool();
  const refs = await referenciasDoBanco();
  const temRef = (t: string, c: string) => refs.some(x => x.tabela === t && x.coluna === c);
  // 1º os IDs duplicados; depois as contagens só deles, agrupadas (a CTE repetida em cada
  // subconsulta correlacionada levava 15 s)
  const d = await pool.request().query(`
    WITH B AS (
      SELECT ID, ${normDoc('CPFXXX')} AS CPF, ${normDoc('CNPJXX')} AS CNPJ FROM Clientes
    ), G AS (
      SELECT ID, CPF AS DOC, 'CPF' AS TIPO FROM B WHERE LEN(CPF) = 11 AND CPF NOT IN ${DOCS_FALSOS}
      UNION
      SELECT ID, CNPJ, 'CNPJ' FROM B WHERE LEN(CNPJ) = 14 AND CNPJ NOT IN ${DOCS_FALSOS}
    )
    SELECT G.ID, G.DOC, G.TIPO FROM G
    WHERE G.DOC IN (SELECT DOC FROM G GROUP BY DOC, TIPO HAVING COUNT(DISTINCT ID) > 1)`);
  if (!d.recordset.length) return [];
  const ids = [...new Set(d.recordset.map((x: any) => Number(x.ID)))];
  const lista = ids.join(',');
  const listaTxt = ids.map(i => `'${i}'`).join(',');
  const contagem = async (t: string, c: string, texto = false) => {
    const m = new Map<number, number>();
    const rr = await pool.request().query(`SELECT ${c} AS K, COUNT(*) AS N FROM ${t} WHERE ${c} IN (${texto ? listaTxt : lista}) GROUP BY ${c}`);
    for (const x of rr.recordset) m.set(Number(x.K), x.N);
    return m;
  };
  const [compras, lotes, vendas, lances, despesas] = await Promise.all([
    contagem('Movimento_Comprador', 'IDCLI', true), contagem('Lotes', 'CODVEN'), contagem('Movimento_Lote', 'CODVEN', true),
    temRef('Lotes_Lances', 'IDCLIENTE') ? contagem('Lotes_Lances', 'IDCLIENTE') : Promise.resolve(new Map<number, number>()),
    contagem('Despesas', 'CODIGO_CLIENTE'),
  ]);
  const cad = await pool.request().query(`
    SELECT C.ID, C.NOMEXX, C.CPFXXX, C.CNPJXX, C.DATCAD, C.ATIVOX, C.ACESSO_APP, C.EMAILX, C.CELU_1,
           CASE WHEN ISNULL(C.SENHAX,'') = '' THEN 0 ELSE 1 END AS TEM_SENHA, C.ADM,
           CI.CIDADE AS NOME_CIDADE, CI.ESTADO, U.NOMEXX AS USUARIO_CAD
    FROM Clientes C LEFT JOIN Cidades CI ON CI.ID = C.CIDADE LEFT JOIN Clientes U ON U.ID = C.USUCAD
    WHERE C.ID IN (${lista})`);
  const porId = new Map(cad.recordset.map((c: any) => [c.ID, c]));
  const r = { recordset: d.recordset
    .map((x: any) => {
      const c: any = porId.get(x.ID);
      return { ...c, DOC: x.DOC, TIPO: x.TIPO, COMPRAS: compras.get(x.ID) || 0, LOTES: lotes.get(x.ID) || 0,
        VENDAS: vendas.get(x.ID) || 0, LANCES: lances.get(x.ID) || 0, DESPESAS: despesas.get(x.ID) || 0 };
    })
    .sort((a: any, b: any) => String(a.DOC).localeCompare(String(b.DOC)) || a.ID - b.ID) };

  const grupos = new Map<string, any>();
  for (const x of r.recordset) {
    const k = `${x.TIPO}:${x.DOC}`;
    if (!grupos.has(k)) grupos.set(k, { chave: k, doc: x.DOC, tipo: x.TIPO, clientes: [] as any[] });
    const uso = x.COMPRAS + x.LOTES + x.VENDAS + x.LANCES + x.DESPESAS;
    grupos.get(k).clientes.push({
      id: x.ID, nome: (x.NOMEXX || '').trim(), cpf: x.CPFXXX, cnpj: x.CNPJXX, datcad: x.DATCAD, ativo: x.ATIVOX,
      acessoApp: x.ACESSO_APP, email: x.EMAILX, celular: x.CELU_1, temSenha: !!x.TEM_SENHA, adm: x.ADM === 'S',
      cidade: x.NOME_CIDADE ? `${String(x.NOME_CIDADE).trim()}${x.ESTADO ? `/${String(x.ESTADO).trim()}` : ''}` : null,
      usuarioCad: x.USUARIO_CAD, compras: x.COMPRAS, lotes: x.LOTES, vendas: x.VENDAS, lances: x.LANCES, despesas: x.DESPESAS, uso,
    });
  }
  const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  return [...grupos.values()].map(g => {
    // sugestão: o de mais movimento; empatado, o mais antigo
    const sugerido = [...g.clientes].sort((a: any, b: any) => b.uso - a.uso || a.id - b.id)[0];
    const nomes = new Set(g.clientes.map((c: any) => semAcento(c.nome)));
    return {
      ...g, idSugerido: sugerido.id,
      nomesDiferentes: nomes.size > 1,
      comMovimento: g.clientes.filter((c: any) => c.uso > 0).length,
      temUsuario: g.clientes.some((c: any) => c.adm),
    };
  });
}

/**
 * Passa tudo das cópias para o principal e apaga as cópias, numa transação só.
 * Confere que todos têm o mesmo CPF/CNPJ. Com `completar`, os campos vazios do principal
 * recebem os da cópia (endereço, telefone, e-mail, senha do site...).
 */
export async function unificar(idPrincipal: number, idsCopias: number[], completar = true) {
  const copias = [...new Set(idsCopias.map(Number).filter(id => id && id !== idPrincipal))];
  if (!idPrincipal || !copias.length) throw new UnificacaoError(400, 'Escolha o cadastro que fica e ao menos uma cópia');
  const pool = await getPool();
  const ids = [idPrincipal, ...copias];
  const reqC = pool.request();
  const r = await reqC.query(`SELECT ID, NOMEXX, ADM, ${normDoc('CPFXXX')} AS CPF, ${normDoc('CNPJXX')} AS CNPJ, ${CAMPOS_COMPLETAR.join(', ')}, OBSXXX
    FROM Clientes WHERE ID IN (${ids.map(i => Number(i)).join(',')})`);
  const porId = new Map(r.recordset.map((c: any) => [c.ID, c]));
  for (const id of ids) if (!porId.has(id)) throw new UnificacaoError(404, `Cliente ${id} não encontrado`);
  const principal: any = porId.get(idPrincipal);
  const doc = (c: any) => (c.CPF.length === 11 ? c.CPF : '') || (c.CNPJ.length === 14 ? c.CNPJ : '');
  const docPrincipal = doc(principal);
  for (const id of copias) {
    const c: any = porId.get(id);
    // o mesmo CPF ou o mesmo CNPJ
    const mesmo = (principal.CPF.length === 11 && principal.CPF === c.CPF) || (principal.CNPJ.length === 14 && principal.CNPJ === c.CNPJ);
    if (!docPrincipal || !mesmo) throw new UnificacaoError(400, `O cliente ${id} (${c.NOMEXX?.trim()}) não tem o mesmo CPF/CNPJ`);
    if (c.ADM === 'S') throw new UnificacaoError(400, `${c.NOMEXX?.trim()} é usuário do sistema — não pode ser apagado como cópia`);
  }

  const refs = await referenciasDoBanco();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  const movidos: Record<string, number> = {};
  try {
    for (const id of copias) {
      const c: any = porId.get(id);
      for (const ref of refs) {
        const req = new sql.Request(tx);
        const tipo = ref.texto ? sql.VarChar : sql.Int;
        req.input('p', tipo, ref.texto ? String(idPrincipal) : idPrincipal).input('c', tipo, ref.texto ? String(id) : id);
        // a linha da cópia que repetiria uma do principal (mesma classificação, mesmo lote curtido...) sai
        const dedup = ref.unico ? `
          DELETE X FROM ${ref.tabela} X
          WHERE X.${ref.coluna} = @c AND EXISTS (SELECT 1 FROM ${ref.tabela} Y WHERE Y.${ref.coluna} = @p
            AND ${ref.unico.map(u => `ISNULL(CAST(Y.${u} AS VARCHAR(100)),'') = ISNULL(CAST(X.${u} AS VARCHAR(100)),'')`).join(' AND ')});` : '';
        const rr = await req.query(`${dedup}
          UPDATE ${ref.tabela} SET ${ref.coluna} = @p WHERE ${ref.coluna} = @c;
          SELECT @@ROWCOUNT AS N;`);
        const n = rr.recordset?.[0]?.N || 0;
        if (n) movidos[ref.rotulo] = (movidos[ref.rotulo] || 0) + n;
      }

      if (completar) {
        const vazios = CAMPOS_COMPLETAR.filter(f => (principal[f] == null || String(principal[f]).trim() === '') && c[f] != null && String(c[f]).trim() !== '');
        if (vazios.length) {
          const req = new sql.Request(tx).input('p', sql.Int, idPrincipal).input('c', sql.Int, id);
          await req.query(`UPDATE P SET ${vazios.map(f => `P.${f} = C.${f}`).join(', ')}
            FROM Clientes P CROSS JOIN Clientes C WHERE P.ID = @p AND C.ID = @c`);
          for (const f of vazios) principal[f] = c[f];
        }
      }

      // sessões do app da cópia não servem mais
      for (const [t, col] of [['Token', 'IDCLIENTE'], ['Clientes_Token', 'ID_CLIENTES']])
        await new sql.Request(tx).input('c', sql.Int, id).query(`IF OBJECT_ID('${t}') IS NOT NULL DELETE FROM ${t} WHERE ${col} = @c`);

      await new sql.Request(tx).input('c', sql.Int, id).query(`DELETE FROM Clientes WHERE ID = @c`);
    }

    // rastro no próprio cadastro: quais cadastros foram juntados a ele
    const nota = `Unificado em ${new Date().toLocaleDateString('pt-BR')} com: ${copias.map(id => `#${id} ${String((porId.get(id) as any).NOMEXX || '').trim()}`).join('; ')}`;
    await new sql.Request(tx).input('p', sql.Int, idPrincipal).input('nota', sql.VarChar, nota).query(`
      UPDATE Clientes SET OBSXXX = CASE WHEN ISNULL(OBSXXX,'') = '' THEN LEFT(@nota, 1000)
        -- OBSXXX é varchar(1000): corta o texto antigo, nunca a nota
        ELSE LEFT(OBSXXX, 1000 - LEN(LEFT(@nota, 900)) - 2) + CHAR(13) + CHAR(10) + LEFT(@nota, 900) END
      WHERE ID = @p`);
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  return { idPrincipal, apagados: copias, movidos };
}
