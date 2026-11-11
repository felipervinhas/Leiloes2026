import crypto from 'crypto';
import { getPool, sql } from '../../config/database';
import { garantirTabelasWhatsapp } from './schema';
import { CredenciaisMeta } from './metaApi';

/** Controle (Clientes_Perfil.CONTROLE) que libera a tela de WhatsApp. */
export const CONTROLE_WHATSAPP = 'WhatsApp';

export class WhatsappError extends Error {
  constructor(public status: number, message: string, public dados?: any) { super(message); }
}

export interface ConfigWhatsapp {
  phoneNumberId: string;
  wabaId: string;
  token: string;
  appSecret: string;
  verifyToken: string;
  apiVersion: string;
  limiteDiario: number;
  msgsPorMinuto: number;
  precoMarketing: number;
  precoUtilidade: number;
  msgOptout: string;
}

export const MSG_OPTOUT_PADRAO =
  'Pronto, você não vai mais receber nossas mensagens por aqui. Se mudar de ideia, é só responder VOLTAR.';

export async function moduloAtivo(): Promise<boolean> {
  await garantirTabelasWhatsapp();
  const pool = await getPool();
  const r = await pool.request().query(`SELECT TOP 1 WPP_ATIVA FROM Configuracoes`);
  return r.recordset[0]?.WPP_ATIVA === 'S';
}

export async function lerConfig(): Promise<ConfigWhatsapp | null> {
  await garantirTabelasWhatsapp();
  const pool = await getPool();
  const r = await pool.request().query(`SELECT TOP 1 * FROM WPP_CONFIG ORDER BY ID`);
  const c = r.recordset[0];
  if (!c) return null;
  return {
    phoneNumberId: c.PHONE_NUMBER_ID || '',
    wabaId: c.WABA_ID || '',
    token: c.TOKEN || '',
    appSecret: c.APP_SECRET || '',
    verifyToken: c.VERIFY_TOKEN || '',
    apiVersion: c.API_VERSION || 'v25.0',
    limiteDiario: Number(c.LIMITE_DIARIO) || 250,
    msgsPorMinuto: Number(c.MSGS_POR_MINUTO) || 60,
    precoMarketing: Number(c.PRECO_MARKETING) || 0,
    precoUtilidade: Number(c.PRECO_UTILIDADE) || 0,
    msgOptout: c.MSG_OPTOUT || MSG_OPTOUT_PADRAO,
  };
}

export function credenciais(c: ConfigWhatsapp | null): CredenciaisMeta {
  if (!c || !c.phoneNumberId || !c.token) {
    throw new WhatsappError(400, 'WhatsApp não configurado: informe o Phone Number ID e o token em Configuração');
  }
  return { phoneNumberId: c.phoneNumberId, wabaId: c.wabaId, token: c.token, apiVersion: c.apiVersion };
}

const mascarar = (s: string) => (s ? `••••${s.slice(-4)}` : '');

/** Versão para a tela: segredos mascarados. */
export async function configParaTela() {
  const c = await lerConfig();
  return {
    phoneNumberId: c?.phoneNumberId || '',
    wabaId: c?.wabaId || '',
    tokenMascarado: mascarar(c?.token || ''),
    temToken: !!c?.token,
    appSecretMascarado: mascarar(c?.appSecret || ''),
    temAppSecret: !!c?.appSecret,
    verifyToken: c?.verifyToken || '',
    apiVersion: c?.apiVersion || 'v25.0',
    limiteDiario: c?.limiteDiario ?? 250,
    msgsPorMinuto: c?.msgsPorMinuto ?? 60,
    precoMarketing: c?.precoMarketing ?? 0.35,
    precoUtilidade: c?.precoUtilidade ?? 0.04,
    msgOptout: c?.msgOptout || MSG_OPTOUT_PADRAO,
  };
}

/** Token e app secret vazios no corpo = manter o que já está salvo. */
export async function salvarConfig(d: any, usuario?: string): Promise<void> {
  const atual = await lerConfig();
  const pool = await getPool();
  const verifyToken = (d.verifyToken || atual?.verifyToken || crypto.randomBytes(16).toString('hex')).trim();
  const req = pool.request()
    .input('phone', sql.VarChar, String(d.phoneNumberId || '').trim() || null)
    .input('waba', sql.VarChar, String(d.wabaId || '').trim() || null)
    .input('token', sql.VarChar, String(d.token || '').trim() || atual?.token || null)
    .input('secret', sql.VarChar, String(d.appSecret || '').trim() || atual?.appSecret || null)
    .input('verify', sql.VarChar, verifyToken)
    .input('versao', sql.VarChar, String(d.apiVersion || 'v25.0').trim())
    .input('limite', sql.Int, Math.max(1, Number(d.limiteDiario) || 250))
    .input('ritmo', sql.Int, Math.min(600, Math.max(1, Number(d.msgsPorMinuto) || 60)))
    .input('pm', sql.Decimal(9, 4), Number(d.precoMarketing) || 0)
    .input('pu', sql.Decimal(9, 4), Number(d.precoUtilidade) || 0)
    .input('optout', sql.NVarChar, String(d.msgOptout || '').trim() || null)
    .input('usuario', sql.VarChar, usuario || null);
  await req.query(`
    IF EXISTS (SELECT 1 FROM WPP_CONFIG)
      UPDATE WPP_CONFIG SET PHONE_NUMBER_ID=@phone, WABA_ID=@waba, TOKEN=@token, APP_SECRET=@secret,
        VERIFY_TOKEN=@verify, API_VERSION=@versao, LIMITE_DIARIO=@limite, MSGS_POR_MINUTO=@ritmo,
        PRECO_MARKETING=@pm, PRECO_UTILIDADE=@pu, MSG_OPTOUT=@optout,
        ATUALIZADO_EM=GETUTCDATE(), ATUALIZADO_POR=@usuario
      WHERE ID = (SELECT MIN(ID) FROM WPP_CONFIG)
    ELSE
      INSERT INTO WPP_CONFIG (PHONE_NUMBER_ID, WABA_ID, TOKEN, APP_SECRET, VERIFY_TOKEN, API_VERSION,
        LIMITE_DIARIO, MSGS_POR_MINUTO, PRECO_MARKETING, PRECO_UTILIDADE, MSG_OPTOUT, ATUALIZADO_EM, ATUALIZADO_POR)
      VALUES (@phone, @waba, @token, @secret, @verify, @versao, @limite, @ritmo, @pm, @pu, @optout, GETUTCDATE(), @usuario)
  `);
}

interface UsuarioJwt { adm?: string; controles?: string[] }

/** Mesma regra do menu: sem controles marcados = acesso a tudo; admin sempre. */
export function temAcessoWhatsapp(u: UsuarioJwt | undefined): boolean {
  if (!u) return false;
  if (u.adm === 'S') return true;
  const controles = (u.controles || []).filter(c => c !== 'Conciliação Bancária' && c !== 'Intermediação de Cobrança');
  return controles.length === 0 || controles.includes(CONTROLE_WHATSAPP);
}

export function ehAdmin(u: UsuarioJwt | undefined): boolean {
  return u?.adm === 'S';
}
