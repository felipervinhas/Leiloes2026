import { getPool, sql } from '../../config/database';
import { getBanco } from '../../config/bancoContext';
import { credenciais, lerConfig, WhatsappError } from './configService';
import { enviarTemplate, listarTemplates, MetaError } from './metaApi';
import { FiltroPublico, montarPublico } from './publicoService';
import {
  DadosCampanha, Mapeamento, montarComponentes, previaTexto, resumirTemplate, TemplateResumo, validarMapeamento,
} from './templateService';
import { formatarCelular, normalizarCelular } from './telefone';

// ───────────────────────── templates (cache curto por banco) ─────────────────────────

const cacheTemplates = new Map<string, { em: number; lista: TemplateResumo[] }>();
const CACHE_MS = 5 * 60_000;

export async function templatesAprovados(forcar = false): Promise<TemplateResumo[]> {
  const banco = getBanco();
  const c = cacheTemplates.get(banco);
  if (!forcar && c && Date.now() - c.em < CACHE_MS) return c.lista;
  const cfg = await lerConfig();
  const cred = credenciais(cfg);
  if (!cred.wabaId) throw new WhatsappError(400, 'Informe o WhatsApp Business Account ID (WABA) em Configuração para listar os templates');
  const lista = (await listarTemplates(cred)).map(resumirTemplate);
  cacheTemplates.set(banco, { em: Date.now(), lista });
  return lista;
}

async function templatePorNome(nome: string, idioma: string): Promise<TemplateResumo> {
  let t = (await templatesAprovados()).find(x => x.nome === nome && x.idioma === idioma);
  if (!t) t = (await templatesAprovados(true)).find(x => x.nome === nome && x.idioma === idioma);
  if (!t) throw new WhatsappError(400, `Template "${nome}" (${idioma}) não encontrado na conta do WhatsApp`);
  if (t.status !== 'APPROVED') throw new WhatsappError(400, `Template "${nome}" não está aprovado (status: ${t.status})`);
  return t;
}

// ───────────────────────── dados da campanha ─────────────────────────

async function dadosCampanha(idLeilao?: number | null): Promise<DadosCampanha> {
  const pool = await getPool();
  const e = await pool.request().query(`SELECT TOP 1 Empresa FROM Configuracoes`);
  let leilao: DadosCampanha['leilao'] = null;
  if (idLeilao) {
    const r = await pool.request().input('id', sql.Int, idLeilao)
      .query(`SELECT LEILAO, DATLEI, HORA_INICIO, URLCATALOGO, LINKTRANSMISSAO1 FROM LEILOES WHERE ID = @id`);
    const l = r.recordset[0];
    if (!l) throw new WhatsappError(400, 'Leilão não encontrado');
    leilao = {
      nome: l.LEILAO || '', data: l.DATLEI, hora: l.HORA_INICIO || null,
      catalogo: l.URLCATALOGO || null, transmissao: l.LINKTRANSMISSAO1 || null,
    };
  }
  return { empresa: e.recordset[0]?.Empresa || '', leilao };
}

function precoCategoria(categoria: string, cfg: { precoMarketing: number; precoUtilidade: number } | null): number {
  if (!cfg) return 0;
  if (categoria === 'MARKETING') return cfg.precoMarketing;
  return cfg.precoUtilidade; // UTILITY e AUTHENTICATION têm preço parecido
}

// ───────────────────────── prévia ─────────────────────────

export interface EntradaCampanha {
  nome?: string;
  templateNome?: string;
  templateIdioma?: string;
  mapeamento?: Mapeamento;
  publico: FiltroPublico;
  idLeilao?: number | null;
  agendadaPara?: string | null;
  iniciar?: boolean;
}

export async function previa(e: EntradaCampanha) {
  const pub = await montarPublico(e.publico);
  const cfg = await lerConfig();
  let template: TemplateResumo | null = null;
  let erros: string[] = [];
  let amostra: any[] = pub.destinatarios.slice(0, 20).map(d => ({
    idCliente: d.idCliente, nome: d.nome, cidade: d.cidade, uf: d.uf, telefone: formatarCelular(d.numero),
  }));

  if (e.templateNome && e.templateIdioma) {
    template = await templatePorNome(e.templateNome, e.templateIdioma);
    const m = e.mapeamento || {};
    erros = validarMapeamento(template, m, !!e.idLeilao, e.publico.tipo === 'parcelas');
    if (!erros.length) {
      const dc = await dadosCampanha(e.idLeilao);
      amostra = pub.destinatarios.slice(0, 20).map(d => ({
        idCliente: d.idCliente, nome: d.nome, cidade: d.cidade, uf: d.uf,
        telefone: formatarCelular(d.numero), texto: previaTexto(template!, m, d, dc),
      }));
    }
  }

  const preco = template ? precoCategoria(template.categoria, cfg) : 0;
  return {
    total: pub.destinatarios.length,
    totalClientes: pub.totalClientes,
    semCelularValido: pub.semCelularValido,
    duplicados: pub.duplicados,
    descadastrados: pub.descadastrados,
    categoria: template?.categoria || null,
    precoUnitario: preco,
    custoEstimado: Math.round(pub.destinatarios.length * preco * 100) / 100,
    limiteDiario: cfg?.limiteDiario ?? null,
    diasEstimados: cfg?.limiteDiario ? Math.ceil(pub.destinatarios.length / cfg.limiteDiario) : null,
    erros,
    amostra,
  };
}

// ───────────────────────── criação ─────────────────────────

export async function criarCampanha(e: EntradaCampanha, usuario: { id?: number; nome?: string }): Promise<number> {
  const nome = String(e.nome || '').trim();
  if (!nome) throw new WhatsappError(400, 'Dê um nome para a campanha');
  if (!e.templateNome || !e.templateIdioma) throw new WhatsappError(400, 'Escolha o template');

  const template = await templatePorNome(e.templateNome, e.templateIdioma);
  const m = e.mapeamento || {};
  const erros = validarMapeamento(template, m, !!e.idLeilao, e.publico.tipo === 'parcelas');
  if (erros.length) throw new WhatsappError(400, erros[0], { erros });

  const pub = await montarPublico(e.publico);
  if (!pub.destinatarios.length) throw new WhatsappError(400, 'Nenhum destinatário com celular válido para este público');

  const dc = await dadosCampanha(e.idLeilao);
  const cfg = await lerConfig();
  const custo = Math.round(pub.destinatarios.length * precoCategoria(template.categoria, cfg) * 100) / 100;

  let agendada: Date | null = null;
  if (e.agendadaPara) {
    agendada = new Date(e.agendadaPara);
    if (isNaN(agendada.getTime())) throw new WhatsappError(400, 'Data de agendamento inválida');
  }
  const status = agendada && agendada.getTime() > Date.now() ? 'AGENDADA' : (e.iniciar ? 'ENVIANDO' : 'AGUARDANDO');

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const r = await new sql.Request(tx)
      .input('nome', sql.NVarChar(150), nome.slice(0, 150))
      .input('tnome', sql.VarChar(512), template.nome)
      .input('tidioma', sql.VarChar(15), template.idioma)
      .input('tcat', sql.VarChar(20), template.categoria)
      .input('ttexto', sql.NVarChar(sql.MAX), template.bodyTexto)
      .input('publico', sql.NVarChar(sql.MAX), JSON.stringify(e.publico))
      .input('mapa', sql.NVarChar(sql.MAX), JSON.stringify(m))
      .input('leilao', sql.Int, e.idLeilao || null)
      .input('status', sql.VarChar(20), status)
      .input('agendada', sql.DateTime, agendada)
      .input('total', sql.Int, pub.destinatarios.length)
      .input('custo', sql.Decimal(12, 2), custo)
      .input('por', sql.VarChar(100), usuario?.nome || null)
      .input('idUsu', sql.Int, usuario?.id ?? null)
      .query(`
        DECLARE @ids TABLE (ID INT);
        INSERT INTO WPP_CAMPANHAS (NOME, TEMPLATE_NOME, TEMPLATE_IDIOMA, TEMPLATE_CATEGORIA, TEMPLATE_TEXTO,
          PUBLICO_JSON, MAPEAMENTO_JSON, ID_LEILAO, STATUS, AGENDADA_PARA, TOTAL, CUSTO_ESTIMADO, CRIADA_POR, ID_USUARIO,
          INICIADA_EM)
        OUTPUT INSERTED.ID INTO @ids
        VALUES (@nome, @tnome, @tidioma, @tcat, @ttexto, @publico, @mapa, @leilao, @status, @agendada, @total, @custo,
          @por, @idUsu, CASE WHEN @status = 'ENVIANDO' THEN GETUTCDATE() END);
        SELECT ID FROM @ids;`);
    const id: number = r.recordset[0].ID;

    const tabela = new sql.Table('WPP_ENVIOS');
    tabela.create = false;
    tabela.columns.add('ID_CAMPANHA', sql.Int, { nullable: false });
    tabela.columns.add('ID_CLIENTE', sql.Int, { nullable: true });
    tabela.columns.add('NOME', sql.NVarChar(150), { nullable: true });
    tabela.columns.add('TELEFONE', sql.VarChar(20), { nullable: false });
    tabela.columns.add('CHAVE', sql.VarChar(20), { nullable: false });
    tabela.columns.add('COMPONENTES', sql.NVarChar(sql.MAX), { nullable: true });
    tabela.columns.add('STATUS', sql.VarChar(20), { nullable: false });
    tabela.columns.add('TENTATIVAS', sql.Int, { nullable: false });
    for (const d of pub.destinatarios) {
      tabela.rows.add(id, d.idCliente, String(d.nome || '').slice(0, 150), d.numero, d.chave,
        JSON.stringify(montarComponentes(template, m, d, dc)), 'PENDENTE', 0);
    }
    await new sql.Request(tx).bulk(tabela);
    await tx.commit();
    return id;
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

// ───────────────────────── consulta ─────────────────────────

const SQL_STATS = `
  SUM(CASE WHEN E.STATUS IN ('PENDENTE','PROCESSANDO') THEN 1 ELSE 0 END) AS PENDENTES,
  SUM(CASE WHEN E.STATUS IN ('ENVIADO','ENTREGUE','LIDO') THEN 1 ELSE 0 END) AS ENVIADOS,
  SUM(CASE WHEN E.STATUS IN ('ENTREGUE','LIDO') THEN 1 ELSE 0 END) AS ENTREGUES,
  SUM(CASE WHEN E.STATUS = 'LIDO' THEN 1 ELSE 0 END) AS LIDOS,
  SUM(CASE WHEN E.STATUS = 'FALHOU' THEN 1 ELSE 0 END) AS FALHAS,
  SUM(CASE WHEN E.STATUS IN ('CANCELADO','IGNORADO') THEN 1 ELSE 0 END) AS CANCELADOS`;

function mapCampanha(c: any, cfg: any) {
  const preco = precoCategoria(c.TEMPLATE_CATEGORIA, cfg);
  return {
    id: c.ID, nome: c.NOME, templateNome: c.TEMPLATE_NOME, templateIdioma: c.TEMPLATE_IDIOMA,
    categoria: c.TEMPLATE_CATEGORIA, templateTexto: c.TEMPLATE_TEXTO, idLeilao: c.ID_LEILAO, leilao: c.LEILAO || null,
    status: c.STATUS, agendadaPara: c.AGENDADA_PARA, total: c.TOTAL, custoEstimado: Number(c.CUSTO_ESTIMADO) || 0,
    // A Meta cobra pela mensagem entregue
    custoReal: Math.round((c.ENTREGUES || 0) * preco * 100) / 100,
    ultimoErro: c.ULTIMO_ERRO, criadaEm: c.CRIADA_EM, criadaPor: c.CRIADA_POR,
    iniciadaEm: c.INICIADA_EM, concluidaEm: c.CONCLUIDA_EM,
    pendentes: c.PENDENTES || 0, enviados: c.ENVIADOS || 0, entregues: c.ENTREGUES || 0,
    lidos: c.LIDOS || 0, falhas: c.FALHAS || 0, cancelados: c.CANCELADOS || 0,
    publico: c.PUBLICO_JSON ? JSON.parse(c.PUBLICO_JSON) : null,
  };
}

export async function listarCampanhas() {
  const pool = await getPool();
  const cfg = await lerConfig();
  const r = await pool.request().query(`
    SELECT TOP 300 C.*, L.LEILAO, S.*
    FROM WPP_CAMPANHAS C
    LEFT JOIN LEILOES L ON L.ID = C.ID_LEILAO
    OUTER APPLY (SELECT ${SQL_STATS} FROM WPP_ENVIOS E WHERE E.ID_CAMPANHA = C.ID) S
    ORDER BY C.ID DESC`);
  return r.recordset.map(c => mapCampanha(c, cfg));
}

export async function buscarCampanha(id: number) {
  const pool = await getPool();
  const cfg = await lerConfig();
  const r = await pool.request().input('id', sql.Int, id).query(`
    SELECT C.*, L.LEILAO, S.*
    FROM WPP_CAMPANHAS C
    LEFT JOIN LEILOES L ON L.ID = C.ID_LEILAO
    OUTER APPLY (SELECT ${SQL_STATS} FROM WPP_ENVIOS E WHERE E.ID_CAMPANHA = C.ID) S
    WHERE C.ID = @id`);
  if (!r.recordset[0]) throw new WhatsappError(404, 'Campanha não encontrada');
  return mapCampanha(r.recordset[0], cfg);
}

const STATUS_FILTRO: Record<string, string[]> = {
  pendentes: ['PENDENTE', 'PROCESSANDO'],
  enviados: ['ENVIADO'],
  entregues: ['ENTREGUE'],
  lidos: ['LIDO'],
  falhas: ['FALHOU'],
  cancelados: ['CANCELADO', 'IGNORADO'],
};

export async function listarEnvios(idCampanha: number, filtro: { status?: string; busca?: string; pagina?: number; tamanho?: number }) {
  const pool = await getPool();
  const pagina = Math.max(1, Number(filtro.pagina) || 1);
  const tamanho = Math.min(200, Math.max(10, Number(filtro.tamanho) || 50));
  const req = pool.request().input('id', sql.Int, idCampanha)
    .input('off', sql.Int, (pagina - 1) * tamanho).input('tam', sql.Int, tamanho);
  const where = ['ID_CAMPANHA = @id'];
  const st = STATUS_FILTRO[filtro.status || ''];
  if (st) where.push(`STATUS IN (${st.map(s => `'${s}'`).join(',')})`);
  if (filtro.busca) {
    req.input('busca', sql.NVarChar, `%${filtro.busca}%`);
    where.push('(NOME LIKE @busca OR TELEFONE LIKE @busca)');
  }
  const r = await req.query(`
    SELECT COUNT(*) OVER() AS TOTAL_LINHAS, ID, ID_CLIENTE, NOME, TELEFONE, STATUS, TENTATIVAS, ERRO_CODIGO, ERRO,
      ENVIADO_EM, ENTREGUE_EM, LIDO_EM
    FROM WPP_ENVIOS WHERE ${where.join(' AND ')}
    ORDER BY ID OFFSET @off ROWS FETCH NEXT @tam ROWS ONLY`);
  return {
    total: r.recordset[0]?.TOTAL_LINHAS || 0,
    itens: r.recordset.map((e: any) => ({
      id: e.ID, idCliente: e.ID_CLIENTE, nome: e.NOME, telefone: formatarCelular(e.TELEFONE), status: e.STATUS,
      tentativas: e.TENTATIVAS, erroCodigo: e.ERRO_CODIGO, erro: e.ERRO,
      enviadoEm: e.ENVIADO_EM, entregueEm: e.ENTREGUE_EM, lidoEm: e.LIDO_EM,
    })),
  };
}

// ───────────────────────── ações ─────────────────────────

async function statusAtual(id: number): Promise<string> {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`SELECT STATUS FROM WPP_CAMPANHAS WHERE ID = @id`);
  if (!r.recordset[0]) throw new WhatsappError(404, 'Campanha não encontrada');
  return r.recordset[0].STATUS;
}

export async function iniciar(id: number) {
  const st = await statusAtual(id);
  if (!['AGUARDANDO', 'AGENDADA', 'PAUSADA'].includes(st)) throw new WhatsappError(400, `Campanha ${st.toLowerCase()} não pode ser iniciada`);
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`
    UPDATE WPP_CAMPANHAS SET STATUS = 'ENVIANDO', ULTIMO_ERRO = NULL, AGENDADA_PARA = NULL,
      INICIADA_EM = ISNULL(INICIADA_EM, GETUTCDATE())
    WHERE ID = @id`);
}

export async function pausar(id: number) {
  const st = await statusAtual(id);
  if (!['ENVIANDO', 'AGENDADA'].includes(st)) throw new WhatsappError(400, 'Só é possível pausar campanha em envio ou agendada');
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`UPDATE WPP_CAMPANHAS SET STATUS = 'PAUSADA' WHERE ID = @id`);
}

export async function cancelar(id: number) {
  const st = await statusAtual(id);
  if (['CONCLUIDA', 'CANCELADA'].includes(st)) throw new WhatsappError(400, 'Campanha já encerrada');
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query(`
    UPDATE WPP_CAMPANHAS SET STATUS = 'CANCELADA', CONCLUIDA_EM = GETUTCDATE() WHERE ID = @id;
    UPDATE WPP_ENVIOS SET STATUS = 'CANCELADO', ATUALIZADO_EM = GETUTCDATE()
    WHERE ID_CAMPANHA = @id AND STATUS = 'PENDENTE';`);
}

/** Volta as falhas para a fila (só as que podem dar certo numa nova tentativa, a critério do usuário). */
export async function reenviarFalhas(id: number): Promise<number> {
  await statusAtual(id);
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`
    UPDATE WPP_ENVIOS SET STATUS = 'PENDENTE', TENTATIVAS = 0, PROXIMA_TENTATIVA = NULL, ERRO = NULL, ERRO_CODIGO = NULL,
      ATUALIZADO_EM = GETUTCDATE()
    WHERE ID_CAMPANHA = @id AND STATUS = 'FALHOU'
      AND CHAVE NOT IN (SELECT CHAVE FROM WPP_OPTOUT);
    SELECT @@ROWCOUNT AS N;`);
  const n = r.recordset[0]?.N || 0;
  if (n > 0) {
    await pool.request().input('id', sql.Int, id).query(`
      UPDATE WPP_CAMPANHAS SET STATUS = 'ENVIANDO', CONCLUIDA_EM = NULL, ULTIMO_ERRO = NULL WHERE ID = @id`);
  }
  return n;
}

export async function excluir(id: number) {
  const st = await statusAtual(id);
  if (st === 'ENVIANDO') throw new WhatsappError(400, 'Pause ou cancele a campanha antes de excluir');
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).query(`
    SELECT COUNT(*) AS N FROM WPP_ENVIOS WHERE ID_CAMPANHA = @id AND STATUS IN ('ENVIADO','ENTREGUE','LIDO')`);
  if (r.recordset[0].N > 0) throw new WhatsappError(400, 'Campanha já enviou mensagens — cancele em vez de excluir, para manter o histórico');
  await pool.request().input('id', sql.Int, id).query(`
    DELETE FROM WPP_ENVIOS WHERE ID_CAMPANHA = @id;
    DELETE FROM WPP_CAMPANHAS WHERE ID = @id;`);
}

// ───────────────────────── envio de teste ─────────────────────────

export async function envioTeste(e: { telefone: string; templateNome: string; templateIdioma: string; mapeamento?: Mapeamento; idLeilao?: number | null; nome?: string }) {
  const tel = normalizarCelular(e.telefone);
  if (!tel) throw new WhatsappError(400, 'Celular inválido — use DDD + número');
  const template = await templatePorNome(e.templateNome, e.templateIdioma);
  const m = e.mapeamento || {};
  const erros = validarMapeamento(template, m, !!e.idLeilao, false)
    .filter(x => !x.includes('Parcelas a vencer'));
  if (erros.length) throw new WhatsappError(400, erros[0], { erros });
  const dc = await dadosCampanha(e.idLeilao);
  const dados = { nome: e.nome || 'Cliente Teste', cidade: 'Cidade', uf: 'RS', parcelasQtd: 2, parcelasTotal: 1234.56, parcelaVencimento: new Date() };
  const cfg = await lerConfig();
  try {
    const r = await enviarTemplate(credenciais(cfg), tel.numero, {
      nome: template.nome, idioma: template.idioma, componentes: montarComponentes(template, m, dados, dc),
    });
    return { wamid: r.wamid, numero: formatarCelular(tel.numero), texto: previaTexto(template, m, dados, dc) };
  } catch (err) {
    if (err instanceof MetaError) throw new WhatsappError(400, `A Meta recusou o envio: ${err.message}`);
    throw err;
  }
}
