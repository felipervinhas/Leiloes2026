import axios, { AxiosError } from 'axios';

/** Credenciais do número na Meta (vem de WPP_CONFIG). */
export interface CredenciaisMeta {
  phoneNumberId: string;
  wabaId: string;
  token: string;
  apiVersion: string;
}

export class MetaError extends Error {
  constructor(
    message: string,
    public codigo: number | null,
    public transitorio: boolean,
    public autenticacao: boolean,
    public httpStatus?: number,
  ) { super(message); }
}

// Códigos da Cloud API que valem nova tentativa mais tarde (limite de taxa,
// instabilidade). O resto (número inválido, template pausado, sem WhatsApp...) é definitivo.
const CODIGOS_TRANSITORIOS = new Set([1, 2, 4, 17, 341, 80007, 130429, 131000, 131016, 131048, 131056, 133004]);

function converterErro(e: unknown): MetaError {
  const ax = e as AxiosError<any>;
  const err = ax?.response?.data?.error;
  if (err) {
    const codigo = Number(err.code) || null;
    const detalhe = err.error_data?.details || err.error_user_msg || '';
    const msg = [err.message, detalhe].filter(Boolean).join(' — ');
    const http = ax.response?.status;
    // 100 = parâmetro inválido: só é problema de credencial quando o objeto não existe (id errado)
    const auth = codigo === 190 || codigo === 10 || codigo === 200 || codigo === 3
      || (codigo === 100 && /does not exist|Unsupported (get|post) request/i.test(err.message || ''));
    const trans = (codigo !== null && CODIGOS_TRANSITORIOS.has(codigo)) || (http !== undefined && http >= 500);
    return new MetaError(msg || 'Erro na API do WhatsApp', codigo, trans && !auth, auth, http);
  }
  // Sem resposta da Meta: rede/timeout — tenta de novo
  return new MetaError(ax?.message || String(e), null, true, false);
}

function base(c: CredenciaisMeta) {
  return `https://graph.facebook.com/${c.apiVersion || 'v25.0'}`;
}

function headers(c: CredenciaisMeta) {
  return { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' };
}

export interface ResultadoEnvio { wamid: string; waId: string | null; }

export async function enviarTemplate(
  c: CredenciaisMeta,
  para: string,
  template: { nome: string; idioma: string; componentes: any[] },
): Promise<ResultadoEnvio> {
  try {
    const r = await axios.post(`${base(c)}/${c.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to: para,
      type: 'template',
      template: {
        name: template.nome,
        language: { code: template.idioma },
        ...(template.componentes?.length ? { components: template.componentes } : {}),
      },
    }, { headers: headers(c), timeout: 30_000 });
    return { wamid: r.data?.messages?.[0]?.id, waId: r.data?.contacts?.[0]?.wa_id ?? null };
  } catch (e) { throw converterErro(e); }
}

/** Texto livre — só funciona dentro da janela de 24h após o cliente mandar mensagem. */
export async function enviarTexto(c: CredenciaisMeta, para: string, texto: string): Promise<ResultadoEnvio> {
  try {
    const r = await axios.post(`${base(c)}/${c.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to: para,
      type: 'text',
      text: { body: texto, preview_url: false },
    }, { headers: headers(c), timeout: 30_000 });
    return { wamid: r.data?.messages?.[0]?.id, waId: r.data?.contacts?.[0]?.wa_id ?? null };
  } catch (e) { throw converterErro(e); }
}

export async function marcarComoLida(c: CredenciaisMeta, wamid: string): Promise<void> {
  try {
    await axios.post(`${base(c)}/${c.phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', status: 'read', message_id: wamid },
      { headers: headers(c), timeout: 15_000 });
  } catch { /* não é essencial */ }
}

export interface TemplateMeta {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  parameter_format?: string;
  components: any[];
}

export async function listarTemplates(c: CredenciaisMeta): Promise<TemplateMeta[]> {
  const todos: TemplateMeta[] = [];
  let url: string | null =
    `${base(c)}/${c.wabaId}/message_templates?fields=id,name,language,status,category,parameter_format,components&limit=100`;
  try {
    while (url && todos.length < 1000) {
      const resp: any = await axios.get(url, { headers: headers(c), timeout: 30_000 });
      todos.push(...(resp.data?.data || []));
      url = resp.data?.paging?.next || null;
    }
  } catch (e) { throw converterErro(e); }
  return todos;
}

export interface InfoNumero {
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  messaging_limit_tier?: string;
  throughput?: { level?: string };
}

/** Dados do número (nome verificado, qualidade, nível de limite) — usado no teste de conexão. */
export async function infoNumero(c: CredenciaisMeta): Promise<InfoNumero> {
  try {
    const r = await axios.get(
      `${base(c)}/${c.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,throughput`,
      { headers: headers(c), timeout: 20_000 });
    return r.data;
  } catch (e) { throw converterErro(e); }
}
