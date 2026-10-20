import Anthropic from '@anthropic-ai/sdk';
import { getPool, sql } from '../config/database';
import { mediasPorCategoria } from './consultaVendasService';
import { calcularAcertoVendedor } from './acertoVendedorService';
import { contarClientesPendentes, listarClientesPendentes } from './clienteService';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Definição das tools disponíveis para o Claude ───────────────────────────

const periodo = {
  de:  { type: 'string', description: 'Data inicial AAAA-MM-DD (data do leilão)' },
  ate: { type: 'string', description: 'Data final AAAA-MM-DD (data do leilão)' },
};

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'buscar_clientes',
    description: 'Busca clientes pelo nome ou CPF/CNPJ (com ou sem pontuação). Retorna até 20 com ID, contato, cidade e situação do cadastro (ativo, bloqueado, acesso ao app, data do cadastro). Use para "o CPF tal é cadastrado?" e para achar o ID do cliente antes das outras ferramentas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nome: { type: 'string', description: 'Nome ou parte do nome do cliente' },
        cpf:  { type: 'string', description: 'CPF ou CNPJ (ou parte) do cliente' },
      },
    },
  },
  {
    name: 'listar_leiloes',
    description: 'Lista os leilões, do mais recente para o mais antigo, com o ID. Use "busca" para achar um leilão pelo nome (ex.: "dose dupla") e "ano" para um ano.',
    input_schema: {
      type: 'object' as const,
      properties: {
        busca: { type: 'string', description: 'Parte do nome do leilão' },
        ano:   { type: 'number', description: 'Ano do leilão (ex.: 2026)' },
        ativo: { type: 'string', enum: ['S', 'N'], description: '"S" só ativos, "N" só inativos. Omitir para todos.' },
        quando: { type: 'string', enum: ['futuros', 'passados'], description: '"futuros" = a partir de hoje (próximos leilões, do mais próximo); "passados" = até hoje' },
      },
    },
  },
  {
    name: 'resumo_leilao',
    description: 'Resumo de um leilão: lotes cadastrados, lotes vendidos, animais, valor total, comissões, média por animal e número de compradores.',
    input_schema: {
      type: 'object' as const,
      properties: { idLeilao: { type: 'number', description: 'ID do leilão' } },
      required: ['idLeilao'],
    },
  },
  {
    name: 'buscar_lotes',
    description: 'Procura lotes pelo nome do animal ou descrição (ex.: "DAKOTA DE QUARACI – TE"), RP ou registro/SBB, em todos os leilões ou num período. Responde quantos lotes têm esse nome, quantos foram vendidos (com animais e valor) e lista cada um com leilão, data, comprador e valor. Use para "quantos lotes de X foram vendidos", "onde foi vendido o animal X", "por quanto saiu X". O resultado vem agrupado em porAno → leiloes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        texto:    { type: 'string', description: 'Nome do animal ou parte da descrição do lote' },
        registro: { type: 'string', description: 'RP, tatuagem ou SBB/registro (exato ou parte)' },
        idLeilao: { type: 'number', description: 'Só neste leilão (opcional)' },
        ...periodo,
      },
    },
  },
  {
    name: 'historico_cliente',
    description: 'Compras e vendas de um cliente (ID de buscar_clientes): em quais leilões comprou e vendeu, com lotes e valores por leilão, totais gerais e as compras mais recentes lote a lote. Use para "o cliente X comprou em quais leilões?", "quanto o cliente X já comprou?".',
    input_schema: {
      type: 'object' as const,
      properties: { idCliente: { type: 'number', description: 'ID do cliente' } },
      required: ['idCliente'],
    },
  },
  {
    name: 'detalhe_lote',
    description: 'Ficha de um lote: descrição, categoria, sexo, nascimento, pelagem, filiação, RP/registro, vendedor, lance máximo, se está publicado no site, e a venda (comprador, valor) quando houve. Informe o leilão e o número do lote, ou o nome do animal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        idLeilao: { type: 'number', description: 'ID do leilão' },
        lote:     { type: 'string', description: 'Número do lote (ex.: "12", "04a")' },
        texto:    { type: 'string', description: 'Nome do animal, se não souber o número' },
      },
    },
  },
  {
    name: 'lances_do_lote',
    description: 'Lances de um lote (site/app): todos os lances com valor, cliente, data e origem, o maior lance e o lance máximo cadastrado. Informe o leilão e o número do lote, ou o nome do animal. Use para "o lote tal tem lance?".',
    input_schema: {
      type: 'object' as const,
      properties: {
        idLeilao: { type: 'number', description: 'ID do leilão' },
        lote:     { type: 'string', description: 'Número do lote' },
        texto:    { type: 'string', description: 'Nome do animal, se não souber o número' },
      },
    },
  },
  {
    name: 'parcelas_do_cliente',
    description: 'Parcelas de um cliente comprador (ID de buscar_clientes): total vencido e a vencer, as vencidas e as próximas, com leilão e lote. As datas são de vencimento (o sistema de leilões não marca parcela paga).',
    input_schema: {
      type: 'object' as const,
      properties: { idCliente: { type: 'number', description: 'ID do cliente' } },
      required: ['idCliente'],
    },
  },
  {
    name: 'vendas_do_leilao',
    description: 'Vendas de um leilão, lote a lote: descrição, categoria, comprador, vendedor, quantidade, valor e média. Ordena por valor (maiores vendas) ou por número do lote.',
    input_schema: {
      type: 'object' as const,
      properties: {
        idLeilao: { type: 'number', description: 'ID do leilão' },
        ordem:    { type: 'string', enum: ['valor', 'lote'], description: 'Padrão: valor' },
        limite:   { type: 'number', description: 'Máximo de linhas (padrão 60)' },
      },
      required: ['idLeilao'],
    },
  },
  {
    name: 'lotes_do_leilao',
    description: 'Lotes cadastrados num leilão com a situação (vendido ou não), categoria, vendedor e valor de venda. Use para "quais lotes não foram vendidos".',
    input_schema: {
      type: 'object' as const,
      properties: {
        idLeilao: { type: 'number', description: 'ID do leilão' },
        situacao: { type: 'string', enum: ['todos', 'vendidos', 'nao_vendidos'], description: 'Padrão: todos' },
      },
      required: ['idLeilao'],
    },
  },
  {
    name: 'medias_por_categoria',
    description: 'Médias de venda por categoria (raça/categoria do lote) num período ou num leilão: animais, valor total, média por animal e média por kg. Use para perguntas de média de preço por categoria.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ...periodo,
        idLeilao: { type: 'number', description: 'Só deste leilão (opcional; sem período usa o ano do leilão)' },
        categoria: { type: 'string', description: 'Filtrar categorias que contenham este texto (ex.: "BRAFORD", "FÊMEA")' },
      },
    },
  },
  {
    name: 'ranking_clientes',
    description: 'Maiores compradores ou vendedores por valor, num período ou leilão.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tipo:     { type: 'string', enum: ['compradores', 'vendedores'] },
        ...periodo,
        idLeilao: { type: 'number', description: 'Só deste leilão (opcional)' },
        limite:   { type: 'number', description: 'Quantos (padrão 10)' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'vendas_por_mes',
    description: 'Vendas mês a mês num período: leilões, animais, valor total e média por animal.',
    input_schema: {
      type: 'object' as const,
      properties: { ...periodo },
    },
  },
  {
    name: 'acerto_vendedor',
    description: 'Acerto do vendedor (ID de buscar_clientes), de um leilão ou de todos: entradas recebidas, promissórias, comissão, despesas, créditos, repasses já feitos e saldo a repassar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        idVendedor: { type: 'number', description: 'ID do vendedor' },
        idLeilao:   { type: 'number', description: 'ID do leilão (opcional)' },
      },
      required: ['idVendedor'],
    },
  },
  {
    name: 'despesas_do_leilao',
    description: 'Despesas e créditos lançados num leilão (comissões, frete, catálogo, repasses...): totais por tipo e os maiores lançamentos.',
    input_schema: {
      type: 'object' as const,
      properties: { idLeilao: { type: 'number', description: 'ID do leilão' } },
      required: ['idLeilao'],
    },
  },
  {
    name: 'lances_do_leilao',
    description: 'Lances recebidos (site/app) num leilão: maior lance por lote, quem deu e quantos lances.',
    input_schema: {
      type: 'object' as const,
      properties: { idLeilao: { type: 'number', description: 'ID do leilão' } },
      required: ['idLeilao'],
    },
  },
  {
    name: 'parcelas_pendentes',
    description: 'Parcelas a vencer nos próximos dias ou já vencidas. Útil para cobrança.',
    input_schema: {
      type: 'object' as const,
      properties: {
        idLeilao:       { type: 'number',  description: 'Filtrar por leilão (opcional)' },
        diasVencer:     { type: 'number',  description: 'Parcelas a vencer nos próximos N dias (padrão: 30)' },
        apenasVencidas: { type: 'boolean', description: 'Se true, só as já vencidas' },
      },
    },
  },
  {
    name: 'totais_financeiros',
    description: 'Totais de vendas: valor total, comissões, descontos, valor líquido e animais. Pode filtrar por leilão ou período.',
    input_schema: {
      type: 'object' as const,
      properties: {
        idLeilao: { type: 'number', description: 'ID do leilão (opcional)' },
        ...periodo,
      },
    },
  },
  {
    name: 'cadastros_pendentes',
    description: 'Cadastros de clientes aguardando liberação: em análise ou bloqueados recentes (site/app). Quantidade e os mais recentes.',
    input_schema: {
      type: 'object' as const,
      properties: { grupo: { type: 'string', enum: ['analise', 'bloqueados'], description: 'Padrão: analise' } },
    },
  },
];

// ─── Implementação das queries de cada tool ───────────────────────────────────

const r2 = (v: any) => Math.round((Number(v) || 0) * 100) / 100;
const dataValida = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
/** Período padrão: últimos 12 meses. */
function periodoDe(input: any): { de: string; ate: string } {
  const hoje = new Date();
  const ate = dataValida(input.ate) || hoje.toISOString().slice(0, 10);
  const de = dataValida(input.de) || new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate()).toISOString().slice(0, 10);
  return { de, ate };
}
/**
 * "DAKOTA DE QUARACI – TE" → "%DAKOTA%QUARACI%": a pontuação (travessão, hífen, barra), os
 * espaços e as palavras curtas variam no cadastro; as palavras principais, na ordem, não.
 */
const padraoBusca = (texto: string) => {
  const todas = String(texto).toUpperCase().split(/[\s\-–—_/.,:;()]+/).filter(Boolean);
  // "DE", "DA", "TE"... variam no cadastro ("DAKOTA QUARACI", "COB.DAKOTA DE QUARACI - TE"):
  // procura pelas palavras com 3 letras ou mais (se sobrar alguma)
  const fortes = todas.filter(p => p.length > 2);
  const palavras = fortes.length ? fortes : todas;
  return palavras.length ? `%${palavras.join('%')}%` : null;
};
/** Condições de período/leilão sobre a VWVendas (alias V) e LEILOES (alias L). */
function filtroVendas(req: sql.Request, input: any, comPeriodo = true): string[] {
  const c = ['V.ID > 0', 'V.VALORPAGAR >= 0', "V.DEFESA = 'S'"];
  if (input.idLeilao) { req.input('idLeilao', sql.Int, input.idLeilao); c.push('V.IDLEILAO = @idLeilao'); }
  else if (comPeriodo) {
    const p = periodoDe(input);
    req.input('de', sql.Date, p.de).input('ate', sql.Date, p.ate);
    c.push('L.DATLEI >= @de', 'L.DATLEI < DATEADD(DAY, 1, @ate)');
  }
  return c;
}

/** Executa uma ferramenta do assistente (exportada para teste). */
export async function executarTool(name: string, input: any): Promise<any> {
  const pool = await getPool();

  if (name === 'buscar_clientes') {
    const req = pool.request();
    const filtros: string[] = ['1=1'];
    if (input.nome) {
      req.input('nome', sql.VarChar, padraoBusca(input.nome) || `%${input.nome}%`);
      filtros.push('NOMEXX LIKE @nome');
    }
    if (input.cpf) {
      req.input('cpf', sql.VarChar, `%${String(input.cpf).replace(/\D/g, '')}%`);
      filtros.push(`(REPLACE(REPLACE(REPLACE(ISNULL(CPFXXX,''),'.',''),'-',''),'/','') LIKE @cpf OR REPLACE(REPLACE(REPLACE(ISNULL(CNPJXX,''),'.',''),'-',''),'/','') LIKE @cpf)`);
    }
    if (filtros.length === 1) return { erro: 'Informe o nome ou o CPF/CNPJ' };
    const r = await req.query(`
      SELECT TOP 20 C.ID, C.NOMEXX, C.CPFXXX, C.CNPJXX, C.EMAILX, C.CELU_1, C.TELRES,
        CI.CIDADE, CI.ESTADO, FORMAT(C.DATCAD,'dd/MM/yyyy') AS CADASTRO,
        CASE WHEN ISNULL(C.ATIVOX,'S') = 'N' THEN 'inativo' ELSE 'ativo' END AS SITUACAO,
        CASE WHEN C.BLOCLI IN ('Sim', 'S') THEN 'sim' ELSE 'não' END AS BLOQUEADO, C.ACESSO_APP
      FROM CLIENTES C LEFT JOIN CIDADES CI ON CI.ID = C.CIDADE
      WHERE ${filtros.map(f => f.replace(/\bNOMEXX\b/g, 'C.NOMEXX').replace(/\bCPFXXX\b/g, 'C.CPFXXX').replace(/\bCNPJXX\b/g, 'C.CNPJXX')).join(' AND ')}
      ORDER BY C.NOMEXX`);
    return { encontrados: r.recordset.length, clientes: r.recordset };
  }

  if (name === 'listar_leiloes') {
    const req = pool.request();
    const c: string[] = ['1=1'];
    if (input.ativo) { req.input('ativo', sql.VarChar, input.ativo); c.push('L.ATIVOX = @ativo'); }
    if (input.busca) { req.input('busca', sql.VarChar, padraoBusca(input.busca)); c.push('L.LEILAO LIKE @busca'); }
    if (input.ano) {
      req.input('anoIni', sql.Date, `${input.ano}-01-01`).input('anoFim', sql.Date, `${Number(input.ano) + 1}-01-01`);
      c.push('L.DATLEI >= @anoIni AND L.DATLEI < @anoFim');
    }
    if (input.quando === 'futuros') c.push('L.DATLEI >= CAST(GETDATE() AS DATE)');
    if (input.quando === 'passados') c.push('L.DATLEI <= CAST(GETDATE() AS DATE)');
    const r = await req.query(`
      SELECT TOP 40 L.ID, L.LEILAO, FORMAT(L.DATLEI,'dd/MM/yyyy') AS DATA, L.ATIVOX,
        CID.CIDADE AS CIDADE, CID.ESTADO AS ESTADO,
        (SELECT COUNT(*) FROM LOTES LO WHERE LO.IDLEILAO = L.ID) AS LOTES
      FROM LEILOES L LEFT JOIN CIDADES CID ON CID.ID = TRY_CAST(L.CODCID AS INT)
      WHERE ${c.join(' AND ')} ORDER BY L.DATLEI ${input.quando === 'futuros' ? 'ASC' : 'DESC'}`);
    return r.recordset;
  }

  if (name === 'resumo_leilao') {
    const id = input.idLeilao;
    const [rLeilao, rLotes, rVendas] = await Promise.all([
      pool.request().input('id', sql.Int, id).query(`SELECT ID, LEILAO, FORMAT(DATLEI,'dd/MM/yyyy') AS DATA, ATIVOX, COMCOM, COMVEN FROM LEILOES WHERE ID = @id`),
      pool.request().input('id', sql.Int, id).query(`SELECT COUNT(*) AS lotesCadastrados FROM LOTES WHERE IDLEILAO = @id AND RASCUNHO_EM IS NULL`)
        .catch(() => pool.request().input('id', sql.Int, id).query(`SELECT COUNT(*) AS lotesCadastrados FROM LOTES WHERE IDLEILAO = @id`)),
      pool.request().input('id', sql.Int, id).query(`
        SELECT COUNT(DISTINCT V.IDLOTE) AS lotesVendidos, COUNT(DISTINCT V.IDCLI) AS compradores,
          SUM(V.QTDXXX * V.PERCEN / 100.0) AS animais, SUM(V.VALORORIGINAL) AS valorTotal,
          SUM(V.VALORCOMISSAO) AS comissaoComprador, SUM(V.VALORCOMISSAOVENDEDOR) AS comissaoVendedor,
          SUM(V.VALORPAGAR) AS valorLiquido
        FROM VWVendas V WHERE V.IDLEILAO = @id AND V.ID > 0 AND V.VALORPAGAR >= 0 AND V.DEFESA = 'S'`),
    ]);
    const v = rVendas.recordset[0] || {};
    return {
      leilao: rLeilao.recordset[0] ?? null,
      lotesCadastrados: rLotes.recordset[0]?.lotesCadastrados ?? 0,
      lotesVendidos: v.lotesVendidos ?? 0, compradores: v.compradores ?? 0, animais: r2(v.animais),
      valorTotal: r2(v.valorTotal), comissaoComprador: r2(v.comissaoComprador), comissaoVendedor: r2(v.comissaoVendedor),
      valorLiquido: r2(v.valorLiquido), mediaPorAnimal: v.animais ? r2(v.valorTotal / v.animais) : 0,
    };
  }

  if (name === 'buscar_lotes') {
    const req = pool.request();
    const c: string[] = [];
    if (input.texto) { req.input('texto', sql.VarChar, padraoBusca(input.texto)); c.push('LO.DESLOT LIKE @texto'); }
    if (input.registro) {
      req.input('reg', sql.VarChar, `%${String(input.registro).trim()}%`);
      c.push('(LO.RPXXX LIKE @reg OR LO.SBBXXX LIKE @reg OR LO.TATXXX LIKE @reg)');
    }
    if (!c.length) return { erro: 'Informe o nome/descrição ou o registro do lote' };
    if (input.idLeilao) { req.input('idLeilao', sql.Int, input.idLeilao); c.push('LO.IDLEILAO = @idLeilao'); }
    if (dataValida(input.de)) { req.input('de', sql.Date, input.de); c.push('L.DATLEI >= @de'); }
    if (dataValida(input.ate)) { req.input('ate', sql.Date, input.ate); c.push('L.DATLEI < DATEADD(DAY, 1, @ate)'); }
    const r = await req.query(`
      SELECT TOP 200 LO.ID, LO.LOTEXX, LO.DESLOT, LO.RPXXX, LO.SBBXXX, L.LEILAO, L.DATLEI,
        FORMAT(L.DATLEI,'dd/MM/yyyy') AS DATA,
        V.QTD, V.VALOR, V.COMPRADORES
      FROM LOTES LO
      LEFT JOIN LEILOES L ON L.ID = LO.IDLEILAO
      OUTER APPLY (
        SELECT SUM(VV.QTDXXX * VV.PERCEN / 100.0) AS QTD, SUM(VV.VALORORIGINAL) AS VALOR,
          STRING_AGG(CAST(C.NOMEXX AS VARCHAR(MAX)), '; ') AS COMPRADORES
        FROM VWVendas VV LEFT JOIN CLIENTES C ON C.ID = TRY_CAST(VV.IDCLI AS INT)
        WHERE VV.IDLOTE = LO.ID AND VV.ID > 0 AND VV.VALORPAGAR >= 0 AND VV.DEFESA = 'S'
      ) V
      WHERE ${c.join(' AND ')}
      ORDER BY L.DATLEI DESC, TRY_CAST(LO.LOTEXX AS INT)`);
    const lotes = r.recordset.map((x: any) => ({
      lote: x.LOTEXX, descricao: x.DESLOT?.trim(), rp: x.RPXXX?.trim() || undefined, registro: x.SBBXXX?.trim() || undefined,
      leilao: x.LEILAO?.trim(), data: x.DATA, vendido: x.VALOR != null,
      animais: x.VALOR != null ? r2(x.QTD) : undefined, valor: x.VALOR != null ? r2(x.VALOR) : undefined,
      comprador: x.COMPRADORES || undefined,
    }));
    const vendidos = lotes.filter((l: any) => l.vendido);
    // por ano e, dentro dele, por leilão: é assim que a resposta deve ser apresentada
    const anos = new Map<string, { ano: string; lotes: number; vendidos: number; valor: number; leiloes: Map<string, any> }>();
    for (const l of lotes as any[]) {
      const ano = l.data ? l.data.slice(6, 10) : 'sem data';
      const a = anos.get(ano) || { ano, lotes: 0, vendidos: 0, valor: 0, leiloes: new Map() };
      a.lotes++; if (l.vendido) { a.vendidos++; a.valor += l.valor || 0; }
      const k = `${l.data}|${l.leilao}`;
      const le = a.leiloes.get(k) || { leilao: l.leilao, data: l.data, lotes: 0, vendidos: 0, valor: 0, compradores: [] as string[] };
      le.lotes++; if (l.vendido) { le.vendidos++; le.valor += l.valor || 0; if (l.comprador) le.compradores.push(l.comprador); }
      a.leiloes.set(k, le);
      anos.set(ano, a);
    }
    const porAno = Array.from(anos.values()).sort((x, y) => y.ano.localeCompare(x.ano)).map(a => ({
      ano: a.ano, lotesOfertados: a.lotes, lotesVendidos: a.vendidos, valorVendido: r2(a.valor),
      leiloes: Array.from(a.leiloes.values()).map((le: any) => ({ ...le, valor: r2(le.valor), compradores: le.compradores.length ? le.compradores : undefined })),
    }));
    return {
      lotesEncontrados: lotes.length, lotesVendidos: vendidos.length, lotesNaoVendidos: lotes.length - vendidos.length,
      animaisVendidos: r2(vendidos.reduce((a: number, l: any) => a + (l.animais || 0), 0)),
      valorTotalVendido: r2(vendidos.reduce((a: number, l: any) => a + (l.valor || 0), 0)),
      limiteAtingido: lotes.length === 200,
      porAno,
      lotes,
    };
  }

  if (name === 'historico_cliente') {
    const [cli, compras, vendas] = await Promise.all([
      pool.request().input('id', sql.Int, input.idCliente).query(`SELECT NOMEXX, CPFXXX, CNPJXX FROM CLIENTES WHERE ID = @id`),
      pool.request().input('id', sql.VarChar, String(input.idCliente)).query(`
        SELECT L.ID AS IDLEILAO, L.LEILAO, L.DATLEI, FORMAT(L.DATLEI,'dd/MM/yyyy') AS DATA, LO.LOTEXX, LO.DESLOT, VEN.NOMEXX AS VENDEDOR,
          V.QTDXXX * V.PERCEN / 100.0 AS ANIMAIS, V.VALORORIGINAL AS VALOR
        FROM VWVendas V JOIN LEILOES L ON L.ID = V.IDLEILAO LEFT JOIN LOTES LO ON LO.ID = V.IDLOTE
        LEFT JOIN CLIENTES VEN ON VEN.ID = LO.CODVEN
        WHERE V.IDCLI = @id AND V.ID > 0 AND V.VALORPAGAR >= 0 AND V.DEFESA = 'S'
        ORDER BY L.DATLEI DESC, TRY_CAST(LO.LOTEXX AS INT)`),
      pool.request().input('id', sql.Int, input.idCliente).query(`
        SELECT L.ID AS IDLEILAO, L.LEILAO, L.DATLEI, FORMAT(L.DATLEI,'dd/MM/yyyy') AS DATA, LO.LOTEXX, LO.DESLOT,
          SUM(V.QTDXXX * V.PERCEN / 100.0) AS ANIMAIS, SUM(V.VALORORIGINAL) AS VALOR
        FROM VWVendas V JOIN LOTES LO ON LO.ID = V.IDLOTE JOIN LEILOES L ON L.ID = V.IDLEILAO
        WHERE LO.CODVEN = @id AND V.ID > 0 AND V.VALORPAGAR >= 0 AND V.DEFESA = 'S'
        GROUP BY L.ID, L.LEILAO, L.DATLEI, LO.LOTEXX, LO.DESLOT
        ORDER BY L.DATLEI DESC`),
    ]);
    // por leilão, do mais recente: é a forma de responder "comprou em quais leilões, com que valores"
    const porLeilao = (linhas: any[]) => {
      const m = new Map<number, any>();
      for (const x of linhas) {
        const g = m.get(x.IDLEILAO) || { leilao: x.LEILAO?.trim(), data: x.DATA, lotes: 0, animais: 0, valor: 0, itens: [] as any[] };
        g.lotes++; g.animais += Number(x.ANIMAIS) || 0; g.valor += Number(x.VALOR) || 0;
        if (g.itens.length < 15) g.itens.push({ lote: x.LOTEXX, descricao: x.DESLOT?.trim(), animais: r2(x.ANIMAIS), valor: r2(x.VALOR), vendedor: x.VENDEDOR || undefined });
        m.set(x.IDLEILAO, g);
      }
      return Array.from(m.values()).slice(0, 40).map(g => ({ ...g, animais: r2(g.animais), valor: r2(g.valor) }));
    };
    const total = (linhas: any[]) => ({
      leiloes: new Set(linhas.map(x => x.IDLEILAO)).size, lotes: linhas.length,
      animais: r2(linhas.reduce((a, x) => a + (Number(x.ANIMAIS) || 0), 0)), valor: r2(linhas.reduce((a, x) => a + (Number(x.VALOR) || 0), 0)),
    });
    return {
      cliente: cli.recordset[0] ? { nome: cli.recordset[0].NOMEXX?.trim(), cpf: cli.recordset[0].CPFXXX || undefined, cnpj: cli.recordset[0].CNPJXX || undefined } : null,
      comoComprador: { totais: total(compras.recordset), porLeilao: porLeilao(compras.recordset) },
      comoVendedor: { totais: total(vendas.recordset), porLeilao: porLeilao(vendas.recordset) },
    };
  }

  if (name === 'detalhe_lote' || name === 'lances_do_lote') {
    const req = pool.request();
    const c: string[] = [];
    if (input.idLeilao) { req.input('idLeilao', sql.Int, input.idLeilao); c.push('LO.IDLEILAO = @idLeilao'); }
    if (input.lote) { req.input('lote', sql.VarChar, String(input.lote).trim().replace(/^0+(?=\d)/, '')); c.push("(LTRIM(RTRIM(LO.LOTEXX)) = @lote OR LTRIM(RTRIM(LO.LOTEXX)) = '0' + @lote)"); }
    if (input.texto) { req.input('texto', sql.VarChar, padraoBusca(input.texto)); c.push('LO.DESLOT LIKE @texto'); }
    if (!input.lote && !input.texto) return { erro: 'Informe o número do lote (com o leilão) ou o nome do animal' };
    const lotes = (await req.query(`
      SELECT TOP 10 LO.ID, LO.LOTEXX, LO.DESLOT, LO.RPXXX, LO.SBBXXX, LO.CATEGO, LO.PELAGE, FORMAT(LO.DATNAS,'dd/MM/yyyy') AS NASCIMENTO,
        LO.FILIACAO, LO.PESOXX, LO.LANMAX, LO.PUBLICA, LO.QTDANIMAIS, LO.OBSLOT, R.DESCRICAO AS CATEGORIA, R.ESPECIES,
        VEN.NOMEXX AS VENDEDOR, L.LEILAO, FORMAT(L.DATLEI,'dd/MM/yyyy') AS DATA
      FROM LOTES LO LEFT JOIN RACAS R ON R.ID = LO.RACAXX LEFT JOIN CLIENTES VEN ON VEN.ID = LO.CODVEN
      LEFT JOIN LEILOES L ON L.ID = LO.IDLEILAO
      WHERE ${c.join(' AND ')} ORDER BY L.DATLEI DESC`)).recordset;
    if (!lotes.length) return { encontrados: 0, aviso: 'Nenhum lote encontrado com esses dados' };
    const ids = lotes.map((l: any) => Number(l.ID));
    const lista = ids.join(',');
    if (name === 'lances_do_lote') {
      const lances = (await pool.request().query(`
        SELECT LL.IDLOTE, LL.VALOR, FORMAT(LL.DATA,'dd/MM/yyyy HH:mm') AS DATA, LL.OrigemLance AS ORIGEM, C.NOMEXX AS CLIENTE
        FROM Lotes_Lances LL LEFT JOIN CLIENTES C ON C.ID = LL.IDCLIENTE
        WHERE LL.IDLOTE IN (${lista}) ORDER BY LL.VALOR DESC, LL.DATA`)).recordset;
      return {
        encontrados: lotes.length,
        lotes: lotes.map((l: any) => {
          const ls = lances.filter((x: any) => x.IDLOTE === l.ID);
          return {
            leilao: l.LEILAO?.trim(), data: l.DATA, lote: l.LOTEXX, descricao: l.DESLOT?.trim(), lanceMaximoCadastrado: l.LANMAX ?? undefined,
            temLance: ls.length > 0, quantidadeLances: ls.length, maiorLance: ls[0] ? { valor: r2(ls[0].VALOR), cliente: ls[0].CLIENTE, data: ls[0].DATA } : undefined,
            lances: ls.slice(0, 30).map((x: any) => ({ valor: r2(x.VALOR), cliente: x.CLIENTE, data: x.DATA, origem: x.ORIGEM || undefined })),
          };
        }),
      };
    }
    const vendas = (await pool.request().query(`
      SELECT V.IDLOTE, C.NOMEXX AS COMPRADOR, V.QTDXXX * V.PERCEN / 100.0 AS ANIMAIS, V.VALORORIGINAL AS VALOR, V.DEFESA
      FROM VWVendas V LEFT JOIN CLIENTES C ON C.ID = TRY_CAST(V.IDCLI AS INT)
      WHERE V.IDLOTE IN (${lista}) AND V.ID > 0 AND V.VALORPAGAR >= 0`)).recordset;
    const sexo: Record<string, string> = { M: 'macho', F: 'fêmea', C: 'castrado', S: 'cobertura' };
    return {
      encontrados: lotes.length,
      lotes: lotes.map((l: any) => {
        const vs = vendas.filter((v: any) => v.IDLOTE === l.ID);
        const vendidas = vs.filter((v: any) => v.DEFESA === 'S');
        return {
          leilao: l.LEILAO?.trim(), data: l.DATA, lote: l.LOTEXX, descricao: l.DESLOT?.trim(),
          categoria: [l.CATEGORIA, l.ESPECIES].filter(Boolean).join(' / ') || undefined, sexo: sexo[l.CATEGO] || l.CATEGO || undefined,
          nascimento: l.NASCIMENTO || undefined, pelagem: l.PELAGE?.trim() || undefined, filiacao: l.FILIACAO?.trim() || undefined,
          rp: l.RPXXX?.trim() || undefined, registro: l.SBBXXX?.trim() || undefined, peso: l.PESOXX || undefined,
          quantidadeAnimais: l.QTDANIMAIS || undefined, observacao: l.OBSLOT?.trim() || undefined,
          vendedor: l.VENDEDOR || undefined, lanceMaximo: l.LANMAX ?? undefined, publicadoNoSite: l.PUBLICA === 'S',
          venda: vendidas.length
            ? vendidas.map((v: any) => ({ comprador: v.COMPRADOR, animais: r2(v.ANIMAIS), valor: r2(v.VALOR) }))
            : vs.length ? 'não vendido (defesa)' : 'sem venda lançada',
        };
      }),
    };
  }

  if (name === 'parcelas_do_cliente') {
    const r = await pool.request().input('id', sql.Int, input.idCliente).query(`
      SELECT FORMAT(MP.DATVEN,'dd/MM/yyyy') AS VENCIMENTO, MP.DATVEN, MP.VLRPAR AS VALOR, MP.ORDXXX AS PARCELA,
        L.LEILAO, MP.LOTEXX AS LOTE, CASE WHEN MP.DATVEN < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END AS VENCIDA
      FROM MOVIMENTO_PARCELAMENTO MP JOIN MOVIMENTO M ON M.ID = MP.IDMOV JOIN LEILOES L ON L.ID = M.IDLEILAO
      WHERE MP.IDCLI = @id
      ORDER BY MP.DATVEN`);
    const ps = r.recordset;
    const vencidas = ps.filter((x: any) => x.VENCIDA), aVencer = ps.filter((x: any) => !x.VENCIDA);
    const soma = (l: any[]) => r2(l.reduce((a, x) => a + (Number(x.VALOR) || 0), 0));
    const limpar = (x: any) => ({ vencimento: x.VENCIMENTO, valor: r2(x.VALOR), parcela: x.PARCELA, leilao: x.LEILAO?.trim(), lote: x.LOTE });
    return {
      aviso: 'Datas de vencimento; o sistema de leilões não registra se a parcela foi paga.',
      totalParcelas: ps.length, vencidas: { quantidade: vencidas.length, total: soma(vencidas), ultimas: vencidas.slice(-10).map(limpar) },
      aVencer: { quantidade: aVencer.length, total: soma(aVencer), proximas: aVencer.slice(0, 12).map(limpar) },
    };
  }

  if (name === 'vendas_do_leilao') {
    const req = pool.request().input('idLeilao', sql.Int, input.idLeilao);
    const limite = Math.min(Math.max(Number(input.limite) || 60, 1), 200);
    const r = await req.query(`
      SELECT TOP ${limite} LO.LOTEXX, LO.DESLOT, R.DESCRICAO AS CATEGORIA, COM.NOMEXX AS COMPRADOR, VEN.NOMEXX AS VENDEDOR,
        V.QTDXXX * V.PERCEN / 100.0 AS ANIMAIS, V.VALORORIGINAL AS VALOR,
        CASE WHEN V.QTDXXX > 0 THEN V.VALORORIGINAL / (V.QTDXXX * V.PERCEN / 100.0) ELSE V.VALORORIGINAL END AS MEDIA
      FROM VWVendas V
      LEFT JOIN LOTES LO ON LO.ID = V.IDLOTE LEFT JOIN RACAS R ON R.ID = LO.RACAXX
      LEFT JOIN CLIENTES COM ON COM.ID = TRY_CAST(V.IDCLI AS INT) LEFT JOIN CLIENTES VEN ON VEN.ID = LO.CODVEN
      WHERE V.IDLEILAO = @idLeilao AND V.ID > 0 AND V.VALORPAGAR >= 0 AND V.DEFESA = 'S'
      ORDER BY ${input.ordem === 'lote' ? 'TRY_CAST(LO.LOTEXX AS INT), LO.LOTEXX' : 'V.VALORORIGINAL DESC'}`);
    return r.recordset.map((x: any) => ({ ...x, ANIMAIS: r2(x.ANIMAIS), VALOR: r2(x.VALOR), MEDIA: r2(x.MEDIA) }));
  }

  if (name === 'lotes_do_leilao') {
    const r = await pool.request().input('idLeilao', sql.Int, input.idLeilao).query(`
      SELECT LO.LOTEXX, LO.DESLOT, R.DESCRICAO AS CATEGORIA, VEN.NOMEXX AS VENDEDOR,
        (SELECT SUM(V.VALORORIGINAL) FROM VWVendas V WHERE V.IDLOTE = LO.ID AND V.ID > 0 AND V.VALORPAGAR >= 0 AND V.DEFESA = 'S') AS VALOR_VENDA
      FROM LOTES LO LEFT JOIN RACAS R ON R.ID = LO.RACAXX LEFT JOIN CLIENTES VEN ON VEN.ID = LO.CODVEN
      WHERE LO.IDLEILAO = @idLeilao
      ORDER BY TRY_CAST(LO.LOTEXX AS INT), LO.LOTEXX`);
    let lotes = r.recordset.map((x: any) => ({ ...x, VENDIDO: x.VALOR_VENDA != null, VALOR_VENDA: x.VALOR_VENDA != null ? r2(x.VALOR_VENDA) : undefined }));
    const total = lotes.length, vendidos = lotes.filter((l: any) => l.VENDIDO).length;
    if (input.situacao === 'vendidos') lotes = lotes.filter((l: any) => l.VENDIDO);
    if (input.situacao === 'nao_vendidos') lotes = lotes.filter((l: any) => !l.VENDIDO);
    return { lotesCadastrados: total, vendidos, naoVendidos: total - vendidos, lotes: lotes.slice(0, 150) };
  }

  if (name === 'medias_por_categoria') {
    let de = dataValida(input.de), ate = dataValida(input.ate);
    if (input.idLeilao && (!de || !ate)) {
      const l = (await pool.request().input('id', sql.Int, input.idLeilao).query(`SELECT DATLEI FROM LEILOES WHERE ID = @id`)).recordset[0];
      if (!l?.DATLEI) return { erro: 'Leilão não encontrado' };
      const d = new Date(l.DATLEI).toISOString().slice(0, 10);
      de = d; ate = d;
    }
    const p = periodoDe({ de, ate });
    let linhas = await mediasPorCategoria({ de: p.de, ate: p.ate, defesa: 'S' });
    if (input.idLeilao) linhas = linhas.filter(l => l.idLeilao === Number(input.idLeilao));
    if (input.categoria) { const t = String(input.categoria).toUpperCase(); linhas = linhas.filter(l => l.categoria.toUpperCase().includes(t)); }
    const porCat = new Map<string, { categoria: string; leiloes: number; animais: number; valor: number; pesoKg: number; valorComPeso: number }>();
    for (const l of linhas) {
      const c = porCat.get(l.categoria) || { categoria: l.categoria, leiloes: 0, animais: 0, valor: 0, pesoKg: 0, valorComPeso: 0 };
      c.leiloes++; c.animais += l.qtd; c.valor += l.valor; c.pesoKg += l.pesoKg; c.valorComPeso += l.valorComPeso;
      porCat.set(l.categoria, c);
    }
    const cats = Array.from(porCat.values()).sort((a, b) => b.valor - a.valor).map(c => ({
      categoria: c.categoria, leiloes: c.leiloes, animais: r2(c.animais), valorTotal: r2(c.valor),
      mediaPorAnimal: c.animais ? r2(c.valor / c.animais) : 0, mediaPorKg: c.pesoKg ? r2(c.valorComPeso / c.pesoKg) : undefined,
    }));
    const animais = cats.reduce((a, c) => a + c.animais, 0), valor = cats.reduce((a, c) => a + c.valorTotal, 0);
    return { periodo: p, categorias: cats.slice(0, 60), totalAnimais: r2(animais), valorTotal: r2(valor), mediaGeral: animais ? r2(valor / animais) : 0 };
  }

  if (name === 'ranking_clientes') {
    const req = pool.request();
    const c = filtroVendas(req, input);
    const limite = Math.min(Math.max(Number(input.limite) || 10, 1), 50);
    const vendedores = input.tipo === 'vendedores';
    const r = await req.query(`
      SELECT TOP ${limite} CL.ID, CL.NOMEXX AS NOME, COUNT(*) AS VENDAS, SUM(V.QTDXXX * V.PERCEN / 100.0) AS ANIMAIS,
        SUM(V.VALORORIGINAL) AS VALOR, COUNT(DISTINCT V.IDLEILAO) AS LEILOES
      FROM VWVendas V
      LEFT JOIN LEILOES L ON L.ID = V.IDLEILAO
      ${vendedores ? 'JOIN LOTES LO ON LO.ID = V.IDLOTE JOIN CLIENTES CL ON CL.ID = LO.CODVEN' : 'JOIN CLIENTES CL ON CL.ID = TRY_CAST(V.IDCLI AS INT)'}
      WHERE ${c.join(' AND ')}
      GROUP BY CL.ID, CL.NOMEXX ORDER BY SUM(V.VALORORIGINAL) DESC`);
    return { periodo: input.idLeilao ? undefined : periodoDe(input), ranking: r.recordset.map((x: any) => ({ ...x, ANIMAIS: r2(x.ANIMAIS), VALOR: r2(x.VALOR) })) };
  }

  if (name === 'vendas_por_mes') {
    const req = pool.request();
    const c = filtroVendas(req, input);
    const r = await req.query(`
      SELECT FORMAT(L.DATLEI, 'yyyy-MM') AS MES, COUNT(DISTINCT V.IDLEILAO) AS LEILOES,
        SUM(V.QTDXXX * V.PERCEN / 100.0) AS ANIMAIS, SUM(V.VALORORIGINAL) AS VALOR
      FROM VWVendas V LEFT JOIN LEILOES L ON L.ID = V.IDLEILAO
      WHERE ${c.join(' AND ')}
      GROUP BY FORMAT(L.DATLEI, 'yyyy-MM') ORDER BY MES`);
    return { periodo: periodoDe(input), meses: r.recordset.map((x: any) => ({ ...x, ANIMAIS: r2(x.ANIMAIS), VALOR: r2(x.VALOR), MEDIA: x.ANIMAIS ? r2(x.VALOR / x.ANIMAIS) : 0 })) };
  }

  if (name === 'acerto_vendedor') {
    const a = await calcularAcertoVendedor(Number(input.idVendedor), input.idLeilao ? Number(input.idLeilao) : undefined);
    return {
      vendedor: a.vendedor, leilao: a.leilao, data: a.datlei, totais: a.totais,
      entradas: a.entradas.length, promissorias: a.promissorias.length,
      lancamentos: a.lancamentos.slice(0, 30).map((l: any) => ({
        tipo: ({ D: 'despesa', S: 'despesa', C: 'crédito', E: 'crédito', F: 'repasse/fechamento' } as Record<string, string>)[l.dc] || l.dc,
        valor: l.valor, observacao: l.observacoes,
      })),
    };
  }

  if (name === 'despesas_do_leilao') {
    const req = pool.request().input('idLeilao', sql.Int, input.idLeilao);
    const [porTipo, maiores] = await Promise.all([
      req.query(`
        SELECT CASE D.D_C WHEN 'D' THEN 'Despesa' WHEN 'S' THEN 'Despesa' WHEN 'C' THEN 'Crédito' WHEN 'E' THEN 'Crédito' WHEN 'F' THEN 'Repasse/fechamento' ELSE D.D_C END AS TIPO,
          ISNULL(D.TIPO_ORIGEM, 'MANUAL') AS ORIGEM, COUNT(*) AS QTD, SUM(D.VALOR) AS VALOR
        FROM DESPESAS D WHERE D.CODLEI = @idLeilao
        GROUP BY CASE D.D_C WHEN 'D' THEN 'Despesa' WHEN 'S' THEN 'Despesa' WHEN 'C' THEN 'Crédito' WHEN 'E' THEN 'Crédito' WHEN 'F' THEN 'Repasse/fechamento' ELSE D.D_C END, ISNULL(D.TIPO_ORIGEM, 'MANUAL')`),
      pool.request().input('idLeilao', sql.Int, input.idLeilao).query(`
        SELECT TOP 20 D.D_C AS TIPO, D.VALOR, D.OBSERVACOES, C.NOMEXX AS CLIENTE
        FROM DESPESAS D LEFT JOIN CLIENTES C ON C.ID = D.CODIGO_CLIENTE
        WHERE D.CODLEI = @idLeilao AND ISNULL(D.TIPO_ORIGEM, '') NOT IN ('COMISSAO_VENDEDOR','COMISSAO_COMPRADOR')
        ORDER BY ABS(D.VALOR) DESC`),
    ]);
    return { porTipo: porTipo.recordset.map((x: any) => ({ ...x, VALOR: r2(x.VALOR) })), maioresLancamentosManuais: maiores.recordset };
  }

  if (name === 'lances_do_leilao') {
    const r = await pool.request().input('idLeilao', sql.Int, input.idLeilao).query(`
      SELECT LO.LOTEXX, LO.DESLOT, X.LANCES, X.MAIOR, C.NOMEXX AS CLIENTE_MAIOR_LANCE
      FROM LOTES LO
      CROSS APPLY (SELECT COUNT(*) AS LANCES, MAX(LL.VALOR) AS MAIOR FROM Lotes_Lances LL WHERE LL.IDLOTE = LO.ID) X
      OUTER APPLY (SELECT TOP 1 LL.IDCLIENTE FROM Lotes_Lances LL WHERE LL.IDLOTE = LO.ID ORDER BY LL.VALOR DESC, LL.DATA) M
      LEFT JOIN CLIENTES C ON C.ID = M.IDCLIENTE
      WHERE LO.IDLEILAO = @idLeilao AND X.LANCES > 0
      ORDER BY X.MAIOR DESC`);
    return { lotesComLance: r.recordset.length, lotes: r.recordset.slice(0, 100) };
  }

  if (name === 'parcelas_pendentes') {
    const req = pool.request();
    const dias = input.diasVencer ?? 30;
    const filtros: string[] = [];
    if (input.apenasVencidas) {
      filtros.push(`MP.DATVEN < CAST(GETDATE() AS DATE)`);
    } else {
      req.input('dias', sql.Int, dias);
      filtros.push(`MP.DATVEN BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(DAY, @dias, CAST(GETDATE() AS DATE))`);
    }
    if (input.idLeilao) { req.input('idLeilao', sql.Int, input.idLeilao); filtros.push(`M.IDLEILAO = @idLeilao`); }
    const r = await req.query(`
      SELECT TOP 50 FORMAT(MP.DATVEN,'dd/MM/yyyy') AS DATVEN, MP.VLRPAR, MP.ORDXXX,
        C.NOMEXX AS nomeCliente, L.LEILAO, MP.LOTEXX
      FROM MOVIMENTO_PARCELAMENTO MP
      JOIN MOVIMENTO M ON M.ID = MP.IDMOV JOIN CLIENTES C ON C.ID = MP.IDCLI JOIN LEILOES L ON L.ID = M.IDLEILAO
      WHERE ${filtros.join(' AND ')}
      ORDER BY MP.DATVEN ${input.apenasVencidas ? 'DESC' : 'ASC'}`);
    return r.recordset;
  }

  if (name === 'totais_financeiros') {
    const req = pool.request();
    const temFiltro = input.idLeilao || dataValida(input.de) || dataValida(input.ate);
    const c = temFiltro ? filtroVendas(req, input) : ['V.ID > 0', 'V.VALORPAGAR >= 0', "V.DEFESA = 'S'"];
    const r = await req.query(`
      SELECT COUNT(DISTINCT V.IDLEILAO) AS leiloes, COUNT(*) AS vendas, SUM(V.QTDXXX * V.PERCEN / 100.0) AS animais,
        SUM(V.VALORORIGINAL) AS valorTotal, SUM(V.VALORCOMISSAO) AS comissaoComprador,
        SUM(V.VALORCOMISSAOVENDEDOR) AS comissaoVendedor, SUM(V.VALORDESCONTO) AS descontos, SUM(V.VALORPAGAR) AS valorLiquido
      FROM VWVendas V LEFT JOIN LEILOES L ON L.ID = V.IDLEILAO
      WHERE ${c.join(' AND ')}`);
    const x = r.recordset[0] || {};
    return {
      periodo: temFiltro && !input.idLeilao ? periodoDe(input) : undefined,
      leiloes: x.leiloes, vendas: x.vendas, animais: r2(x.animais), valorTotal: r2(x.valorTotal),
      comissaoComprador: r2(x.comissaoComprador), comissaoVendedor: r2(x.comissaoVendedor), descontos: r2(x.descontos),
      valorLiquido: r2(x.valorLiquido), mediaPorAnimal: x.animais ? r2(x.valorTotal / x.animais) : 0,
    };
  }

  if (name === 'cadastros_pendentes') {
    const grupo = input.grupo === 'bloqueados' ? 'bloqueados' : 'analise';
    const [contagem, lista] = await Promise.all([contarClientesPendentes(), listarClientesPendentes(grupo)]);
    return { contagem, grupo, maisRecentes: lista.slice(0, 20).map((c: any) => ({ id: c.id, nome: c.nomexx, cadastro: c.datcad, cidade: c.nomeCidade })) };
  }

  return { erro: `Tool desconhecida: ${name}` };
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um assistente integrado ao sistema de gestão de leilões de animais.
Você consulta dados reais do banco através das ferramentas disponíveis.

Contexto:
- Leilões agropecuários (bovinos, equinos, ovinos...). Entidades: leilões, lotes (animais ou grupos), clientes (compradores e vendedores), vendas, parcelas, despesas e acertos de vendedor.
- "Categoria" é a raça/categoria cadastrada no lote (ex.: "FÊMEA(S) BRAFORD / BOVINOS").
- Valores em reais (R$ X.XXX,XX). Datas em DD/MM/AAAA; nas ferramentas, períodos vão como AAAA-MM-DD.

Como trabalhar:
- Responda em português do Brasil, de forma direta. Use listas curtas quando houver vários itens.
- Formatação: só **negrito** e listas com "- " (pode recuar com dois espaços para subitens). Não use tabelas, títulos com # nem blocos de código.
- Para um leilão citado pelo nome, use listar_leiloes com "busca" para achar o ID; se houver vários com nome parecido, use o do ano citado ou o mais recente e diga qual usou.
- Para um cliente citado pelo nome ou CPF, use buscar_clientes para achar o ID (e para responder se está cadastrado). Se vierem vários com nome parecido, diga quais são e use o mais provável, ou pergunte.
- "Comprou em quais leilões": historico_cliente, respondendo por leilão (data, nome, lotes e valor) e o total.
- "Lote tal tem lance": lances_do_lote; "quem é o vendedor / qual a filiação do lote": detalhe_lote. Precisa do leilão (ache pelo nome) e do número do lote, ou do nome do animal.
- Para um animal ou lote citado pelo nome (ex.: "quantos lotes DAKOTA DE QUARACI foram vendidos"), use buscar_lotes e responda com o total e depois separado por ano: para cada ano, os lotes ofertados e vendidos e o valor, e embaixo cada leilão (data, nome, ofertados, vendidos, valor e comprador).
- "Este ano", "mês passado", "últimos 30 dias": calcule as datas a partir de hoje.
- Venda é só o que as ferramentas trazem como vendido; lote em "defesa" (o dono segurou) não é venda.
- Use só o que as ferramentas retornam; nunca invente números. Se não encontrar, diga claramente o que procurou.
- Pode chamar várias ferramentas na mesma resposta quando precisar.`;

// ─── Tipos e função principal ─────────────────────────────────────────────────

export interface MensagemChat {
  role: 'user' | 'assistant';
  content: string;
}

const MODELO = 'claude-haiku-4-5-20251001';
/** Voltas de ferramenta por pergunta: evita laço sem fim se o modelo insistir. */
const MAX_VOLTAS = 8;

export async function chat(historico: MensagemChat[], mensagem: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    ...historico.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: mensagem },
  ];
  // a data muda todo dia: fica num bloco à parte, depois do prompt fixo
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: SYSTEM_PROMPT },
    { type: 'text', text: `Hoje é ${hoje}.` },
  ];
  const pedir = () => client.messages.create({ model: MODELO, max_tokens: 2048, system, tools: TOOLS, messages });

  let response = await pedir();
  for (let volta = 0; response.stop_reason === 'tool_use' && volta < MAX_VOLTAS; volta++) {
    const toolBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
    // todas as respostas das ferramentas voltam numa mensagem só; uma que falhe vai como erro,
    // sem derrubar a conversa
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(toolBlocks.map(async tu => {
      try {
        return { type: 'tool_result' as const, tool_use_id: tu.id, content: JSON.stringify(await executarTool(tu.name, tu.input)) };
      } catch (err: any) {
        console.error(`[AI] ${tu.name}:`, err?.message ?? err);
        return { type: 'tool_result' as const, tool_use_id: tu.id, is_error: true, content: `Erro ao consultar: ${err?.message ?? 'falha'}` };
      }
    }));
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });
    response = await pedir();
  }

  const texto = response.content.filter(b => b.type === 'text').map(b => (b as Anthropic.TextBlock).text).join('\n').trim();
  return texto || 'Não consegui montar a resposta. Tente perguntar de outro jeito.';
}
