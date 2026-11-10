import { TemplateMeta } from './metaApi';

/**
 * Leitura dos templates aprovados na Meta e montagem dos "components" de cada envio.
 *
 * O usuário liga cada variável do template ({{1}}, {{2}} ou {{nome}}) a uma fonte
 * de dados do cadastro (nome do cliente, data do leilão...) ou a um texto fixo.
 */

export type FonteVariavel =
  | 'fixo' | 'nome' | 'primeiro_nome' | 'cidade' | 'uf' | 'empresa'
  | 'leilao_nome' | 'leilao_data' | 'leilao_hora' | 'leilao_catalogo' | 'leilao_transmissao'
  | 'parcelas_qtd' | 'parcelas_total' | 'parcela_vencimento';

export const FONTES: { value: FonteVariavel; label: string; exige?: 'leilao' | 'parcelas' }[] = [
  { value: 'fixo', label: 'Texto fixo' },
  { value: 'primeiro_nome', label: 'Primeiro nome do cliente' },
  { value: 'nome', label: 'Nome completo do cliente' },
  { value: 'cidade', label: 'Cidade do cliente' },
  { value: 'uf', label: 'UF do cliente' },
  { value: 'empresa', label: 'Nome da empresa' },
  { value: 'leilao_nome', label: 'Nome do leilão', exige: 'leilao' },
  { value: 'leilao_data', label: 'Data do leilão', exige: 'leilao' },
  { value: 'leilao_hora', label: 'Hora de início do leilão', exige: 'leilao' },
  { value: 'leilao_catalogo', label: 'Link do catálogo', exige: 'leilao' },
  { value: 'leilao_transmissao', label: 'Link da transmissão', exige: 'leilao' },
  { value: 'parcelas_qtd', label: 'Qtd. de parcelas no período', exige: 'parcelas' },
  { value: 'parcelas_total', label: 'Valor total das parcelas (R$)', exige: 'parcelas' },
  { value: 'parcela_vencimento', label: 'Primeiro vencimento no período', exige: 'parcelas' },
];

export interface MapeamentoVar { fonte: FonteVariavel; valor?: string }

export interface Mapeamento {
  header?: Record<string, MapeamentoVar>;   // variáveis do cabeçalho de texto
  headerMidiaUrl?: string;                  // link público da imagem/vídeo/PDF do cabeçalho
  body?: Record<string, MapeamentoVar>;
  botoes?: Record<string, MapeamentoVar>;   // índice do botão URL → variável do sufixo
}

export interface TemplateResumo {
  nome: string;
  idioma: string;
  categoria: string;
  status: string;
  formatoParametros: 'POSITIONAL' | 'NAMED';
  headerFormato: string | null;  // TEXT, IMAGE, VIDEO, DOCUMENT, LOCATION
  headerTexto: string | null;
  headerVariaveis: string[];
  bodyTexto: string;
  bodyVariaveis: string[];
  footerTexto: string | null;
  botoes: { indice: number; tipo: string; texto: string; url?: string; variavel: boolean }[];
}

const RE_VAR = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

function variaveis(texto: string | undefined | null): string[] {
  const vistas: string[] = [];
  for (const m of String(texto || '').matchAll(RE_VAR)) if (!vistas.includes(m[1])) vistas.push(m[1]);
  return vistas;
}

export function resumirTemplate(t: TemplateMeta): TemplateResumo {
  const comp = (tipo: string) => (t.components || []).find((c: any) => c.type === tipo);
  const header = comp('HEADER');
  const body = comp('BODY');
  const footer = comp('FOOTER');
  const botoes = (comp('BUTTONS')?.buttons || []).map((b: any, i: number) => ({
    indice: i,
    tipo: b.type,
    texto: b.text,
    url: b.url,
    variavel: b.type === 'URL' && /\{\{\s*[A-Za-z0-9_]+\s*\}\}/.test(b.url || ''),
  }));
  return {
    nome: t.name,
    idioma: t.language,
    categoria: t.category,
    status: t.status,
    formatoParametros: t.parameter_format === 'NAMED' ? 'NAMED' : 'POSITIONAL',
    headerFormato: header?.format || null,
    headerTexto: header?.format === 'TEXT' ? header.text : null,
    headerVariaveis: header?.format === 'TEXT' ? variaveis(header.text) : [],
    bodyTexto: body?.text || '',
    bodyVariaveis: variaveis(body?.text),
    footerTexto: footer?.text || null,
    botoes,
  };
}

/** Dados de um destinatário usados para preencher as variáveis. */
export interface DadosDestinatario {
  nome: string;
  cidade?: string | null;
  uf?: string | null;
  parcelasQtd?: number | null;
  parcelasTotal?: number | null;
  parcelaVencimento?: Date | string | null;
}

export interface DadosCampanha {
  empresa: string;
  leilao?: {
    nome: string; data: Date | string | null; hora: string | null;
    catalogo: string | null; transmissao: string | null;
  } | null;
}

const PREPOSICOES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/** "JOAO DA SILVA" → "Joao da Silva" (o cadastro legado é quase todo em maiúsculas). */
export function nomeProprio(nome: string): string {
  return String(nome || '').toLowerCase().split(/\s+/).filter(Boolean)
    .map((p, i) => (i > 0 && PREPOSICOES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

const fmtData = (d: Date | string | null | undefined) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  // datas do banco chegam como meia-noite UTC
  return dt.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const fmtReais = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function resolverFonte(m: MapeamentoVar | undefined, d: DadosDestinatario, c: DadosCampanha): string {
  if (!m) return '';
  switch (m.fonte) {
    case 'fixo': return m.valor || '';
    // cadastro sem nome: "Olá Cliente" em vez de "Olá -"
    case 'nome': return nomeProprio(d.nome) || 'Cliente';
    case 'primeiro_nome': return nomeProprio(d.nome).split(' ')[0] || 'Cliente';
    case 'cidade': return nomeProprio(d.cidade || '');
    case 'uf': return (d.uf || '').toUpperCase();
    case 'empresa': return c.empresa;
    case 'leilao_nome': return c.leilao?.nome || '';
    case 'leilao_data': return fmtData(c.leilao?.data);
    case 'leilao_hora': return c.leilao?.hora || '';
    case 'leilao_catalogo': return c.leilao?.catalogo || '';
    case 'leilao_transmissao': return c.leilao?.transmissao || '';
    case 'parcelas_qtd': return String(d.parcelasQtd ?? '');
    case 'parcelas_total': return fmtReais(d.parcelasTotal);
    case 'parcela_vencimento': return fmtData(d.parcelaVencimento);
    default: return '';
  }
}

/** A Meta recusa parâmetro vazio, com quebra de linha/tab ou com mais de 4 espaços seguidos. */
function limpar(v: string): string {
  const s = String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim();
  return s || '-';
}

function parametros(vars: string[], mapa: Record<string, MapeamentoVar> | undefined, nomeados: boolean,
  d: DadosDestinatario, c: DadosCampanha) {
  return vars.map(v => ({
    type: 'text',
    ...(nomeados ? { parameter_name: v } : {}),
    text: limpar(resolverFonte(mapa?.[v], d, c)),
  }));
}

/** Monta o array "components" do envio de template para um destinatário. */
export function montarComponentes(t: TemplateResumo, m: Mapeamento, d: DadosDestinatario, c: DadosCampanha): any[] {
  const nomeados = t.formatoParametros === 'NAMED';
  const comps: any[] = [];

  if (t.headerFormato === 'TEXT' && t.headerVariaveis.length) {
    comps.push({ type: 'header', parameters: parametros(t.headerVariaveis, m.header, nomeados, d, c) });
  } else if (t.headerFormato && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(t.headerFormato)) {
    const chave = t.headerFormato.toLowerCase();
    comps.push({ type: 'header', parameters: [{ type: chave, [chave]: { link: m.headerMidiaUrl } }] });
  }

  if (t.bodyVariaveis.length) {
    comps.push({ type: 'body', parameters: parametros(t.bodyVariaveis, m.body, nomeados, d, c) });
  }

  for (const b of t.botoes.filter(x => x.variavel)) {
    comps.push({
      type: 'button', sub_type: 'url', index: String(b.indice),
      parameters: [{ type: 'text', text: limpar(resolverFonte(m.botoes?.[String(b.indice)], d, c)) }],
    });
  }
  return comps;
}

/** Texto do corpo já preenchido — para a prévia na tela. */
export function previaTexto(t: TemplateResumo, m: Mapeamento, d: DadosDestinatario, c: DadosCampanha): string {
  return t.bodyTexto.replace(RE_VAR, (_x, v) => limpar(resolverFonte(m.body?.[v], d, c)));
}

/** Confere se o mapeamento cobre tudo o que o template exige. Devolve a lista de problemas. */
export function validarMapeamento(t: TemplateResumo, m: Mapeamento, temLeilao: boolean, temParcelas: boolean): string[] {
  const erros: string[] = [];
  const checar = (vars: string[], mapa: Record<string, MapeamentoVar> | undefined, onde: string) => {
    for (const v of vars) {
      const x = mapa?.[v];
      if (!x?.fonte) { erros.push(`Variável {{${v}}} do ${onde} sem preenchimento`); continue; }
      if (x.fonte === 'fixo' && !String(x.valor || '').trim()) erros.push(`Variável {{${v}}} do ${onde}: informe o texto fixo`);
      const def = FONTES.find(f => f.value === x.fonte);
      if (def?.exige === 'leilao' && !temLeilao) erros.push(`Variável {{${v}}} usa dados do leilão — escolha o leilão da campanha`);
      if (def?.exige === 'parcelas' && !temParcelas) erros.push(`Variável {{${v}}} usa dados de parcelas — só funciona com o público "Parcelas a vencer"`);
    }
  };
  if (t.headerFormato === 'TEXT') checar(t.headerVariaveis, m.header, 'cabeçalho');
  if (t.headerFormato && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(t.headerFormato) && !/^https:\/\//i.test(m.headerMidiaUrl || '')) {
    erros.push('O template tem cabeçalho de mídia: informe o link público (https) do arquivo');
  }
  checar(t.bodyVariaveis, m.body, 'texto');
  for (const b of t.botoes.filter(x => x.variavel)) {
    const x = m.botoes?.[String(b.indice)];
    if (!x?.fonte || (x.fonte === 'fixo' && !String(x.valor || '').trim())) {
      erros.push(`Botão "${b.texto}": informe o complemento do link`);
    }
  }
  return erros;
}
