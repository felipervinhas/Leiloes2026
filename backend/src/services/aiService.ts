import Anthropic from '@anthropic-ai/sdk';
import { getPool, sql } from '../config/database';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Definição das tools disponíveis para o Claude ───────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'buscar_clientes',
    description: 'Busca clientes pelo nome ou CPF/CNPJ no sistema. Retorna até 20 resultados.',
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
    description: 'Lista os leilões cadastrados no sistema, ordenados do mais recente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ativo: {
          type: 'string',
          enum: ['S', 'N'],
          description: '"S" para apenas ativos, "N" para apenas inativos. Omitir para todos.',
        },
      },
    },
  },
  {
    name: 'resumo_leilao',
    description: 'Retorna resumo financeiro de um leilão: total de lotes, lotes vendidos, valor total, comissão.',
    input_schema: {
      type: 'object' as const,
      properties: {
        idLeilao: { type: 'number', description: 'ID do leilão' },
      },
      required: ['idLeilao'],
    },
  },
  {
    name: 'historico_cliente',
    description: 'Retorna compras e vendas de um cliente específico, com valores e leilões.',
    input_schema: {
      type: 'object' as const,
      properties: {
        idCliente: { type: 'number', description: 'ID do cliente' },
      },
      required: ['idCliente'],
    },
  },
  {
    name: 'parcelas_pendentes',
    description: 'Lista parcelas a vencer nos próximos dias ou já vencidas. Útil para cobrança.',
    input_schema: {
      type: 'object' as const,
      properties: {
        idLeilao:     { type: 'number',  description: 'Filtrar por leilão (opcional)' },
        diasVencer:   { type: 'number',  description: 'Parcelas a vencer nos próximos N dias (padrão: 30)' },
        apenasVencidas: { type: 'boolean', description: 'Se true, retorna apenas as já vencidas e não pagas' },
      },
    },
  },
  {
    name: 'totais_financeiros',
    description: 'Retorna totais consolidados de vendas: valor total, comissão, descontos, valor líquido. Pode filtrar por leilão.',
    input_schema: {
      type: 'object' as const,
      properties: {
        idLeilao: { type: 'number', description: 'ID do leilão para filtrar (opcional, omitir para geral)' },
      },
    },
  },
];

// ─── Implementação das queries de cada tool ───────────────────────────────────

async function executarTool(name: string, input: any): Promise<any> {
  const pool = await getPool();

  if (name === 'buscar_clientes') {
    const req = pool.request();
    const filtros: string[] = ['1=1'];
    if (input.nome) {
      req.input('nome', sql.VarChar, `%${input.nome}%`);
      filtros.push('NOMEXX LIKE @nome');
    }
    if (input.cpf) {
      req.input('cpf', sql.VarChar, `%${input.cpf}%`);
      filtros.push('(CPFXXX LIKE @cpf OR CNPJXX LIKE @cpf)');
    }
    const r = await req.query(`
      SELECT TOP 20 ID, NOMEXX, CPFXXX, CNPJXX, EMAILX, CELU_1, ATIVOX
      FROM CLIENTES
      WHERE ${filtros.join(' AND ')}
      ORDER BY NOMEXX
    `);
    return r.recordset;
  }

  if (name === 'listar_leiloes') {
    const req = pool.request();
    let where = '';
    if (input.ativo) {
      req.input('ativo', sql.VarChar, input.ativo);
      where = 'WHERE L.ATIVOX = @ativo';
    }
    const r = await req.query(`
      SELECT TOP 30 L.ID, L.LEILAO, L.DATLEI, L.ATIVOX,
        CID.CIDADE AS NOMECIDADE, CID.ESTADO AS NOMEESTADO
      FROM LEILOES L
      LEFT JOIN CIDADES CID ON CID.ID = TRY_CAST(L.CODCID AS INT)
      ${where}
      ORDER BY L.DATLEI DESC
    `);
    return r.recordset;
  }

  if (name === 'resumo_leilao') {
    const id = input.idLeilao;
    const [rLeilao, rLotes, rVendas] = await Promise.all([
      pool.request().input('id', sql.Int, id).query(`
        SELECT ID, LEILAO, DATLEI, ATIVOX FROM LEILOES WHERE ID = @id
      `),
      pool.request().input('id', sql.Int, id).query(`
        SELECT
          COUNT(*) AS totalLotes,
          SUM(CASE WHEN DEFESA = 'S' THEN 1 ELSE 0 END) AS lotesVendidos
        FROM LOTES WHERE IDLEI = @id
      `),
      pool.request().input('id', sql.Int, id).query(`
        SELECT
          COUNT(*) AS totalMovimentos,
          SUM(ML.VLRTOT) AS valorTotal,
          SUM(ML.QTDXXX) AS cabecasTotal
        FROM MOVIMENTO M
        JOIN MOVIMENTO_LOTE ML ON ML.IDMOV = M.ID
        WHERE M.IDLEILAO = @id AND M.DEFESA = 'S'
      `),
    ]);
    return {
      leilao:   rLeilao.recordset[0] ?? null,
      lotes:    rLotes.recordset[0]  ?? null,
      vendas:   rVendas.recordset[0] ?? null,
    };
  }

  if (name === 'historico_cliente') {
    const [compras, vendas] = await Promise.all([
      pool.request().input('id', sql.Int, input.idCliente).query(`
        SELECT TOP 30
          M.ID, L.LEILAO, LO.LOTEXX, LO.DESLOT,
          MC.VALORPAGAR, MC.PERCEN,
          FORMAT(M.DATLAN,'dd/MM/yyyy') AS DATLAN
        FROM MOVIMENTO_COMPRADOR MC
        JOIN MOVIMENTO M   ON M.ID   = MC.IDMOV
        JOIN LEILOES L     ON L.ID   = M.IDLEILAO
        JOIN MOVIMENTO_LOTE ML ON ML.IDMOV = M.ID
        JOIN LOTES LO      ON LO.ID  = ML.IDLOTE
        WHERE MC.IDCLI = @id AND M.DEFESA = 'S'
        ORDER BY M.DATLAN DESC
      `),
      pool.request().input('id', sql.Int, input.idCliente).query(`
        SELECT TOP 30
          M.ID, L.LEILAO, LO.LOTEXX, LO.DESLOT,
          ML.VLRTOT,
          FORMAT(M.DATLAN,'dd/MM/yyyy') AS DATLAN
        FROM LOTES LO
        JOIN MOVIMENTO_LOTE ML ON ML.IDLOTE = LO.ID
        JOIN MOVIMENTO M       ON M.ID      = ML.IDMOV
        JOIN LEILOES L         ON L.ID      = M.IDLEILAO
        WHERE LO.CODVEN = @id AND M.DEFESA = 'S'
        ORDER BY M.DATLAN DESC
      `),
    ]);
    return { compras: compras.recordset, vendas: vendas.recordset };
  }

  if (name === 'parcelas_pendentes') {
    const req = pool.request();
    const dias = input.diasVencer ?? 30;
    const filtros: string[] = ["MP.PRIPAR != 'P'"];

    if (input.apenasVencidas) {
      filtros.push(`MP.DATVEN < CAST(GETDATE() AS DATE)`);
    } else {
      req.input('dias', sql.Int, dias);
      filtros.push(`MP.DATVEN BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(DAY, @dias, CAST(GETDATE() AS DATE))`);
    }

    if (input.idLeilao) {
      req.input('idLeilao', sql.Int, input.idLeilao);
      filtros.push(`M.IDLEILAO = @idLeilao`);
    }

    const r = await req.query(`
      SELECT TOP 50
        FORMAT(MP.DATVEN,'dd/MM/yyyy') AS DATVEN,
        MP.VLRPAR, MP.ORDXXX, MP.PRIPAR,
        C.NOMEXX AS nomeCliente,
        L.LEILAO, MP.LOTEXX
      FROM MOVIMENTO_PARCELAMENTO MP
      JOIN MOVIMENTO M  ON M.ID   = MP.IDMOV
      JOIN CLIENTES C   ON C.ID   = MP.IDCLI
      JOIN LEILOES L    ON L.ID   = M.IDLEILAO
      WHERE ${filtros.join(' AND ')}
      ORDER BY MP.DATVEN ASC
    `);
    return r.recordset;
  }

  if (name === 'totais_financeiros') {
    const req = pool.request();
    const filtros = ["M.DEFESA = 'S'"];
    if (input.idLeilao) {
      req.input('idLeilao', sql.Int, input.idLeilao);
      filtros.push('M.IDLEILAO = @idLeilao');
    }
    const r = await req.query(`
      SELECT
        COUNT(DISTINCT M.ID)      AS totalVendas,
        SUM(MC.VALORORIGINAL)     AS valorTotal,
        SUM(MC.VALORCOMISSAO)     AS totalComissao,
        SUM(MC.VALORDESCONTO)     AS totalDesconto,
        SUM(MC.VALORPAGAR)        AS valorLiquido,
        SUM(ML.QTDXXX)            AS totalCabecas
      FROM MOVIMENTO M
      JOIN MOVIMENTO_LOTE ML      ON ML.IDMOV = M.ID
      JOIN MOVIMENTO_COMPRADOR MC ON MC.IDMOV = M.ID
      WHERE ${filtros.join(' AND ')}
    `);
    return r.recordset[0] ?? null;
  }

  return { erro: `Tool desconhecida: ${name}` };
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um assistente inteligente integrado ao sistema de gestão de leilões de animais.
Você tem acesso a dados reais do banco de dados através das ferramentas disponíveis.

Contexto:
- Sistema de leilões agropecuários (bovinos, equinos, suínos, etc.)
- Entidades principais: Leilões, Lotes (animais/grupos), Clientes (compradores/vendedores), Vendas, Parcelas
- Valores sempre em Reais (R$). Datas no formato DD/MM/AAAA.

Comportamento:
- Responda sempre em português brasileiro, de forma direta e objetiva
- Ao receber uma pergunta que exige dados, use as ferramentas disponíveis antes de responder
- Formate valores monetários como R$ X.XXX,XX
- Se não encontrar dados, informe claramente
- Nunca invente dados — use apenas o que as ferramentas retornam
- Para perguntas sobre clientes específicos, busque primeiro pelo nome ou CPF
- Você pode combinar múltiplas tools em uma mesma resposta quando necessário`;

// ─── Tipos e função principal ─────────────────────────────────────────────────

export interface MensagemChat {
  role: 'user' | 'assistant';
  content: string;
}

export async function chat(historico: MensagemChat[], mensagem: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    ...historico.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: mensagem },
  ];

  let response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages,
  });

  // Loop de tool use: executa até o Claude devolver uma resposta de texto
  while (response.stop_reason === 'tool_use') {
    const toolBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];

    const toolResults = await Promise.all(
      toolBlocks.map(async tu => ({
        type: 'tool_result' as const,
        tool_use_id: tu.id,
        content: JSON.stringify(await executarTool(tu.name, tu.input)),
      }))
    );

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user',      content: toolResults });

    response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });
  }

  const texto = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined;
  return texto?.text ?? '—';
}
